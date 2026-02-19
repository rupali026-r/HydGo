import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

// ── Hybrid Simulation Override Manager ──────────────────────────────────────
//
// Tracks which buses have active real-driver connections.
// The simulation engine consults this manager to skip driver-controlled buses.
// When a driver disconnects, a grace period prevents instant simulation takeover.
//
// Concurrency protections:
//   - Registration is idempotent per busId
//   - Only one grace timer per bus (no double resume)
//   - Multi-driver conflict blocked (BUS_ALREADY_CONTROLLED)
//   - State transitions are guarded by in-flight lock set
//
// ────────────────────────────────────────────────────────────────────────────

const GRACE_PERIOD_MS = 10_000; // 10 seconds before simulation resumes
const ROUTE_FAILSAFE_MS = 30 * 60 * 1000; // 30 minutes

// Bus IDs with active real-driver control
const activeDriverBusIds = new Set<string>();

// Map busId → driverId for multi-driver conflict detection
const busDriverOwnership = new Map<string, string>();

// Grace period timers per busId
const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Buses currently in transition (lock to prevent race conditions)
const busesInTransition = new Set<string>();

// Track which routes have real drivers (routeId → Set<busId>)
const routeDriverBuses = new Map<string, Set<string>>();

// Last time a route had a real driver
const routeLastDriverTime = new Map<string, number>();

// Last known real-driver position per bus (for simulation resume without teleport)
const lastDriverPosition = new Map<string, { latitude: number; longitude: number }>();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Attempt to register a bus as driver-controlled.
 * Returns { success: true } or { success: false, code, message } for conflicts.
 *
 * - Cancels any pending grace timer (rapid reconnect)
 * - Blocks if another driver already controls this bus
 * - Guards against race conditions via busesInTransition lock
 */
export function registerDriverBus(
  busId: string,
  driverId: string,
  routeId?: string,
): { success: true } | { success: false; code: string; message: string } {
  // ── Multi-driver conflict check ──
  const currentOwner = busDriverOwnership.get(busId);
  if (currentOwner && currentOwner !== driverId && activeDriverBusIds.has(busId)) {
    logger.warn('Hybrid: multi-driver conflict — bus already controlled', {
      busId,
      existingDriverId: currentOwner,
      attemptingDriverId: driverId,
    });
    return {
      success: false,
      code: 'BUS_ALREADY_CONTROLLED',
      message: 'This bus is already controlled by another driver',
    };
  }

  // ── Transition lock ──
  if (busesInTransition.has(busId)) {
    logger.warn('Hybrid: bus is mid-transition, register deferred', { busId });
    return {
      success: false,
      code: 'BUS_IN_TRANSITION',
      message: 'Bus is currently transitioning control states',
    };
  }

  busesInTransition.add(busId);

  try {
    // Cancel any pending grace timer (handles rapid reconnect)
    const timer = graceTimers.get(busId);
    if (timer) {
      clearTimeout(timer);
      graceTimers.delete(busId);
      logger.info('Hybrid: grace period cancelled — driver reconnected', { busId, driverId });
    }

    activeDriverBusIds.add(busId);
    busDriverOwnership.set(busId, driverId);

    // Track route coverage
    if (routeId) {
      if (!routeDriverBuses.has(routeId)) {
        routeDriverBuses.set(routeId, new Set());
      }
      routeDriverBuses.get(routeId)!.add(busId);
      routeLastDriverTime.set(routeId, Date.now());
    }

    logger.info('Hybrid: bus registered as driver-controlled', { busId, driverId, routeId });
    return { success: true };
  } finally {
    busesInTransition.delete(busId);
  }
}

/**
 * Unregister a bus from driver control (driver disconnected).
 * Starts a grace period before the simulation can resume for this bus.
 *
 * - Only one grace timer per bus (previous timer cancelled if exists)
 * - Records last known position for teleport-free simulation resume
 * - Race-safe: if reconnect happens at 9.9s, grace timer is cancelled in registerDriverBus
 */
