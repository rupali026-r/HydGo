import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

export class DriversService {
  async getPending() {
    return prisma.driver.findMany({
      where: {
        approved: false,
        deletedAt: null,
        user: {
          status: 'PENDING',
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(driverId: string) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true },
    });
    if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');
    if (driver.approved) throw new AppError('Driver already approved', 400, 'ALREADY_APPROVED');

    // Find available bus (optional — driver can be approved without bus)
    const availableBus = await prisma.bus.findFirst({
      where: { driver: null, status: 'OFFLINE', isSimulated: false },
      include: { route: true },
      orderBy: { createdAt: 'asc' },
    });

    const [updated] = await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: {
          approved: true,
          driverStatus: 'OFFLINE',
          ...(availableBus ? { busId: availableBus.id } : {}),
        },
      }),
      prisma.user.update({ where: { id: driver.userId }, data: { status: 'ACTIVE' } }),
    ]);

    // Emit socket event to driver namespace
    try {
      const { getAdminNamespace } = await import('../../config/socket');
      const io = getAdminNamespace().server;
      const driverNamespace = io.of('/driver');
      driverNamespace.to(driver.userId).emit('driver:approved', {
        driverId,
        busId: availableBus?.id ?? null,
        registrationNo: availableBus?.registrationNo ?? null,
        capacity: availableBus?.capacity ?? null,
        routeId: availableBus?.route?.id ?? null,
        routeNumber: availableBus?.route?.routeNumber ?? null,
        routeName: availableBus?.route?.name ?? null,
        message: availableBus
          ? 'Your driver application has been approved and bus assigned'
          : 'Your driver application has been approved. A bus will be assigned soon.',
      });

      // Emit to admin namespace
      getAdminNamespace().emit('driver:approval-updated', {
        driverId,
        action: 'approved',
      });

      // Create notification
      await prisma.adminNotification.create({
        data: {
          type: 'DRIVER_APPROVED',
          title: 'Driver Approved',
          message: `${driver.user.name} has been approved as a driver`,
          metadata: { driverId, userId: driver.userId },
        },
      });
    } catch (err) {
      logger.warn('Failed to emit driver approval notification', { error: err });
    }

    logger.info('Driver approved', { driverId });
    return updated;
  }

  async getProfile(userId: string) {
    const driver = await prisma.driver.findUnique({
      where: { userId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
        bus: { include: { route: true } },
      },
    });
    if (!driver) throw new AppError('Driver profile not found', 404, 'NOT_FOUND');
    return driver;
  }

  async updateBusLocation(
    userId: string,
    latitude: number,
    longitude: number,
    heading?: number,
    speed?: number,
  ) {
    const driver = await prisma.driver.findUnique({
      where: { userId },
      include: { bus: true },
    });

    if (!driver) throw new AppError('Driver profile not found', 404, 'NOT_FOUND');
    if (!driver.approved) throw new AppError('Driver not approved', 403, 'DRIVER_NOT_APPROVED');
    if (!driver.bus) throw new AppError('No bus assigned to this driver', 400, 'NO_BUS_ASSIGNED');

    return prisma.bus.update({
      where: { id: driver.bus.id },
      data: { latitude, longitude, heading: heading ?? 0, speed: speed ?? 0 },
    });
  }

  async getActiveTrip(userId: string) {
    const driver = await prisma.driver.findUnique({ where: { userId }, include: { bus: true } });
    if (!driver?.bus) return null;

    return prisma.trip.findFirst({
      where: { busId: driver.bus.id, status: 'IN_PROGRESS' },
      include: {
        bus: { include: { route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } } } },
      },
    });
  }

  async assignBus(driverId: string, busId: string) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');
    if (!driver.approved) throw new AppError('Driver not approved', 400, 'NOT_APPROVED');

    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) throw new AppError('Bus not found', 404, 'BUS_NOT_FOUND');

    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { busId },
      include: { bus: true, user: { select: { name: true, email: true } } },
    });

    logger.info('Bus assigned to driver', { driverId, busId });
    return updated;
  }
}
