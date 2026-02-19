import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { AddStopInput } from './stops.schema';
import { logger } from '../../utils/logger';

// ── Haversine distance (metres) ────────────────────────────────────────────
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class StopsService {
  async create(data: AddStopInput) {
    const route = await prisma.route.findUnique({ where: { id: data.routeId } });
    if (!route) throw new AppError('Route not found', 404);

    const existing = await prisma.stop.findUnique({
      where: { routeId_stopOrder: { routeId: data.routeId, stopOrder: data.stopOrder } },
    });
    if (existing) throw new AppError(`Stop order ${data.stopOrder} already exists on this route`, 409);

    const stop = await prisma.stop.create({ data });

    logger.info('Stop added', { stopId: stop.id, routeId: data.routeId, order: data.stopOrder });
    return stop;
  }

  async getAll() {
    return prisma.stop.findMany({
      orderBy: { name: 'asc' },
      include: { route: { select: { routeNumber: true, name: true } } },
    });
  }

  async getByRoute(routeId: string) {
    return prisma.stop.findMany({
      where: { routeId },
      orderBy: { stopOrder: 'asc' },
    });
  }

  /**
   * Returns up to `limit` unique-named stops within `radiusMetres` of the
   * given coordinates, sorted by distance ascending.
   */
  async getNearby(lat: number, lng: number, radiusMetres: number, limit = 20) {
    const all = await prisma.stop.findMany({
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        routeId: true,
        stopOrder: true,
        route: { select: { routeNumber: true, name: true } },
      },
    });

    // Compute distance and filter
    const withDist = all
      .map((s) => ({ ...s, distanceMetres: haversineMetres(lat, lng, s.latitude, s.longitude) }))
      .filter((s) => s.distanceMetres <= radiusMetres)
      .sort((a, b) => a.distanceMetres - b.distanceMetres);

    // Deduplicate by stop name (keep shortest-distance record)
    const seen = new Set<string>();
    const results: typeof withDist = [];
    for (const s of withDist) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        results.push(s);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Full-text stop search by name (case-insensitive prefix/substring).
   * Returns up to 15 deduplicated unique stop names.
   */
  async search(q: string) {
    if (!q || q.trim().length < 2) return [];

    const stops = await prisma.stop.findMany({
      where: { name: { contains: q.trim(), mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        routeId: true,
        stopOrder: true,
        route: { select: { routeNumber: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Deduplicate by name
    const seen = new Set<string>();
    const results: typeof stops = [];
    for (const s of stops) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        results.push(s);
        if (results.length >= 15) break;
      }
    }
    return results;
  }

  async delete(id: string) {
    const stop = await prisma.stop.findUnique({ where: { id } });
    if (!stop) throw new AppError('Stop not found', 404);
    await prisma.stop.delete({ where: { id } });
    logger.info('Stop deleted', { stopId: id });
  }
}
