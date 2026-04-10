import { prisma } from '../../config/database';
import { getAdminNamespace, getPassengerNamespace } from '../../config/socket';
import { calculateBearing, haversineDistance } from '../../utils/geo';
import { logger } from '../../utils/logger';
import { isBusDriverControlled, isBusInGracePeriod, getLastDriverPosition, checkRouteFailsafe } from './hybrid-manager';

// ── Types ───────────────────────────────────────────────────────────────────

interface StopInfo {
  latitude: number;
  longitude: number;
  name: string;
}

interface SimulatedBus {
  busId: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  registrationNo: string;
  polyline: [number, number][];
  stops: StopInfo[];
  currentIndex: number;
  segmentProgress: number;
  direction: 1 | -1;
  capacity: number;
  currentSpeed: number;      // km/h
  trafficFactor: number;     // 1.0 – 1.3
  nearStopCooldown: number;  // ticks remaining to slow near stop
  dwellTicksRemaining: number; // ticks to pause at stop (dwell time)
}

interface BusUpdate {
  busId: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  registrationNo: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  isSimulated: boolean;
  isLiveDriver: boolean;
  lastUpdated: string;
  nearStop?: { name: string; arriving: boolean };
}

// ── Constants ───────────────────────────────────────────────────────────────

const UPDATE_INTERVAL_MS = 3_000;

// Realistic speed range
const MIN_SPEED_KMH = 20;
const MAX_SPEED_KMH = 40;
const STOP_SLOW_SPEED_KMH = 8;  // when within ~100m of a stop
const NEAR_STOP_DISTANCE_KM = 0.05; // 50 metres (stop detection radius)

// Traffic factor range
const MIN_TRAFFIC = 1.0;
const MAX_TRAFFIC = 1.3;
const TRAFFIC_CHANGE_RATE = 0.02;

// Stop dwell time: 2-5 ticks (6-15 seconds at 3s intervals)
const DWELL_TICKS_MIN = 2;
const DWELL_TICKS_MAX = 5;

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

/**
 * Start the simulation engine (fallback-only mode).
 * Only creates simulated buses for routes that have NO real drivers online.
 */
export async function startSimulation(): Promise<void> {
  logger.info('Starting simulation engine (fallback mode) …');

  const routes = await prisma.route.findMany({
    include: { stops: { orderBy: { stopOrder: 'asc' } } },
  });

  if (routes.length === 0) {
    logger.warn('No routes in database — seed routes before enabling simulation');
    return;
  }

  // Remove any leftover simulated buses from previous runs
  await prisma.bus.deleteMany({ where: { isSimulated: true } });

  // Check which routes already have real drivers online
  const routesWithDrivers = await prisma.bus.findMany({
    where: { status: 'ACTIVE', isSimulated: false },
    select: { routeId: true },
    distinct: ['routeId'],
  });
  const coveredRouteIds = new Set(routesWithDrivers.map(b => b.routeId).filter(Boolean));

  let createdCount = 0;

  for (const route of routes) {
    // Skip routes already covered by real drivers
    if (coveredRouteIds.has(route.id)) {
      logger.info(`Simulation: skipping route ${route.routeNumber} — covered by real driver`);
      continue;
    }

    await addSimulatedBusForRoute(route);
    createdCount++;
  }

  logger.info(`Simulation running — ${createdCount} fallback buses across ${routes.length} routes`);

  if (!interval) {
    interval = setInterval(tick, UPDATE_INTERVAL_MS);
  }

  // Route failsafe: check every 5 minutes for routes with no coverage
  if (!failsafeInterval) {
    failsafeInterval = setInterval(checkRouteFailsafe, 5 * 60 * 1000);
  }
}

/**
 * Add a simulated bus for a specific route (used by hybrid manager on driver disconnect).
 */
export async function addSimulatedBusForRoute(route: {
  id: string;
  routeNumber: string;
  name: string;
  polyline: string;
  stops: Array<{ latitude: number; longitude: number; name: string; stopOrder: number }>;
}): Promise<void> {
  // Check if route already has a simulated bus
  const existingSim = Array.from(activeBuses.values()).find(b => b.routeId === route.id);
  if (existingSim) return;

  // Build polyline
  let polyline: [number, number][];
  try {
    polyline = JSON.parse(route.polyline) as [number, number][];
  } catch {
    if (route.stops.length >= 2) {
      polyline = route.stops.map((s) => [s.latitude, s.longitude] as [number, number]);
    } else {
      return;
    }
  }

  if (polyline.length < 2) return;

  const smoothed = interpolatePolyline(polyline);

  // Build stop info
  const stops: StopInfo[] = route.stops.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    name: s.name,
  }));

  const startIdx = Math.floor(Math.random() * (smoothed.length - 1));

  const bus = await prisma.bus.create({
    data: {
      registrationNo: `SIM-${route.routeNumber}-01`,
      routeId: route.id,
      capacity: 52,
      passengerCount: 0,
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
    routeName: route.name,
    registrationNo: bus.registrationNo,
    polyline: smoothed,
    stops,
    currentIndex: startIdx,
    segmentProgress: 0,
    direction: Math.random() > 0.5 ? 1 : -1,
    capacity: 52,
    currentSpeed: MIN_SPEED_KMH + Math.random() * (MAX_SPEED_KMH - MIN_SPEED_KMH),
    trafficFactor: MIN_TRAFFIC + Math.random() * (MAX_TRAFFIC - MIN_TRAFFIC),
    nearStopCooldown: 0,
    dwellTicksRemaining: 0,
  });

  logger.info('Simulation: added fallback bus for route', { routeId: route.id, routeNumber: route.routeNumber, busId: bus.id });
}

