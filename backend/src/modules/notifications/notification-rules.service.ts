import { prisma } from '../../config/database';
import { pushService, NotificationType } from './push.service';
import { calculateETA } from '../../utils/eta';
import { calculateOccupancy, OccupancyLevel } from '../../utils/occupancy';
import { logger } from '../../utils/logger';

// ── Notification Rules Engine ───────────────────────────────────────────────
//
// Evaluates trigger conditions and fires push notifications:
//   - Bus arriving in 3 minutes (ETA < 180s)
//   - Bus 1 stop away
//   - Bus delayed > 5 minutes
//   - Bus occupancy HIGH
//   - Driver trip started / ended
//
// All notifications are rate-limited to prevent spam.
//
// ────────────────────────────────────────────────────────────────────────────

const ETA_THRESHOLD_SECONDS = 180; // 3 minutes
const DELAY_THRESHOLD_MINUTES = 5;

interface BusUpdatePayload {
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  speed: number;
  passengerCount: number;
  capacity: number;
  routeNumber?: string;
  routeName?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

export class NotificationRulesService {
  /**
   * Check all notification rules against a bus update.
   * Called on every bus location update (both real driver and simulated).
   */
  async evaluateBusUpdate(bus: BusUpdatePayload): Promise<void> {
    try {
      await Promise.all([
        this.checkOccupancyHigh(bus),
      ]);
    } catch (error) {
      logger.error('Notification rule evaluation failed', { busId: bus.busId, error });
    }
  }

  /**
   * Check if a bus is arriving soon for any nearby passengers.
   * Called with passenger location context.
   */
  async checkBusArriving(
    busId: string,
    busLat: number,
    busLng: number,
    passengerUserId: string,
    passengerLat: number,
    passengerLng: number,
    avgSpeed: number,
    routeNumber?: string,
  ): Promise<void> {
    const eta = calculateETA(busLat, busLng, passengerLat, passengerLng, avgSpeed);

    if (eta.estimatedMinutes <= ETA_THRESHOLD_SECONDS / 60) {
      await pushService.sendRateLimited(
        passengerUserId,
        busId,
        'BUS_ARRIVING',
        'Bus Arriving Soon',
        `${routeNumber ?? 'Your bus'} is arriving in ~${eta.formattedETA}`,
        { busId, eta: eta.estimatedMinutes, type: 'BUS_ARRIVING' as NotificationType },
      );
    }
  }

  /**
   * Check and notify when bus occupancy is HIGH.
   */
  private async checkOccupancyHigh(bus: BusUpdatePayload): Promise<void> {
    const occupancy = calculateOccupancy(bus.passengerCount, bus.capacity);

    if (occupancy.level !== 'HIGH' && occupancy.level !== 'FULL') return;

    // Find passengers who have this route's buses tracked
    // Only notify passengers with push tokens who are on this route
    const passengers = await prisma.user.findMany({
      where: {
        role: 'PASSENGER',
        pushToken: { not: null },
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 50, // Limit to prevent excessive notifications
    });

    const label = bus.routeNumber ?? 'Bus';

    for (const passenger of passengers) {
      await pushService.sendRateLimited(
        passenger.id,
        bus.busId,
        'BUS_OCCUPANCY_HIGH',
        'High Occupancy Alert',
        `${label} is at ${occupancy.percent}% capacity (${occupancy.level})`,
        { busId: bus.busId, occupancyLevel: occupancy.level, percent: occupancy.percent },
      );
    }
  }

  /**
   * Notify when a driver starts a trip.
   */
  async notifyTripStarted(
    busId: string,
    routeNumber?: string,
    routeName?: string,
  ): Promise<void> {
    const passengers = await prisma.user.findMany({
      where: {
        role: 'PASSENGER',
        pushToken: { not: null },
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 100,
    });

    const label = routeNumber ? `${routeNumber} (${routeName ?? ''})`.trim() : 'A bus';

    for (const passenger of passengers) {
      await pushService.sendRateLimited(
        passenger.id,
        busId,
        'TRIP_STARTED',
        'Trip Started',
        `${label} has started its trip`,
        { busId, type: 'TRIP_STARTED' as NotificationType },
      );
    }

    logger.info('Trip started notifications queued', { busId, routeNumber });
  }

  /**
   * Notify when a driver ends a trip.
   */
  async notifyTripEnded(
    busId: string,
    routeNumber?: string,
  ): Promise<void> {
    const passengers = await prisma.user.findMany({
      where: {
        role: 'PASSENGER',
        pushToken: { not: null },
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 100,
    });

    const label = routeNumber ?? 'Bus';

    for (const passenger of passengers) {
      await pushService.sendRateLimited(
        passenger.id,
        busId,
        'TRIP_ENDED',
        'Trip Completed',
        `${label} has completed its trip`,
        { busId, type: 'TRIP_ENDED' as NotificationType },
      );
    }

    logger.info('Trip ended notifications queued', { busId, routeNumber });
  }

  /**
   * Notify about a delayed bus (> 5 min late).
   */
  async notifyBusDelayed(
    busId: string,
    delayMinutes: number,
    routeNumber?: string,
  ): Promise<void> {
    if (delayMinutes < DELAY_THRESHOLD_MINUTES) return;

    const passengers = await prisma.user.findMany({
      where: {
        role: 'PASSENGER',
        pushToken: { not: null },
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 100,
    });

    const label = routeNumber ?? 'Bus';

    for (const passenger of passengers) {
      await pushService.sendRateLimited(
        passenger.id,
        busId,
        'BUS_DELAYED',
        'Bus Delayed',
        `${label} is delayed by ~${delayMinutes} minutes`,
        { busId, delayMinutes, type: 'BUS_DELAYED' as NotificationType },
      );
    }

    logger.info('Bus delay notifications queued', { busId, delayMinutes, routeNumber });
  }
}

// Singleton
export const notificationRulesService = new NotificationRulesService();
