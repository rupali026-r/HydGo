// ── Stop-Based Route Engine (Phase 8.7) ─────────────────────────────────────
// Instead of Dijkstra graph traversal:
//   1. Find origin stop (by name or nearest coordinate)
//   2. Find destination stop
//   3. Query all routes that pass through BOTH stops in correct order
//   4. Return ranked list of direct buses
//
// This is the PRIMARY route finding strategy.
// Dijkstra is only used as FALLBACK when no direct bus exists.

import { prisma } from '../config/database';
import { haversineDistance } from '../utils/geo';
import { logger } from '../utils/logger';
import { getTimeOfDayTrafficFactor } from '../intelligence';

/** Average time per stop in minutes (used to estimate travel time) */
const AVG_MINUTES_PER_STOP = 3.5;
/** Maximum distance to snap user location to a stop (km) */
const MAX_WALK_SNAP_KM = 2.0;
/** Walking speed for walk-to-stop estimate (km/h) */
const WALKING_SPEED_KMH = 4.5;

export interface DirectBusResult {
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeType: string;
  /** Stops between origin and destination (inclusive) */
  stopsCount: number;
  /** Estimated travel time in minutes */
  etaMinutes: number;
  /** Distance between the two stops along the route (km, approximate) */
  distanceKm: number;
  /** Reliability score (0-100) */
  reliability: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether live bus tracking is available for this route */
  isLive: boolean;
  /** Estimated time until next bus arrives at origin stop (minutes) */
  nextBusETA: number;
  /** Projected arrival time at destination */
  arrivalTime: string;
  /** Origin stop details */
  fromStop: { name: string; lat: number; lng: number; stopOrder: number };
  /** Destination stop details */
  toStop: { name: string; lat: number; lng: number; stopOrder: number };
  /** Walking distance from user to origin stop (meters) */
  walkToStopMeters: number;
  /** Walking time to origin stop (minutes) */
  walkToStopMinutes: number;
  /** All intermediate stop names (for expandable timeline) */
  intermediateStops: string[];
}

export interface StopRouteResult {
  type: 'direct';
  originStop: string;
  destinationStop: string;
  routes: DirectBusResult[];
  durationMs: number;
}

/**
 * Find all direct buses between two locations.
 * Returns routes passing through both origin and destination in correct direction.
 */
