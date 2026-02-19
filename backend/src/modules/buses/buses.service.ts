import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { haversineDistance } from '../../utils/geo';
import { calculateOccupancy } from '../../utils/occupancy';
import { calculateETA } from '../../utils/eta';

interface NearbyBusRow {
  id: string;
  latitude: number;
  longitude: number;
  passengerCount: number;
  capacity: number;
  heading: number;
  speed: number;
  registrationNo: string;
  routeId: string | null;
  routeNumber: string | null;
  routeName: string | null;
  routeType: string | null;
  avgSpeed: number | null;
  distance: number;
}

export class BusesService {
  /**
   * Find buses within `radiusKm` of the given point using PostGIS ST_DWithin.
   * Falls back to Haversine-based filtering when PostGIS is unavailable.
   */
  async getNearby(latitude: number, longitude: number, radiusKm = 5) {
    const radiusMeters = radiusKm * 1000;

    try {
      const rows = await prisma.$queryRaw<NearbyBusRow[]>`
        SELECT
          b.id, b.latitude, b.longitude, b."passengerCount", b.capacity,
          b.heading, b.speed, b."registrationNo", b."routeId",
          r."routeNumber", r.name AS "routeName", r."routeType", r."avgSpeed",
          ST_Distance(
            ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          ) AS distance
        FROM buses b
        LEFT JOIN routes r ON b."routeId" = r.id
        WHERE b.status = 'ACTIVE'
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance ASC
        LIMIT 50
      `;

      return rows.map((bus) => ({
        id: bus.id,
        registrationNo: bus.registrationNo,
        routeNumber: bus.routeNumber,
        routeName: bus.routeName,
        routeType: bus.routeType,
        latitude: bus.latitude,
        longitude: bus.longitude,
        heading: bus.heading,
        speed: bus.speed,
        distanceMeters: Math.round(bus.distance),
        occupancy: calculateOccupancy(bus.passengerCount, bus.capacity),
        eta: calculateETA(bus.latitude, bus.longitude, latitude, longitude, bus.avgSpeed ?? 30),
      }));
    } catch {
      // Fallback: Haversine in-app
      return this.getNearbyFallback(latitude, longitude, radiusKm);
    }
  }

  /** In-app Haversine fallback when PostGIS is not available */
  private async getNearbyFallback(latitude: number, longitude: number, radiusKm: number) {
    const buses = await prisma.bus.findMany({
      where: { status: 'ACTIVE' },
      include: { route: { select: { routeNumber: true, name: true, routeType: true, avgSpeed: true } } },
    });

    return buses
      .map((bus) => ({
        ...bus,
        distanceKm: haversineDistance(latitude, longitude, bus.latitude, bus.longitude),
      }))
      .filter((b) => b.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 50)
      .map((bus) => ({
        id: bus.id,
        registrationNo: bus.registrationNo,
        routeNumber: bus.route?.routeNumber ?? null,
        routeName: bus.route?.name ?? null,
        routeType: bus.route?.routeType ?? null,
        latitude: bus.latitude,
        longitude: bus.longitude,
        heading: bus.heading,
        speed: bus.speed,
        distanceMeters: Math.round(bus.distanceKm * 1000),
        occupancy: calculateOccupancy(bus.passengerCount, bus.capacity),
        eta: calculateETA(bus.latitude, bus.longitude, latitude, longitude, bus.route?.avgSpeed ?? 30),
      }));
  }

  async getAllActive() {
    const buses = await prisma.bus.findMany({
      where: { status: 'ACTIVE' },
      include: {
        route: { select: { routeNumber: true, name: true, routeType: true, avgSpeed: true } },
        driver: { include: { user: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return buses.map((bus) => ({
      ...bus,
      occupancy: calculateOccupancy(bus.passengerCount, bus.capacity),
    }));
  }

  async findById(id: string) {
    const bus = await prisma.bus.findUnique({
      where: { id },
      include: {
        route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
        trips: { where: { status: 'IN_PROGRESS' }, take: 1 },
      },
    });
    if (!bus) throw new AppError('Bus not found', 404);
    return { ...bus, occupancy: calculateOccupancy(bus.passengerCount, bus.capacity) };
  }
}
