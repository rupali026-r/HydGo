// ── Live Bus Arrival Endpoint (Phase 10 — Fixed) ────────────────────────────
// GET /api/live-buses?originStop=<name>&destStop=<name>&originLat=&originLng=
//
// Returns ACTIVE buses approaching the origin stop, optionally filtered
// to only buses whose route also contains destStop.
// Sorted by ETA ascending. No walking calculations.
//
// BUG FIX: hasBusPassed was async but called without await — always truthy.
// BUG FIX: N+1 stop queries eliminated — batch load per-route stops once.

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

const router = Router();

interface LiveBusResult {
  busId: string;
  registrationNo: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeType: string;
  distanceMeters: number;
  etaMinutes: number;
  etaFormatted: string;
  occupancyLevel: string;
  occupancyPercent: number;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  reliability: number;
  confidence: number;
  isLive: boolean;
  isSimulated: boolean;
  passengerCount: number;
  capacity: number;
}

/**
 * GET /api/live-buses
 * Query params:
 *   originStop  — origin stop name (required unless coords given)
 *   destStop    — destination stop name (optional, filters to routes serving both)
 *   originLat   — origin latitude  (fallback stop resolution)
 *   originLng   — origin longitude (fallback stop resolution)
 *   routeId     — explicit route ID to filter (optional, limits to single route)
 */
