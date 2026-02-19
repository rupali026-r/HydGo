import { prisma } from '../../config/database';
import { getAdminNamespace, getPassengerNamespace } from '../../config/socket';
import { calculateBearing, haversineDistance } from '../../utils/geo';
import { calculateOccupancy } from '../../utils/occupancy';
import { logger } from '../../utils/logger';
import { isBusDriverControlled, isBusInGracePeriod, getLastDriverPosition, checkRouteFailsafe } from './hybrid-manager';

// ── Types ───────────────────────────────────────────────────────────────────

interface StopInfo {
  latitude: number;
  longitude: number;
  name: string;
  isMajor: boolean;
}

interface SimulatedBus {
  busId: string;
  routeId: string;
  routeNumber: string;
  polyline: [number, number][];
  stops: StopInfo[];
  currentIndex: number;
  segmentProgress: number;
  direction: 1 | -1;
  capacity: number;
  passengerCount: number;
  currentSpeed: number;      // km/h
  trafficFactor: number;     // 1.0 – 1.3
  nearStopCooldown: number;  // ticks remaining to slow near stop
}

interface BusUpdate {
  busId: string;
  routeId: string;
  routeNumber: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  passengerCount: number;
  capacity: number;
  occupancy: ReturnType<typeof calculateOccupancy>;
  isSimulated: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const UPDATE_INTERVAL_MS = 3_000;
const TARGET_BUSES = 20;
const MAX_CAPACITY = 60;

// Realistic speed range
const MIN_SPEED_KMH = 20;
const MAX_SPEED_KMH = 40;
const STOP_SLOW_SPEED_KMH = 8;  // when within ~100m of a stop
const NEAR_STOP_DISTANCE_KM = 0.1; // 100 metres

// Traffic factor range
const MIN_TRAFFIC = 1.0;
const MAX_TRAFFIC = 1.3;
const TRAFFIC_CHANGE_RATE = 0.02;

// Passenger logic
const MAJOR_STOP_BOARD_MAX = 12;
const MINOR_STOP_BOARD_MAX = 5;
const MAJOR_STOP_ALIGHT_MAX = 8;
const MINOR_STOP_ALIGHT_MAX = 3;
const TERMINAL_ALIGHT_PERCENT = 0.7;

// ── State ───────────────────────────────────────────────────────────────────

const activeBuses = new Map<string, SimulatedBus>();

// Buses that were driver-controlled last tick (for detecting sim resume transition)
const wasDriverControlled = new Set<string>();

let interval: ReturnType<typeof setInterval> | null = null;
let failsafeInterval: ReturnType<typeof setInterval> | null = null;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a simulated bus by its ID (used for hybrid resume position sync).
 */
export function getSimulatedBus(busId: string): SimulatedBus | undefined {
  return activeBuses.get(busId);
}

export async function startSimulation(): Promise<void> {
  logger.info('Starting simulation engine …');

  const routes = await prisma.route.findMany({
    include: { stops: { orderBy: { stopOrder: 'asc' } } },
  });

  if (routes.length === 0) {
    logger.warn('No routes in database — seed routes before enabling simulation');
    return;
  }

  // Remove any leftover simulated buses
  await prisma.bus.deleteMany({ where: { isSimulated: true } });

  const busesPerRoute = Math.max(1, Math.ceil(TARGET_BUSES / routes.length));

  for (const route of routes) {
    // Build polyline
    let polyline: [number, number][];
    try {
      polyline = JSON.parse(route.polyline) as [number, number][];
    } catch {
      if (route.stops.length >= 2) {
        polyline = route.stops.map((s) => [s.latitude, s.longitude] as [number, number]);
      } else {
        continue;
      }
    }

    if (polyline.length < 2) continue;

    const smoothed = interpolatePolyline(polyline, 5);

    // Build stop info
    const majorStopNames = ['MGBS', 'JBS', 'Secunderabad', 'Ameerpet', 'LB Nagar', 'Koti', 'Dilsukhnagar', 'Kukatpally', 'Miyapur', 'ECIL', 'Uppal', 'Mehdipatnam'];
    const stops: StopInfo[] = route.stops.map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
      name: s.name,
      isMajor: majorStopNames.some((m) => s.name.toLowerCase().includes(m.toLowerCase())),
    }));

    for (let i = 0; i < busesPerRoute; i++) {
      const capacity = route.routeType === 'SUPER_LUXURY' || route.routeType === 'GARUDA_PLUS' ? 45 : MAX_CAPACITY;
      const passengerCount = Math.floor(Math.random() * Math.floor(capacity * 0.5)) + 5;
      const startIdx = Math.floor(Math.random() * (smoothed.length - 1));

      const bus = await prisma.bus.create({
        data: {
          registrationNo: `SIM-${route.routeNumber}-${String(i + 1).padStart(2, '0')}`,
          routeId: route.id,
          capacity,
          passengerCount,
          latitude: smoothed[startIdx][0],
          longitude: smoothed[startIdx][1],
          status: 'ACTIVE',
          isSimulated: true,
        },
      });

      activeBuses.set(bus.id, {
        busId: bus.id,
        routeId: route.id,
        routeNumber: route.routeNumber,
        polyline: smoothed,
        stops,
        currentIndex: startIdx,
        segmentProgress: 0,
        direction: Math.random() > 0.5 ? 1 : -1,
        capacity,
        passengerCount,
        currentSpeed: MIN_SPEED_KMH + Math.random() * (MAX_SPEED_KMH - MIN_SPEED_KMH),
        trafficFactor: MIN_TRAFFIC + Math.random() * (MAX_TRAFFIC - MIN_TRAFFIC),
        nearStopCooldown: 0,
      });
    }
  }

  logger.info(`Simulation running — ${activeBuses.size} virtual buses across ${routes.length} routes`);

  interval = setInterval(tick, UPDATE_INTERVAL_MS);

  // Route failsafe: check every 5 minutes for routes with no coverage
  failsafeInterval = setInterval(checkRouteFailsafe, 5 * 60 * 1000);
}

