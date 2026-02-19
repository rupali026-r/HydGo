import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { AddRouteInput } from './routes.schema';
import { logger } from '../../utils/logger';

export class RoutesService {
  async create(data: AddRouteInput) {
    const existing = await prisma.route.findUnique({ where: { routeNumber: data.routeNumber } });
    if (existing) throw new AppError('Route number already exists', 409);

    const route = await prisma.route.create({
      data: {
        routeNumber: data.routeNumber,
        name: data.name,
        routeType: data.routeType,
        polyline: data.polyline,
        avgSpeed: data.avgSpeed ?? 30,
        distance: data.distance ?? 0,
      },
    });

    logger.info('Route created', { routeId: route.id, routeNumber: route.routeNumber });
    return route;
  }

  async findById(id: string) {
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
        buses: { where: { status: 'ACTIVE' }, select: { id: true, registrationNo: true, latitude: true, longitude: true, passengerCount: true, capacity: true } },
      },
    });
    if (!route) throw new AppError('Route not found', 404);
    return route;
  }

  async findAll() {
    return prisma.route.findMany({
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { buses: true } },
      },
      orderBy: { routeNumber: 'asc' },
    });
  }
}