router.get('/', async (req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    const originName = (req.query.originStop as string) || undefined;
    const destName = (req.query.destStop as string) || undefined;
    const originLat = parseFloat(req.query.originLat as string) || 0;
    const originLng = parseFloat(req.query.originLng as string) || 0;
    const routeIdFilter = (req.query.routeId as string) || undefined;

    if (!originName && originLat === 0 && originLng === 0 && !routeIdFilter) {
      return res.status(400).json({
        error: 'Required: originStop (name) or originLat + originLng, or routeId',
      });
    }

    // ── 1. Resolve origin stop ──────────────────────────────────────────
    const originStop = await resolveStop(originName, originLat, originLng);
    if (!originStop && !routeIdFilter) {
      return res.json({
        status: 'ok',
        originStop: originName || 'Unknown',
        buses: [],
        count: 0,
        durationMs: Date.now() - startMs,
      });
    }

    logger.info(`[LiveBuses] Origin: "${originStop?.name ?? 'coords-only'}"`);

    // ── 2. Find ALL routes that contain origin stop name ────────────────
    const originRouteStops = originStop ? await prisma.stop.findMany({
      where: { name: { equals: originStop.name, mode: 'insensitive' } },
      select: {
        routeId: true,
        stopOrder: true,
        latitude: true,
        longitude: true,
        route: {
          select: {
            id: true,
            routeNumber: true,
            name: true,
            routeType: true,
            avgSpeed: true,
            distance: true,
          },
        },
      },
    }) : [];

    let validRouteStops = originRouteStops;

    // ── 2b. If destStop given, filter to routes that also contain it ────
    if (destName) {
      const destRouteStops = await prisma.stop.findMany({
        where: { name: { contains: destName, mode: 'insensitive' } },
        select: { routeId: true, stopOrder: true },
      });
      const destRouteMap = new Map<string, number>();
      for (const ds of destRouteStops) {
        destRouteMap.set(ds.routeId, ds.stopOrder);
      }
      // Keep only routes where originStopOrder < destStopOrder (bus hasn't passed dest)
      validRouteStops = originRouteStops.filter((ors) => {
        const destOrder = destRouteMap.get(ors.routeId);
        return destOrder !== undefined && ors.stopOrder < destOrder;
      });
      logger.info(`[LiveBuses] Dest filter "${destName}": ${validRouteStops.length}/${originRouteStops.length} routes`);
    }

    // ── 2c. If explicit routeId given, keep only that route ─────────────
    if (routeIdFilter) {
      validRouteStops = validRouteStops.filter((rs) => rs.routeId === routeIdFilter);

      // If origin stop wasn't on this route, find the nearest stop on the route
      if (validRouteStops.length === 0) {
        const routeStops = await prisma.stop.findMany({
          where: { routeId: routeIdFilter },
          orderBy: { stopOrder: 'asc' },
          select: {
            routeId: true,
            stopOrder: true,
            latitude: true,
            longitude: true,
            route: {
              select: {
                id: true,
                routeNumber: true,
                name: true,
                routeType: true,
                avgSpeed: true,
                distance: true,
              },
            },
          },
        });
        if (routeStops.length > 0) {
          // Find the stop nearest to origin coords
          let best = routeStops[0];
          let bestDist = Infinity;
          const refLat = originStop?.latitude ?? originLat;
          const refLng = originStop?.longitude ?? originLng;
          if (refLat && refLng) {
            for (const s of routeStops) {
              const d = haversineDistance(refLat, refLng, s.latitude, s.longitude);
              if (d < bestDist) { bestDist = d; best = s; }
            }
          }
          validRouteStops = [best];
        }
      }
      logger.info(`[LiveBuses] RouteId filter "${routeIdFilter}": ${validRouteStops.length} stops`);
    }

    const routeIds = [...new Set(validRouteStops.map((rs) => rs.routeId))];

    if (routeIds.length === 0) {
      return res.json({
        status: 'ok',
        originStop: originStop?.name ?? originName ?? 'Unknown',
        destStop: destName,
        buses: [],
        count: 0,
        durationMs: Date.now() - startMs,
      });
    }

    // ── 3. Batch load all stops for these routes (fix N+1) ──────────────
    const allRouteStops = await prisma.stop.findMany({
      where: { routeId: { in: routeIds } },
      orderBy: { stopOrder: 'asc' },
      select: { routeId: true, stopOrder: true, latitude: true, longitude: true },
    });
    const stopsByRoute = new Map<string, Array<{ stopOrder: number; latitude: number; longitude: number }>>();
    for (const s of allRouteStops) {
      if (!stopsByRoute.has(s.routeId)) stopsByRoute.set(s.routeId, []);
      stopsByRoute.get(s.routeId)!.push(s);
    }

    // ── 4. Find all ACTIVE buses on qualifying routes ───────────────────
    const activeBuses = await prisma.bus.findMany({
      where: {
        routeId: { in: routeIds },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        registrationNo: true,
        routeId: true,
        latitude: true,
        longitude: true,
        heading: true,
        speed: true,
        passengerCount: true,
        capacity: true,
        isSimulated: true,
      },
    });

    logger.info(`[LiveBuses] Active buses on ${routeIds.length} routes: ${activeBuses.length}`);

    // ── 5. Compute distance + ETA, filter passed buses (SYNC) ───────────
    const results: LiveBusResult[] = [];

    for (const bus of activeBuses) {
      const rs = validRouteStops.find((r) => r.routeId === bus.routeId);
      if (!rs) continue;

      const stopLat = rs.latitude;
      const stopLng = rs.longitude;
      const route = rs.route;

      const distKm = haversineDistance(bus.latitude, bus.longitude, stopLat, stopLng);
      const distMeters = Math.round(distKm * 1000);

      // Synchronous hasBusPassed — uses pre-loaded stops
      const routeStopList = stopsByRoute.get(bus.routeId!) ?? [];
      const alreadyPassed = hasBusPassed(bus, rs.stopOrder, routeStopList);

      // Skip buses that already passed (allow <200m — bus basically at stop)
      if (alreadyPassed && distMeters > 200) continue;

      // ETA: distance / speed, fallback to route avgSpeed
      const effectiveSpeed = bus.speed > 2 ? bus.speed : (route.avgSpeed ?? 25);
      const etaMinutes = Math.max(1, Math.round((distKm / effectiveSpeed) * 60));

      const etaFormatted = etaMinutes < 1
        ? 'Arriving now'
        : etaMinutes < 60
          ? `${etaMinutes} min`
          : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`;

      const occupancyPercent = bus.capacity > 0
        ? Math.round((bus.passengerCount / bus.capacity) * 100) : 0;
      const occupancyLevel =
        occupancyPercent >= 90 ? 'FULL'
        : occupancyPercent >= 70 ? 'HIGH'
        : occupancyPercent >= 40 ? 'MEDIUM'
        : 'LOW';

      const reliability = Math.min(95, 70 + (bus.speed > 5 ? 15 : 0) + (!bus.isSimulated ? 10 : 0));
      const confidence = Math.min(0.95, 0.65 + (bus.speed > 2 ? 0.15 : 0) + (!bus.isSimulated ? 0.1 : 0) + (distKm < 3 ? 0.05 : 0));

      results.push({
        busId: bus.id,
        registrationNo: bus.registrationNo,
        routeId: bus.routeId!,
        routeNumber: route.routeNumber,
        routeName: route.name,
        routeType: route.routeType,
        distanceMeters: distMeters,
        etaMinutes,
        etaFormatted,
        occupancyLevel,
        occupancyPercent,
        speed: bus.speed,
        heading: bus.heading,
        latitude: bus.latitude,
        longitude: bus.longitude,
        reliability,
        confidence,
        isLive: !bus.isSimulated,
        isSimulated: bus.isSimulated,
        passengerCount: bus.passengerCount,
        capacity: bus.capacity,
      });
    }

    // ── 6. Sort by ETA ascending, then distance ─────────────────────────
    results.sort((a, b) => a.etaMinutes - b.etaMinutes || a.distanceMeters - b.distanceMeters);

    const durationMs = Date.now() - startMs;
    logger.info(`[LiveBuses] Returning ${results.length} buses in ${durationMs}ms`);

    return res.json({
      status: 'ok',
      originStop: originStop?.name ?? originName ?? 'Unknown',
      originLat: originStop?.latitude ?? originLat,
      originLng: originStop?.longitude ?? originLng,
      destStop: destName ?? null,
      routeIdFilter: routeIdFilter ?? null,
      buses: results,
      count: results.length,
      durationMs,
    });
  } catch (error: any) {
    logger.error('[LiveBuses] Error', { error: error.message });
    return res.status(500).json({ error: 'Live bus lookup failed', message: error.message });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ResolvedStop {
  name: string;
  latitude: number;
  longitude: number;
  routeId: string;
  stopOrder: number;
}

async function resolveStop(
  name?: string,
  lat?: number,
  lng?: number,
): Promise<ResolvedStop | null> {
  if (name && name !== 'Current Location') {
    const exact = await prisma.stop.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { name: true, latitude: true, longitude: true, routeId: true, stopOrder: true },
    });
    if (exact) return exact;

    const allStops = await prisma.stop.findMany({
      select: { name: true, latitude: true, longitude: true, routeId: true, stopOrder: true },
      distinct: ['name'],
    });
    const q = name.toLowerCase().trim();
    const fuzzy = allStops.find(
      (s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()),
    );
    if (fuzzy) return fuzzy;
  }

  if (lat && lng && lat !== 0 && lng !== 0) {
    const allStops = await prisma.stop.findMany({
      select: { name: true, latitude: true, longitude: true, routeId: true, stopOrder: true },
      distinct: ['name'],
    });
    let best: ResolvedStop | null = null;
    let bestDist = 3.0;
    for (const s of allStops) {
      const d = haversineDistance(lat, lng, s.latitude, s.longitude);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  }

  return null;
}

/**
 * SYNCHRONOUS hasBusPassed — uses pre-loaded stops array.
 * Returns true if bus's nearest stop is AFTER the origin stop.
 */
function hasBusPassed(
  bus: { latitude: number; longitude: number },
  originStopOrder: number,
  routeStops: Array<{ stopOrder: number; latitude: number; longitude: number }>,
): boolean {
  if (routeStops.length === 0) return false;

  let nearestOrder = 0;
  let nearestDist = Infinity;
  for (const s of routeStops) {
    const d = haversineDistance(bus.latitude, bus.longitude, s.latitude, s.longitude);
    if (d < nearestDist) {
      nearestDist = d;
      nearestOrder = s.stopOrder;
    }
  }

  return nearestOrder > originStopOrder;
}

/** Haversine distance in km */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