/**
 * Remove all simulated buses for a route (called when real driver comes online).
 */
export async function removeSimulatedBusesForRoute(routeId: string): Promise<void> {
  const toRemove: string[] = [];

  for (const [busId, sim] of activeBuses) {
    if (sim.routeId === routeId) {
      toRemove.push(busId);
    }
  }

  for (const busId of toRemove) {
    activeBuses.delete(busId);
    wasDriverControlled.delete(busId);

    try {
      // Notify passengers the simulated bus is gone
      const passengerNs = getPassengerNamespace();
      passengerNs.emit('bus:offline', { busId });
    } catch { /* namespace may not be ready */ }

    try {
      const adminNs = getAdminNamespace();
      adminNs.emit('bus:offline', { busId });
    } catch { /* namespace may not be ready */ }

    // Delete from database
    try {
      await prisma.bus.delete({ where: { id: busId } });
    } catch {
      // Bus may already be deleted
    }
  }

  if (toRemove.length > 0) {
    logger.info('Simulation: removed fallback buses for route — real driver online', {
      routeId,
      removedCount: toRemove.length,
    });
  }
}

/**
 * Check if a route has simulated bus coverage.
 */
export function hasSimulatedCoverage(routeId: string): boolean {
  for (const sim of activeBuses.values()) {
    if (sim.routeId === routeId) return true;
  }
  return false;
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
  const now = new Date().toISOString();

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

    // ── Stop dwell: if paused at a stop, count down ──
    if (sim.dwellTicksRemaining > 0) {
      sim.dwellTicksRemaining--;

      const nearestStop = findNearestStop(cur[0], cur[1], sim.stops);
      updates.push({
        busId,
        routeId: sim.routeId,
        routeNumber: sim.routeNumber,
        routeName: sim.routeName,
        registrationNo: sim.registrationNo,
        latitude: cur[0],
        longitude: cur[1],
        heading: 0,
        speed: 0,
        isSimulated: true,
        isLiveDriver: false,
        lastUpdated: now,
        nearStop: nearestStop ? { name: nearestStop.name, arriving: true } : undefined,
      });
      continue;
    }

    // Check proximity to nearest stop
    const nearestStopDist = nearestStopDistance(cur[0], cur[1], sim.stops);
    const isNearStop = nearestStopDist < NEAR_STOP_DISTANCE_KM;
    const nearestStop = isNearStop ? findNearestStop(cur[0], cur[1], sim.stops) : null;

    // ── Stop dwell trigger: start dwelling when arriving at a stop ──
    if (isNearStop && sim.nearStopCooldown === 0) {
      sim.dwellTicksRemaining = DWELL_TICKS_MIN + Math.floor(Math.random() * (DWELL_TICKS_MAX - DWELL_TICKS_MIN + 1));
      sim.nearStopCooldown = sim.dwellTicksRemaining + 3; // prevent re-triggering

      updates.push({
        busId,
        routeId: sim.routeId,
        routeNumber: sim.routeNumber,
        routeName: sim.routeName,
        registrationNo: sim.registrationNo,
        latitude: cur[0],
        longitude: cur[1],
        heading: 0,
        speed: 0,
        isSimulated: true,
        isLiveDriver: false,
        lastUpdated: now,
        nearStop: nearestStop ? { name: nearestStop.name, arriving: true } : undefined,
      });

      // Update DB with stopped position
      try {
        await prisma.bus.update({
          where: { id: busId },
          data: { latitude: cur[0], longitude: cur[1], speed: 0 },
        });
      } catch { /* non-critical */ }

      continue;
    }

    // Decrement cooldown
    if (sim.nearStopCooldown > 0) sim.nearStopCooldown--;

    // Evolve traffic factor slowly
    sim.trafficFactor += (Math.random() - 0.5) * TRAFFIC_CHANGE_RATE;
    sim.trafficFactor = Math.max(MIN_TRAFFIC, Math.min(MAX_TRAFFIC, sim.trafficFactor));

    // Determine target speed
    let targetSpeed: number;
    if (isNearStop) {
      targetSpeed = STOP_SLOW_SPEED_KMH;
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
        sim.segmentProgress = 0;
        break;
      } else if (sim.currentIndex <= 0) {
        sim.direction = 1;
        sim.currentIndex = 1;
        sim.segmentProgress = 0;
        break;
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

    try {
      await prisma.bus.update({
        where: { id: busId },
        data: { latitude, longitude, heading, speed },
      });
    } catch (error) {
      logger.error('Simulation: failed to update bus', { busId, error });
      continue;
    }

    updates.push({
      busId,
      routeId: sim.routeId,
      routeNumber: sim.routeNumber,
      routeName: sim.routeName,
      registrationNo: sim.registrationNo,
      latitude,
      longitude,
      heading,
      speed,
      isSimulated: true,
      isLiveDriver: false,
      lastUpdated: now,
      nearStop: nearestStop ? { name: nearestStop.name, arriving: true } : undefined,
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
 * so that no segment exceeds ~30m. This produces a smoother path
 * for bus movement regardless of how far apart the original vertices are.
 */
function interpolatePolyline(
  points: [number, number][],
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
