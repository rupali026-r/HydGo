import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { driverStateService } from './driver-state.service';
import { getHybridStatus } from '../simulation/hybrid-manager';
import { logger } from '../../utils/logger';

// ── Admin Live Control Controller ───────────────────────────────────────────
//
// GET /api/admin/live-driver-status
//
// Returns real-time hybrid system status:
//   - Total active buses
//   - Simulated vs real-driver bus counts
//   - Driver state counts (online, idle, offline, etc.)
//   - Active push notification token count
//
// ────────────────────────────────────────────────────────────────────────────

export class AdminLiveController {
  async getLiveDriverStatus(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Get hybrid status (in-memory + DB counts)
      const hybrid = await getHybridStatus();

      // Get driver state counts
      const stateCounts = await driverStateService.getStateCounts();

      // Count registered push tokens
      const pushTokenCount = await prisma.user.count({
        where: {
          pushToken: { not: null },
          status: 'ACTIVE',
        },
      });

      // Get per-route breakdown
      const routeBreakdown = await prisma.route.findMany({
        select: {
          id: true,
          routeNumber: true,
          name: true,
          buses: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              isSimulated: true,
              registrationNo: true,
              passengerCount: true,
              capacity: true,
              driver: {
                select: {
                  driverStatus: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { routeNumber: 'asc' },
      });

      const routes = routeBreakdown.map((r) => ({
        routeId: r.id,
        routeNumber: r.routeNumber,
        routeName: r.name,
        totalBuses: r.buses.length,
        simulatedBuses: r.buses.filter((b) => b.isSimulated).length,
        realDriverBuses: r.buses.filter((b) => !b.isSimulated).length,
        buses: r.buses.map((b) => ({
          id: b.id,
          registrationNo: b.registrationNo,
          isSimulated: b.isSimulated,
          passengerCount: b.passengerCount,
          capacity: b.capacity,
          driverStatus: b.driver?.driverStatus ?? null,
          driverName: b.driver?.user?.name ?? null,
        })),
      }));

      res.json({
        success: true,
        data: {
          totalBuses: hybrid.totalBuses,
          simulatedBuses: hybrid.simulatedBuses,
          realDriverBuses: hybrid.realDriverBuses,
          activeDriverBusIds: hybrid.activeDriverBusIds,
          driversOnline: stateCounts.ONLINE,
          driversOnTrip: stateCounts.ON_TRIP,
          driversIdle: stateCounts.IDLE,
          driversOffline: stateCounts.OFFLINE,
          driversDisconnected: stateCounts.DISCONNECTED,
          activePushTokens: pushTokenCount,
          routes,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get live driver status', { error });
      next(error);
    }
  }
}