export function unregisterDriverBus(
  busId: string,
  driverId: string,
  routeId?: string,
  onGraceExpired?: () => Promise<void>,
): void {
  // Verify ownership — only the controlling driver can unregister
  const currentOwner = busDriverOwnership.get(busId);
  if (currentOwner && currentOwner !== driverId) {
    logger.warn('Hybrid: unregister rejected — not the controlling driver', {
      busId,
      currentOwner,
      attemptingDriverId: driverId,
    });
    return;
  }

  // Cancel any existing grace timer for this bus (prevents double resume)
  const existingTimer = graceTimers.get(busId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    graceTimers.delete(busId);
  }

  // Start grace period — don't immediately hand back to simulation
  const timer = setTimeout(async () => {
    // Guard: if bus was re-registered during grace period, abort
    if (busDriverOwnership.get(busId) !== driverId) {
      graceTimers.delete(busId);
      return;
    }

    busesInTransition.add(busId);
    try {
      activeDriverBusIds.delete(busId);
      busDriverOwnership.delete(busId);
      graceTimers.delete(busId);

      // Remove from route tracking
      if (routeId) {
        const buses = routeDriverBuses.get(routeId);
        if (buses) {
          buses.delete(busId);
          if (buses.size === 0) {
            routeDriverBuses.delete(routeId);
          }
        }
      }

      // Re-activate bus for simulation using last known location
      try {
        const lastPos = lastDriverPosition.get(busId);
        const updateData: Record<string, unknown> = {
          status: 'ACTIVE',
          isSimulated: true,
          speed: 0,
        };
        if (lastPos) {
          updateData.latitude = lastPos.latitude;
          updateData.longitude = lastPos.longitude;
        }
        await prisma.bus.update({
          where: { id: busId },
          data: updateData,
        });
      } catch (error) {
        logger.error('Hybrid: failed to reactivate bus after grace period', { busId, error });
      }

      // Clean up last position
      lastDriverPosition.delete(busId);

      // Execute deferred actions (bus:offline, trip cancel, etc.)
      if (onGraceExpired) {
        try {
          await onGraceExpired();
        } catch (err) {
          logger.error('Hybrid: onGraceExpired callback failed', { busId, error: err });
        }
      }

      logger.info('Hybrid: grace period expired — bus released to simulation', { busId, routeId });
    } finally {
      busesInTransition.delete(busId);
    }
  }, GRACE_PERIOD_MS);

  graceTimers.set(busId, timer);
  logger.info('Hybrid: driver disconnected — grace period started', {
    busId,
    driverId,
    gracePeriodMs: GRACE_PERIOD_MS,
  });
}

/**
 * Record the last known position from a real driver update.
 * Used for teleport-free simulation resume.
 */
export function recordDriverPosition(busId: string, latitude: number, longitude: number): void {
  lastDriverPosition.set(busId, { latitude, longitude });
}

/**
 * Get last known driver position for a bus (used by simulation resume).
 */
export function getLastDriverPosition(busId: string): { latitude: number; longitude: number } | undefined {
  return lastDriverPosition.get(busId);
}

/**
 * Check if a bus is currently controlled by a real driver.
 * Used by the simulation engine to skip this bus in its tick loop.
 */
export function isBusDriverControlled(busId: string): boolean {
  return activeDriverBusIds.has(busId);
}

/**
 * Check if a bus is in the grace period (driver disconnected, sim not yet resumed).
 */
export function isBusInGracePeriod(busId: string): boolean {
  return graceTimers.has(busId);
}

/**
 * Get set of all driver-controlled bus IDs.
 */
export function getActiveDriverBusIds(): ReadonlySet<string> {
  return activeDriverBusIds;
}

/**
 * Get the driver ID controlling a given bus, or undefined.
 */
export function getBusOwnerDriverId(busId: string): string | undefined {
  return busDriverOwnership.get(busId);
}

/**
 * Get hybrid status summary for admin dashboard.
 */
export async function getHybridStatus(): Promise<{
  totalBuses: number;
  simulatedBuses: number;
  realDriverBuses: number;
  activeDriverBusIds: string[];
}> {
  const [totalActive, simCount] = await Promise.all([
    prisma.bus.count({ where: { status: 'ACTIVE' } }),
    prisma.bus.count({ where: { status: 'ACTIVE', isSimulated: true } }),
  ]);

  const realCount = activeDriverBusIds.size;

  return {
    totalBuses: totalActive,
    simulatedBuses: simCount,
    realDriverBuses: realCount,
    activeDriverBusIds: Array.from(activeDriverBusIds),
  };
}

/**
 * Check for routes with no coverage (no sim + no real driver for > 30 min).
 * Called periodically as a failsafe.
 */
export async function checkRouteFailsafe(): Promise<void> {
  try {
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        routeNumber: true,
        buses: {
          where: { status: 'ACTIVE' },
          select: { id: true, isSimulated: true },
        },
      },
    });

    const now = Date.now();

    for (const route of routes) {
      const hasActiveBus = route.buses.length > 0;
      const hasRealDriver = routeDriverBuses.has(route.id) && routeDriverBuses.get(route.id)!.size > 0;

      if (!hasActiveBus && !hasRealDriver) {
        const lastDriverTime = routeLastDriverTime.get(route.id);
        const sinceLastDriver = lastDriverTime ? now - lastDriverTime : Infinity;

        if (sinceLastDriver > ROUTE_FAILSAFE_MS) {
          logger.warn('Hybrid failsafe: route has no coverage for >30 min', {
            routeId: route.id,
            routeNumber: route.routeNumber,
            sinceLastDriverMin: Math.round(sinceLastDriver / 60_000),
          });
        }
      }
    }
  } catch (error) {
    logger.error('Hybrid failsafe check failed', { error });
  }
}

/**
 * Clean up all timers and state on shutdown.
 */
export function cleanupHybridManager(): void {
  for (const timer of graceTimers.values()) {
    clearTimeout(timer);
  }
  graceTimers.clear();
  activeDriverBusIds.clear();
  busDriverOwnership.clear();
  busesInTransition.clear();
  routeDriverBuses.clear();
  routeLastDriverTime.clear();
  lastDriverPosition.clear();
  logger.info('Hybrid manager cleaned up');
}
