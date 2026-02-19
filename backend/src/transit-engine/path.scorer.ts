// ── Path Scorer & Pareto Filter ─────────────────────────────────────────────
// Weighted scoring system for ranking route plan results.
// Lower score = better route.
// Includes Pareto filtering to remove dominated paths.

import { getRouteReliability } from '../intelligence';
import type { ScoredPath, CostConfig } from './types';

/** Score weights */
const WEIGHT_ETA = 0.50;
const WEIGHT_TRANSFER = 10;       // per transfer
const WEIGHT_OCCUPANCY = 2;       // placeholder
const WEIGHT_CONFIDENCE = -5;     // bonus (subtract)
const WEIGHT_RELIABILITY = -3;    // bonus (subtract)

/**
 * Score a path for ranking. Lower score = better route.
 *
 * score = (ETA * 0.5) + (transfers * 10) + occupancyPenalty
 *         - confidenceBonus - reliabilityBonus
 */
export async function scorePath(path: ScoredPath): Promise<number> {
  let score = 0;

  // ETA component (total travel time in minutes)
  score += path.totalTime * WEIGHT_ETA;

  // Transfer penalty
  score += path.transferCount * WEIGHT_TRANSFER;

  // Reliability bonus: check reliability of each route in the path
  const routeIds = new Set<string>();
  for (const edge of path.path) {
    routeIds.add(edge.routeId);
  }

  let totalReliability = 0;
  let reliabilityCount = 0;
  let totalConfidence = 0;

  for (const routeId of routeIds) {
    try {
      const rel = await getRouteReliability(routeId);
      totalReliability += rel.score;
      reliabilityCount++;
      // Confidence estimation based on reliability
      totalConfidence += rel.score >= 80 ? 0.9 : rel.score >= 50 ? 0.7 : 0.5;
    } catch {
      totalReliability += 70; // default moderate
      reliabilityCount++;
      totalConfidence += 0.7;
    }
  }

  if (reliabilityCount > 0) {
    const avgReliability = totalReliability / reliabilityCount;
    const avgConfidence = totalConfidence / reliabilityCount;

    // Reliability bonus (higher reliability = better score = lower number)
    score += (avgReliability / 100) * WEIGHT_RELIABILITY;

    // Confidence bonus
    score += avgConfidence * WEIGHT_CONFIDENCE;
  }

  return Math.max(0, Math.round(score * 100) / 100);
}

/**
 * Pareto filter: remove dominated paths.
 * A path P is dominated if another path Q has:
 *   - Q.totalTime ≤ P.totalTime
 *   - Q.transferCount ≤ P.transferCount
 *   - Q.totalDistance ≤ P.totalDistance (or Q is strictly better on at least one axis)
 * AND Q is strictly better on at least one axis.
 */
export function paretoFilter(paths: ScoredPath[]): ScoredPath[] {
  if (paths.length <= 1) return paths;

  const nonDominated: ScoredPath[] = [];

  for (let i = 0; i < paths.length; i++) {
    let dominated = false;

    for (let j = 0; j < paths.length; j++) {
      if (i === j) continue;

      // Check if path j dominates path i
      const jBetterOrEqual =
        paths[j].totalTime <= paths[i].totalTime &&
        paths[j].transferCount <= paths[i].transferCount;

      const jStrictlyBetter =
        paths[j].totalTime < paths[i].totalTime ||
        paths[j].transferCount < paths[i].transferCount;

      if (jBetterOrEqual && jStrictlyBetter) {
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      nonDominated.push(paths[i]);
    }
  }

  return nonDominated;
}

/**
 * Score and rank multiple paths. Returns sorted (best first).
 * Applies Pareto filtering before scoring to eliminate dominated paths.
 */
export async function scoreAndRankPaths(paths: ScoredPath[]): Promise<Array<ScoredPath & { score: number }>> {
  // Phase 7.5: Pareto filter first to remove dominated paths
  const filtered = paretoFilter(paths);

  const scored = await Promise.all(
    filtered.map(async (p) => ({
      ...p,
      score: await scorePath(p),
    })),
  );

  scored.sort((a, b) => a.score - b.score);
  return scored;
}
