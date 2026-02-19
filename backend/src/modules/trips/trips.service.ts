import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

export class TripsService {
  async start(busId: string) {
    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) throw new AppError('Bus not found', 404);

    const active = await prisma.trip.findFirst({ where: { busId, status: 'IN_PROGRESS' } });
    if (active) throw new AppError('Bus already has an active trip', 400);

    const trip = await prisma.trip.create({ data: { busId } });
    await prisma.bus.update({ where: { id: busId }, data: { status: 'ACTIVE' } });

    logger.info('Trip started', { tripId: trip.id, busId });
    return trip;
  }

  async complete(tripId: string) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.status !== 'IN_PROGRESS') throw new AppError('Trip is not in progress', 400);

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'COMPLETED', endTime: new Date() },
    });

    logger.info('Trip completed', { tripId });
    return updated;
  }

  async cancel(tripId: string) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.status !== 'IN_PROGRESS') throw new AppError('Trip is not in progress', 400);

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'CANCELLED', endTime: new Date() },
    });

    logger.info('Trip cancelled', { tripId });
    return updated;
  }

  async getByBus(busId: string) {
    return prisma.trip.findMany({
      where: { busId },
      orderBy: { startTime: 'desc' },
      take: 20,
    });
  }
}
