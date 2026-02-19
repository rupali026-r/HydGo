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

    // Try to find an existing unassigned real bus
    let assignedBus = await prisma.bus.findFirst({
      where: { driver: null, isSimulated: false },
      include: { route: true },
      orderBy: { createdAt: 'asc' },
    });

    // If no real bus available, auto-create one on a random route
    if (!assignedBus) {
      const route = await prisma.route.findFirst({ orderBy: { createdAt: 'asc' } });
      const driverCount = await prisma.driver.count();
      const regNo = `TS-${String(driverCount + 1).padStart(4, '0')}`;

      assignedBus = await prisma.bus.create({
        data: {
          registrationNo: regNo,
          routeId: route?.id ?? null,
          capacity: 52,
          status: 'OFFLINE',
          isSimulated: false,
          latitude: 17.385,
          longitude: 78.4867,
        },
        include: { route: true },
      });
      logger.info('Auto-created bus for driver', { busId: assignedBus.id, regNo });
    }

    const [updated] = await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: {
          approved: true,
          driverStatus: 'OFFLINE',
          busId: assignedBus.id,
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
        busId: assignedBus.id,
        registrationNo: assignedBus.registrationNo,
        capacity: assignedBus.capacity,
        routeId: assignedBus.route?.id ?? null,
        routeNumber: assignedBus.route?.routeNumber ?? null,
        routeName: assignedBus.route?.name ?? null,
        message: 'Your driver application has been approved and bus assigned',
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

    logger.info('Driver approved', { driverId, busId: assignedBus.id });
    return updated;
  }

  async getProfile(userId: string) {
    let driver = await prisma.driver.findUnique({
      where: { userId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
        bus: { include: { route: true } },
      },
    });
    if (!driver) throw new AppError('Driver profile not found', 404, 'NOT_FOUND');

    // Auto-assign bus if approved but none assigned
    if (driver.approved && !driver.bus) {
      let bus = await prisma.bus.findFirst({
        where: { driver: null, isSimulated: false },
        include: { route: true },
      });
      if (!bus) {
        const route = await prisma.route.findFirst({ orderBy: { createdAt: 'asc' } });
        const driverCount = await prisma.driver.count();
        const regNo = `TS-${String(driverCount + 1).padStart(4, '0')}`;
        bus = await prisma.bus.create({
          data: {
            registrationNo: regNo,
            routeId: route?.id ?? null,
            capacity: 52,
            status: 'OFFLINE',
            isSimulated: false,
            latitude: 17.385,
            longitude: 78.4867,
          },
          include: { route: true },
        });
      }
      await prisma.driver.update({ where: { id: driver.id }, data: { busId: bus.id } });
      // Re-fetch with bus included
      driver = await prisma.driver.findUnique({
        where: { userId, deletedAt: null },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, status: true } },
          bus: { include: { route: true } },
        },
      });
      if (!driver) throw new AppError('Driver profile not found', 404, 'NOT_FOUND');
    }

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
