import { DriverStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

// ── Valid state transitions ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DriverStatus, DriverStatus[]> = {
  PENDING:       ['OFFLINE'],
  OFFLINE:       ['ONLINE'],
  ONLINE:        ['ON_TRIP', 'IDLE', 'DISCONNECTED', 'OFFLINE'],
  ON_TRIP:       ['ONLINE', 'DISCONNECTED', 'OFFLINE'],
  IDLE:          ['ONLINE', 'DISCONNECTED', 'OFFLINE'],
  DISCONNECTED:  ['ONLINE', 'OFFLINE'],
  REJECTED:      [],
};

// ── Idle detection ──────────────────────────────────────────────────────────

const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Track last activity per driver (in-memory for fast checks)
const lastActivity = new Map<string, number>();
let idleCheckInterval: ReturnType<typeof setInterval> | null = null;

// ── Public API ──────────────────────────────────────────────────────────────

export class DriverStateService {
  /**
   * Attempt a state transition. Returns true if successful.
   * Logs transition and updates the database.
   */
  async transition(
    driverId: string,
    toState: DriverStatus,
    reason: string,
  ): Promise<boolean> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, driverStatus: true },
    });

    if (!driver) {
      logger.warn('Driver state transition failed — driver not found', { driverId, toState });
      return false;
    }

    const fromState = driver.driverStatus;

    // Force-transitions: DISCONNECTED and OFFLINE always allowed
    const isForced = toState === 'DISCONNECTED' || toState === 'OFFLINE';
    if (!isForced && !VALID_TRANSITIONS[fromState]?.includes(toState)) {
      logger.warn('Invalid driver state transition', { driverId, fromState, toState, reason });
      return false;
    }

    // No-op if already in target state
    if (fromState === toState) return true;

    // Apply transition
    await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: toState },
      }),
      prisma.driverStateLog.create({
        data: { driverId, fromState, toState, reason },
      }),
    ]);

    logger.info('Driver state transition', { driverId, fromState, toState, reason });
    return true;
  }

  /** Record activity timestamp for idle detection */
  recordActivity(driverId: string): void {
    lastActivity.set(driverId, Date.now());
  }

  /** Remove driver from activity tracking */
  removeDriver(driverId: string): void {
    lastActivity.delete(driverId);
  }

  /** Get current state from DB */
  async getState(driverId: string): Promise<DriverStatus | null> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { driverStatus: true },
    });
    return driver?.driverStatus ?? null;
  }

  /** Get driver state counts for admin dashboard */
  async getStateCounts(): Promise<Record<DriverStatus, number>> {
    const results = await prisma.driver.groupBy({
      by: ['driverStatus'],
      where: { approved: true, deletedAt: null },
      _count: { _all: true },
    });

    const counts: Record<DriverStatus, number> = {
      PENDING: 0,
      OFFLINE: 0,
      ONLINE: 0,
      ON_TRIP: 0,
      IDLE: 0,
      DISCONNECTED: 0,
      REJECTED: 0,
    };

    for (const r of results) {
      counts[r.driverStatus] = r._count._all;
    }

    return counts;
  }

  /** Start periodic idle detection */
  startIdleDetection(): void {
    if (idleCheckInterval) return;

    idleCheckInterval = setInterval(async () => {
      const now = Date.now();

      for (const [driverId, lastTime] of lastActivity) {
        if (now - lastTime > IDLE_THRESHOLD_MS) {
          const driver = await prisma.driver.findUnique({
            where: { id: driverId },
            select: { driverStatus: true },
          });

          if (driver && driver.driverStatus === 'ONLINE') {
            await this.transition(driverId, 'IDLE', 'No location update for 5 minutes');
          }
        }
      }
    }, 60_000); // check every minute
  }

  /** Stop idle detection */
  stopIdleDetection(): void {
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
    lastActivity.clear();
  }
}

// Singleton instance
export const driverStateService = new DriverStateService();