export function stopSimulation(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (failsafeInterval) {
    clearInterval(failsafeInterval);
    failsafeInterval = null;
  }
  activeBuses.clear();
  wasDriverControlled.clear();
  logger.info('Simulation stopped');
}

// ── Tick ─────────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const updates: BusUpdate[] = [];

  for (const [busId, sim] of activeBuses) {
    // ── Hybrid override: skip buses controlled by real drivers or in grace period ──
    if (isBusDriverControlled(busId) || isBusInGracePeriod(busId)) {
      wasDriverControlled.add(busId);
      continue;
    }

    // ── Teleport-free resume: if bus was just released from driver control ──
    if (wasDriverControlled.has(busId)) {
      wasDriverControlled.delete(busId);
      const lastPos = getLastDriverPosition(busId);
      if (lastPos) {
        // Find nearest polyline segment to resume from
        const nearestIdx = findClosestPolylineIndex(lastPos.latitude, lastPos.longitude, sim.polyline);
        sim.currentIndex = nearestIdx;
        sim.segmentProgress = 0;
        sim.currentSpeed = MIN_SPEED_KMH; // Start slow after resume
        logger.info('Simulation: resuming bus from driver last position', {
          busId,
          nearestIdx,
          lat: lastPos.latitude,
          lng: lastPos.longitude,
        });
      }
    }

    const cur = sim.polyline[sim.currentIndex];

    // Check proximity to nearest stop
    const nearestStopDist = nearestStopDistance(cur[0], cur[1], sim.stops);
    const isNearStop = nearestStopDist < NEAR_STOP_DISTANCE_KM;

    // Evolve traffic factor slowly
    sim.trafficFactor += (Math.random() - 0.5) * TRAFFIC_CHANGE_RATE;
    sim.trafficFactor = Math.max(MIN_TRAFFIC, Math.min(MAX_TRAFFIC, sim.trafficFactor));

    // Determine target speed
    let targetSpeed: number;
    if (isNearStop) {
      targetSpeed = STOP_SLOW_SPEED_KMH;
      sim.nearStopCooldown = 3; // slow for 3 ticks after a stop
    } else if (sim.nearStopCooldown > 0) {
      targetSpeed = STOP_SLOW_SPEED_KMH + 5;
      sim.nearStopCooldown--;
    } else {
      targetSpeed = (MIN_SPEED_KMH + Math.random() * (MAX_SPEED_KMH - MIN_SPEED_KMH)) / sim.trafficFactor;
    }

    // Smooth speed transition
    sim.currentSpeed += (targetSpeed - sim.currentSpeed) * 0.3;
    sim.currentSpeed = Math.max(5, Math.min(MAX_SPEED_KMH, sim.currentSpeed));

    // Convert speed to fraction-of-segment per tick using ACTUAL segment length
    const nextSegIdx = Math.min(
      Math.max(sim.currentIndex + sim.direction, 0),
      sim.polyline.length - 1,
    );
    const segStart = sim.polyline[sim.currentIndex];
    const segEnd = sim.polyline[nextSegIdx];
    const actualSegmentKm = haversineDistance(segStart[0], segStart[1], segEnd[0], segEnd[1]);
    const safeSegmentKm = Math.max(actualSegmentKm, 0.005); // floor at 5m to avoid div/0

    const distPerTick = (sim.currentSpeed / 3600) * (UPDATE_INTERVAL_MS / 1000);
    const progressPerTick = distPerTick / safeSegmentKm;

    sim.segmentProgress += progressPerTick;

    // Advance through multiple segments if speed > segment length
    let loopGuard = 0;
    while (sim.segmentProgress >= 1 && loopGuard < 20) {
      loopGuard++;
      sim.segmentProgress -= 1;
      sim.currentIndex += sim.direction;

      // Bounce at endpoints (terminal)
      if (sim.currentIndex >= sim.polyline.length - 1) {
        sim.direction = -1;
        sim.currentIndex = sim.polyline.length - 2;
        sim.segmentProgress = 0; // reset to prevent overshoot
        // Terminal: most passengers alight
        const alight = Math.floor(sim.passengerCount * TERMINAL_ALIGHT_PERCENT);
        sim.passengerCount = Math.max(0, sim.passengerCount - alight);
        break; // stop advancing this tick
      } else if (sim.currentIndex <= 0) {
        sim.direction = 1;
        sim.currentIndex = 1;
        sim.segmentProgress = 0; // reset to prevent overshoot
        const alight = Math.floor(sim.passengerCount * TERMINAL_ALIGHT_PERCENT);
        sim.passengerCount = Math.max(0, sim.passengerCount - alight);
        break; // stop advancing this tick
      }

      // Handle passenger boarding/alighting near stops
      if (isNearStop) {
        const nearestStop = findNearestStop(cur[0], cur[1], sim.stops);
        if (nearestStop) {
          const boardMax = nearestStop.isMajor ? MAJOR_STOP_BOARD_MAX : MINOR_STOP_BOARD_MAX;
          const alightMax = nearestStop.isMajor ? MAJOR_STOP_ALIGHT_MAX : MINOR_STOP_ALIGHT_MAX;

          const boarding = Math.floor(Math.random() * boardMax);
          const alighting = Math.floor(Math.random() * Math.min(alightMax, sim.passengerCount));

          sim.passengerCount = Math.max(0, Math.min(sim.capacity, sim.passengerCount + boarding - alighting));
        }
      }
    }

    const nextIdx = Math.min(
      Math.max(sim.currentIndex + sim.direction, 0),
      sim.polyline.length - 1,
    );
    const nxt = sim.polyline[nextIdx];
    const curPt = sim.polyline[sim.currentIndex];

    const latitude = curPt[0] + (nxt[0] - curPt[0]) * sim.segmentProgress;
    const longitude = curPt[1] + (nxt[1] - curPt[1]) * sim.segmentProgress;
    const heading = calculateBearing(curPt[0], curPt[1], nxt[0], nxt[1]);
    const speed = Math.round(sim.currentSpeed * 10) / 10;

    const occupancy = calculateOccupancy(sim.passengerCount, sim.capacity);

    try {
      await prisma.bus.update({
        where: { id: busId },
        data: { latitude, longitude, heading, speed, passengerCount: sim.passengerCount },
      });
    } catch (error) {
      logger.error('Simulation: failed to update bus', { busId, error });
      continue;
    }

    updates.push({
      busId,
      routeId: sim.routeId,
      routeNumber: sim.routeNumber,
      latitude,
      longitude,
      heading,
      speed,
      passengerCount: sim.passengerCount,
      capacity: sim.capacity,
      occupancy,
      isSimulated: true,
    });
  }

  // Broadcast to admin and passenger namespaces
  try {
    const adminNs = getAdminNamespace();
    adminNs.emit('buses:update', updates);
  } catch { /* namespace may not be connected yet */ }

  try {
    const passengerNs = getPassengerNamespace();
    passengerNs.emit('buses:update', updates);
  } catch { /* namespace may not be connected yet */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nearestStopDistance(lat: number, lng: number, stops: StopInfo[]): number {
  if (stops.length === 0) return Infinity;
  let min = Infinity;
  for (const s of stops) {
    const d = haversineDistance(lat, lng, s.latitude, s.longitude);
    if (d < min) min = d;
  }
  return min;
}

function findNearestStop(lat: number, lng: number, stops: StopInfo[]): StopInfo | null {
  if (stops.length === 0) return null;
  let nearest: StopInfo | null = null;
  let min = Infinity;
  for (const s of stops) {
    const d = haversineDistance(lat, lng, s.latitude, s.longitude);
    if (d < min) {
      min = d;
      nearest = s;
    }
  }
  return nearest;
}

/**
 * Insert intermediate points between each pair of original polyline vertices
 * so that no segment exceeds `maxSegmentKm`. This produces a smoother path
 * for bus movement regardless of how far apart the original vertices are.
 */
function interpolatePolyline(
  points: [number, number][],
  _subdivisions: number,
): [number, number][] {
  const TARGET_SEGMENT_KM = 0.03; // ~30m segments
  const result: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[i + 1];
    const segDist = haversineDistance(lat1, lng1, lat2, lng2);
    const subdivisions = Math.max(1, Math.ceil(segDist / TARGET_SEGMENT_KM));

    for (let j = 0; j <= subdivisions; j++) {
      const t = j / subdivisions;
      result.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
    }
  }

  // Deduplicate neighbouring identical points
  return result.filter(
    (p, idx) => idx === 0 || p[0] !== result[idx - 1][0] || p[1] !== result[idx - 1][1],
  );
}

/**
 * Find the closest polyline vertex index to a given lat/lng.
 * Used for teleport-free simulation resume after driver disconnect.
 */
function findClosestPolylineIndex(
  lat: number,
  lng: number,
  polyline: [number, number][],
): number {
  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < polyline.length; i++) {
    const d = haversineDistance(lat, lng, polyline[i][0], polyline[i][1]);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }

  return minIdx;
}
