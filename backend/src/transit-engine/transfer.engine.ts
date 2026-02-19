// ── Transfer Engine ─────────────────────────────────────────────────────────
// Manages transfer logic: penalties, limits, and reliability-aware scoring.

import { getRouteReliability } from '../intelligence';
import type { RouteChange, CostConfig } from './types';
import { logger } from '../utils/logger';

/** Default transfer penalty in minutes */
const BASE_TRANSFER_PENALTY_MIN = 5;

/** Extra penalty per unreliable route segment (score < 50) */
const UNRELIABLE_ROUTE_PENALTY = 3;

/** Maximum number of transfers allowed (configurable) */
const DEFAULT_MAX_TRANSFERS = 2;

/**
 * Calculate the total transfer penalty for a route plan.
 * Accounts for:
 * - Base wait time per transfer (4–6 min)
 * - Unreliable route penalty
 * - Number of transfers
 */
export async function calculateTransferPenalty(
  routeChanges: RouteChange[],
  config?: Partial<CostConfig>,
): Promise<number> {
  const basePenalty = config?.transferPenaltyMin ?? BASE_TRANSFER_PENALTY_MIN;
  let totalPenalty = 0;

  for (const change of routeChanges) {
    // Base transfer wait time
    totalPenalty += basePenalty;

    // Reliability check on the route we're transferring TO
    try {
      const reliability = await getRouteReliability(change.toRouteId);
      if (reliability.score < 50) {
        totalPenalty += UNRELIABLE_ROUTE_PENALTY;
      }
    } catch {
      // Non-critical: use base penalty only
    }
  }

  return totalPenalty;
}

/**
 * Check if a transfer count is within limits.
 */
export function isTransferAllowed(
  currentTransfers: number,
  config?: Partial<CostConfig>,
): boolean {
  const max = config?.maxTransfers ?? DEFAULT_MAX_TRANSFERS;
  return currentTransfers <= max;
}

/**
 * Estimate wait time at a transfer point.
 * Could use live bus data in future; for now uses statistical estimate.
 */
export function estimateTransferWaitTime(
  routeId: string,
  _atNodeId: string,
): number {
  // Base: 5 minutes average wait
  // Future: query live bus positions on the target route
  // and estimate actual wait from nearest approaching bus
  return BASE_TRANSFER_PENALTY_MIN;
}

/**
 * Get the maximum allowed transfers.
 */
export function getMaxTransfers(config?: Partial<CostConfig>): number {
  return config?.maxTransfers ?? DEFAULT_MAX_TRANSFERS;
}
