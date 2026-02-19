import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { getAdminNamespace } from '../../config/socket';
import { NotificationType } from '@prisma/client';

export class AdminService {
  async getPendingDrivers() {
    const drivers = await prisma.driver.findMany({
      where: {
        approved: false,
        deletedAt: null,
        user: {
          status: 'PENDING', // Filter by user status instead of driverStatus
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return drivers.map((d) => ({
      id: d.id,
      fullName: d.user.name,
      email: d.user.email,
      phone: d.user.phone,
      licenseNumber: d.licenseNumber,
      createdAt: d.createdAt,
      userId: d.user.id,
    }));
  }

  async approveDriver(driverId: string) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');
    if (driver.approved) throw new AppError('Driver already approved', 400, 'ALREADY_APPROVED');

    // Find an available bus (no driver assigned)
    const availableBus = await prisma.bus.findFirst({
      where: {
        driver: null, // No driver assigned
        status: 'OFFLINE', // Bus is offline
      },
      include: {
        route: true, // Include route info for complete payload
      },
      orderBy: { createdAt: 'asc' }, // First come first served
    });

    if (!availableBus) {
      throw new AppError('No available buses to assign', 400, 'NO_BUSES_AVAILABLE');
    }

    // Update driver status and assign bus
    const updated = await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: {
          approved: true,
          driverStatus: 'OFFLINE',
          busId: availableBus.id, // Assign bus
        },
      }),
      prisma.user.update({
        where: { id: driver.userId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    // Emit socket event to driver namespace with complete bus info
    const io = getAdminNamespace().server;
    const driverNamespace = io.of('/driver');
    driverNamespace.to(driver.userId).emit('driver:approved', {
      driverId,
      busId: availableBus.id,
      busRegistrationNo: availableBus.registrationNo,
      registrationNo: availableBus.registrationNo, // Frontend expects this field name
      capacity: availableBus.capacity,
      routeId: availableBus.route?.id,
      routeNumber: availableBus.route?.routeNumber,
      routeName: availableBus.route?.name,
      message: 'Your driver application has been approved and bus assigned',
    });

    // Emit to admin namespace
    getAdminNamespace().emit('driver:approval-updated', {
      driverId,
      action: 'approved',
      busId: availableBus.id,
    });

    // Create notification
    await this.createNotification({
      type: 'DRIVER_APPROVED',
      title: 'Driver Approved',
      message: `${driver.user.name} has been approved and assigned bus ${availableBus.registrationNo}`,
      metadata: { driverId, userId: driver.userId, busId: availableBus.id },
    });

    logger.info('Driver approved and bus assigned', { 
      driverId, 
      userId: driver.userId, 
      busId: availableBus.id,
      busReg: availableBus.registrationNo,
    });
    
    return updated[0];
  }

  async rejectDriver(driverId: string) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');

    // Update driver status
    const updated = await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: {
          approved: false,
          driverStatus: 'REJECTED',
        },
      }),
      prisma.user.update({
        where: { id: driver.userId },
        data: { status: 'SUSPENDED' },
      }),
    ]);

    // Emit socket event
    const io = getAdminNamespace().server;
    const driverNamespace = io.of('/driver');
    driverNamespace.to(driver.userId).emit('driver:rejected', {
      driverId,
      message: 'Your driver application has been rejected',
    });

    // Emit to admin namespace
    getAdminNamespace().emit('driver:approval-updated', {
      driverId,
      action: 'rejected',
    });

    // Create notification
    await this.createNotification({
      type: 'DRIVER_REJECTED',
      title: 'Driver Rejected',
      message: `${driver.user.name}'s application has been rejected`,
      metadata: { driverId, userId: driver.userId },
    });

    logger.info('Driver rejected', { driverId, userId: driver.userId });
    return updated[0];
  }

  async getNotifications(unreadOnly: boolean = false) {
    const where = unreadOnly ? { read: false } : {};
    
    return prisma.adminNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markNotificationRead(notificationId: string) {
    return prisma.adminNotification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllNotificationsRead() {
    return prisma.adminNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
  }

  async createNotification(data: {
    type: NotificationType;
    title: string;
    message: string;
    metadata?: any;
  }) {
    const notification = await prisma.adminNotification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
      },
    });

    // Emit to admin namespace
    getAdminNamespace().emit('notification:new', notification);

    return notification;
  }

  async getDashboardSummary() {
    const [
      pendingDrivers,
      unreadNotifications,
      activeBuses,
      activeDrivers,
    ] = await Promise.all([
      prisma.driver.count({
        where: { approved: false, driverStatus: 'PENDING', deletedAt: null },
      }),
      prisma.adminNotification.count({
        where: { read: false },
      }),
      prisma.bus.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.driver.count({
        where: { approved: true, driverStatus: { in: ['ONLINE', 'ON_TRIP'] } },
      }),
    ]);

    return {
      pendingDrivers,
      openComplaints: 0, // TODO: implement complaints
      unreadNotifications,
      activeBuses,
      activeDrivers,
     };
  }

  async getAvailableBuses() {
    return prisma.bus.findMany({
      where: {
        driver: null, // No driver assigned
      },
      orderBy: { registrationNo: 'asc' },
      select: {
        id: true,
        registrationNo: true,
        capacity: true,
        status: true,
      },
    });
  }

  async assignBusToDriver(driverId: string, busId: string) {
    // Verify driver exists and is approved
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');
    if (!driver.approved) throw new AppError('Driver must be approved first', 400, 'NOT_APPROVED');

    // Verify bus exists and is available
    const bus = await prisma.bus.findUnique({
      where: { id: busId },
      include: { driver: true, route: { select: { routeNumber: true, name: true } } },
    });

    if (!bus) throw new AppError('Bus not found', 404, 'NOT_FOUND');
    if (bus.driver) throw new AppError('Bus already assigned to another driver', 400, 'BUS_ASSIGNED');

    // Assign bus to driver
    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { busId },
      include: { user: true, bus: { include: { route: true } } },
    });

    // Emit real-time event to connected driver (reactive update - no re-login needed)
    const io = getAdminNamespace().server;
    const driverNamespace = io.of('/driver');
    driverNamespace.to(driver.userId).emit('driver:bus-assigned', {
      driverId,
      busId: bus.id,
      registrationNo: bus.registrationNo,
      routeId: bus.routeId,
      routeNumber: bus.route?.routeNumber,
      routeName: bus.route?.name,
      capacity: bus.capacity,
      message: `Bus ${bus.registrationNo} has been assigned to you`,
    });

    logger.info('Bus assigned to driver (real-time event emitted)', { driverId, busId, busReg: bus.registrationNo, userId: driver.userId });
    
    return updated;
  }
}