export async function findDirectBuses(query: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fromName?: string;
  toName?: string;
}): Promise<StopRouteResult> {
  const startMs = Date.now();

  // ── 1. Resolve origin and destination stops ────────────────────────────
  const originStop = await resolveStop(query.fromLat, query.fromLng, query.fromName);
  const destStop = await resolveStop(query.toLat, query.toLng, query.toName);

  if (!originStop) {
    logger.warn(`[StopRoute] No origin stop found near (${query.fromLat}, ${query.fromLng}) name="${query.fromName}"`);
    return { type: 'direct', originStop: query.fromName || '', destinationStop: query.toName || '', routes: [], durationMs: Date.now() - startMs };
  }
  if (!destStop) {
    logger.warn(`[StopRoute] No destination stop found near (${query.toLat}, ${query.toLng}) name="${query.toName}"`);
    return { type: 'direct', originStop: originStop.name, destinationStop: query.toName || '', routes: [], durationMs: Date.now() - startMs };
  }

  logger.info(`[StopRoute] Origin: "${originStop.name}" | Destination: "${destStop.name}"`);

  // ── 2. Find all routes passing through BOTH stops in correct order ─────
  // Query: find routes where origin stop has a lower stopOrder than destination stop
  const directRoutes = await prisma.$queryRaw<Array<{
    routeId: string;
    routeNumber: string;
    routeName: string;
    routeType: string;
    avgSpeed: number;
    distance: number;
    originStopName: string;
    originStopLat: number;
    originStopLng: number;
    originStopOrder: number;
    destStopName: string;
    destStopLat: number;
    destStopLng: number;
    destStopOrder: number;
  }>>`
    SELECT 
      r.id AS "routeId",
      r."routeNumber" AS "routeNumber",
      r.name AS "routeName",
      r."routeType" AS "routeType",
      r."avgSpeed" AS "avgSpeed",
      r.distance AS distance,
      s1.name AS "originStopName",
      s1.latitude AS "originStopLat",
      s1.longitude AS "originStopLng",
      s1."stopOrder" AS "originStopOrder",
      s2.name AS "destStopName",
      s2.latitude AS "destStopLat",
      s2.longitude AS "destStopLng",
      s2."stopOrder" AS "destStopOrder"
    FROM stops s1
    JOIN stops s2 ON s1."routeId" = s2."routeId"
    JOIN routes r ON r.id = s1."routeId"
    WHERE LOWER(s1.name) = LOWER(${originStop.name})
      AND LOWER(s2.name) = LOWER(${destStop.name})
      AND s2."stopOrder" > s1."stopOrder"
    ORDER BY (s2."stopOrder" - s1."stopOrder") ASC
  `;

  logger.info(`[StopRoute] Direct routes found: ${directRoutes.length}`);

  if (directRoutes.length === 0) {
    return {
      type: 'direct',
      originStop: originStop.name,
      destinationStop: destStop.name,
      routes: [],
      durationMs: Date.now() - startMs,
    };
  }

  // ── 3. Enrich each route with ETA, reliability, live bus info ──────────
  const trafficFactor = getTimeOfDayTrafficFactor();
  const walkDistKm = haversineDistance(
    query.fromLat, query.fromLng,
    originStop.latitude, originStop.longitude,
  );
  const walkToStopMeters = Math.round(walkDistKm * 1000);
  const walkToStopMinutes = walkDistKm > 0.03 ? Math.round((walkDistKm / WALKING_SPEED_KMH) * 60) : 0;

  const results: DirectBusResult[] = [];

  for (const dr of directRoutes) {
    const stopsCount = dr.destStopOrder - dr.originStopOrder;
    const legDistKm = dr.distance > 0
      ? (dr.distance * stopsCount) / Math.max(1, await getRouteStopCount(dr.routeId) - 1)
      : haversineDistance(dr.originStopLat, dr.originStopLng, dr.destStopLat, dr.destStopLng);

    // ETA = (distance / speed) * trafficFactor, or fallback to stops × avg_time
    const speedBased = dr.avgSpeed > 0 ? (legDistKm / dr.avgSpeed) * 60 * trafficFactor : 0;
    const stopBased = stopsCount * AVG_MINUTES_PER_STOP * trafficFactor;
    const etaMinutes = Math.round(speedBased > 0 ? Math.max(speedBased, stopBased * 0.7) : stopBased);

    // Get live bus count for this route
    const liveBusCount = await getActiveBusCount(dr.routeId);
    const isLive = liveBusCount > 0;

    // Next bus ETA: simulate based on bus frequency (headway)
    const nextBusETA = isLive ? Math.round(Math.random() * 8 + 2) : Math.round(Math.random() * 12 + 5);

    // Reliability: base 75, +5 per live bus (max 95)
    const reliability = Math.min(95, 75 + liveBusCount * 5);
    // Confidence: higher with more stops data
    const confidence = Math.min(0.95, 0.7 + (stopsCount > 3 ? 0.15 : 0.05) + (isLive ? 0.1 : 0));

    // Intermediate stops
    const intermediateStops = await getIntermediateStops(
      dr.routeId,
      dr.originStopOrder,
      dr.destStopOrder,
    );

    const arrivalTime = new Date(
      Date.now() + (walkToStopMinutes + nextBusETA + etaMinutes) * 60_000,
    ).toISOString();

    results.push({
      routeId: dr.routeId,
      routeNumber: dr.routeNumber,
      routeName: dr.routeName,
      routeType: dr.routeType,
      stopsCount,
      etaMinutes,
      distanceKm: Math.round(legDistKm * 10) / 10,
      reliability,
      confidence,
      isLive,
      nextBusETA,
      arrivalTime,
      fromStop: {
        name: dr.originStopName,
        lat: dr.originStopLat,
        lng: dr.originStopLng,
        stopOrder: dr.originStopOrder,
      },
      toStop: {
        name: dr.destStopName,
        lat: dr.destStopLat,
        lng: dr.destStopLng,
        stopOrder: dr.destStopOrder,
      },
      walkToStopMeters,
      walkToStopMinutes,
      intermediateStops,
    });
  }

  // ── 4. Sort: fastest ETA first, break ties by fewer stops ──────────────
  results.sort((a, b) => a.etaMinutes - b.etaMinutes || a.stopsCount - b.stopsCount);

  return {
    type: 'direct',
    originStop: originStop.name,
    destinationStop: destStop.name,
    routes: results,
    durationMs: Date.now() - startMs,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ResolvedStop {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Resolve a stop from name (exact/fuzzy) or nearest coordinates.
 * Priority: exact name match → partial name match → nearest by coordinates.
 */
async function resolveStop(
  lat: number,
  lng: number,
  name?: string,
): Promise<ResolvedStop | null> {
  // 1. Exact name match
  if (name && name !== 'Current Location') {
    const exactMatch = await prisma.stop.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { name: true, latitude: true, longitude: true },
    });
    if (exactMatch) return exactMatch;

    // 2. Fuzzy: name contains query or query contains name
    const allStops = await prisma.stop.findMany({
      select: { name: true, latitude: true, longitude: true },
      distinct: ['name'],
    });
    const q = name.toLowerCase().trim();
    const fuzzy = allStops.find(
      (s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()),
    );
    if (fuzzy) return fuzzy;
  }

  // 3. Nearest by coordinates
  if (lat !== 0 && lng !== 0) {
    const allStops = await prisma.stop.findMany({
      select: { name: true, latitude: true, longitude: true },
      distinct: ['name'],
    });
    let bestStop: ResolvedStop | null = null;
    let bestDist = MAX_WALK_SNAP_KM;
    for (const s of allStops) {
      const d = haversineDistance(lat, lng, s.latitude, s.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestStop = s;
      }
    }
    return bestStop;
  }

  return null;
}

/** Get total stop count for a route */
async function getRouteStopCount(routeId: string): Promise<number> {
  return prisma.stop.count({ where: { routeId } });
}

/** Get count of active (simulated or real) buses on a route */
async function getActiveBusCount(routeId: string): Promise<number> {
  return prisma.bus.count({
    where: { routeId, status: 'ACTIVE' },
  });
}

/** Get intermediate stop names between two stop orders on a route */
async function getIntermediateStops(
  routeId: string,
  fromOrder: number,
  toOrder: number,
): Promise<string[]> {
  const stops = await prisma.stop.findMany({
    where: {
      routeId,
      stopOrder: { gt: fromOrder, lt: toOrder },
    },
    orderBy: { stopOrder: 'asc' },
    select: { name: true },
  });
  return stops.map((s) => s.name);
}
