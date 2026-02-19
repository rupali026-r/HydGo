// ── Route Engine (Hardened — Phase 7.5) ─────────────────────────────────────
// Orchestrates the full route planning pipeline:
// 1. Find top 3 nearest origin/destination nodes (walking optimization)
// 2. Run Dijkstra for each pair, collect best paths
// 3. Score paths (with Pareto filtering)
// 4. Serialize for UI
// 5. Smart cache bucketing (150m grid, 5min time window)
// 6. Failure resilience (Redis/DB down graceful handling)

import { findNearestNode, findNearestNodes, isLoaded, getNode, areConnected } from './graph.loader';
import { findShortestPaths, getLastDijkstraStats } from './dijkstra.engine';
import { scoreAndRankPaths } from './path.scorer';
import { serializeResults } from './route.serializer';
import { getTimeOfDayTrafficFactor, getRouteAverageSpeed } from '../intelligence';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import type { RoutePlanResult, RoutePlanQuery, CostConfig, ScoredPath } from './types';

/** Cache TTL in seconds */
const CACHE_TTL_SECONDS = 45;

/** Max distance to search for nearest stop (km) */
const MAX_NEAREST_STOP_KM = 5;

/** Number of nearest stops to consider for origin/destination */
const TOP_N_STOPS = 2;

// ── Cache metrics ───────────────────────────────────────────────────────────
let cacheHits = 0;
let cacheMisses = 0;
let totalRequests = 0;
let totalDurationMs = 0;
let activeRequests = 0;

/** Get route engine metrics for admin dashboard */
export function getRouteEngineMetrics() {
  return {
    cacheHits,
    cacheMisses,
    cacheHitRate: totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0,
    totalRequests,
    avgDurationMs: totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0,
    activeRequests,
  };
}

/**
 * Main entry point: plan a transit route.
 *
 * Phase 7.5 enhancements:
 * - Top 3 nearest origin/destination stops (walking optimization)
 * - Smart cache bucketing: 150m grid + 5min time window
 * - Failure resilience: graceful fallback when Redis/DB down
 * - Pareto filtering of candidate paths
 */
export async function planRoute(query: RoutePlanQuery): Promise<{
  results: RoutePlanResult[];
  fromStop: string;
  toStop: string;
  cached: boolean;
  durationMs: number;
}> {
  const startMs = Date.now();
  totalRequests++;
  activeRequests++;

  try {
    if (!isLoaded()) {
      throw new Error('Transit graph not loaded');
    }

    // ── 1. Check Redis cache FIRST (before any computation) ──────────────
    const cacheKey = buildSmartCacheKey(query.fromLat, query.fromLng, query.toLat, query.toLng);

    try {
      const redis = getRedis();
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        cacheHits++;
        const parsed = JSON.parse(cachedData);
        const durationMs = Date.now() - startMs;
        totalDurationMs += durationMs;
        return {
          results: parsed,
          fromStop: '',   // Cached — stop names not available
          toStop: '',
          cached: true,
          durationMs,
        };
      }
    } catch {
      // Redis down — continue without cache (resilience)
      logger.warn('[RouteEngine] Redis unavailable — computing without cache');
    }

    cacheMisses++;

    // ── 2. Find nearest nodes with fallback radius expansion ──────────────
    // Try initial radius; if no results or no connected pairs, expand to 10km
    const RADII = [MAX_NEAREST_STOP_KM, 10];
    let fromNodes = findNearestNodes(query.fromLat, query.fromLng, RADII[0], TOP_N_STOPS);
    let toNodes = findNearestNodes(query.toLat, query.toLng, RADII[0], TOP_N_STOPS);

    // Expand radius if nothing found at initial range
    if (fromNodes.length === 0) {
      fromNodes = findNearestNodes(query.fromLat, query.fromLng, RADII[1], TOP_N_STOPS + 1);
      logger.info(`[RouteEngine] Expanded origin radius to ${RADII[1]}km → ${fromNodes.length} nodes`);
    }
    if (toNodes.length === 0) {
      toNodes = findNearestNodes(query.toLat, query.toLng, RADII[1], TOP_N_STOPS + 1);
      logger.info(`[RouteEngine] Expanded dest radius to ${RADII[1]}km → ${toNodes.length} nodes`);
    }

    if (fromNodes.length === 0) {
      logger.warn(`[RouteEngine] No origin nodes within ${RADII[1]}km of (${query.fromLat}, ${query.fromLng})`);
      return { results: [], fromStop: '', toStop: '', cached: false, durationMs: Date.now() - startMs };
    }
    if (toNodes.length === 0) {
      logger.warn(`[RouteEngine] No dest nodes within ${RADII[1]}km of (${query.toLat}, ${query.toLng})`);
      return { results: [], fromStop: fromNodes[0].name, toStop: '', cached: false, durationMs: Date.now() - startMs };
    }

    const primaryFromStop = fromNodes[0].name;
    const primaryToStop = toNodes[0].name;

    logger.info(`[RouteEngine] Nearest origin stops: ${fromNodes.map(n => n.name).join(', ')} | Nearest dest stops: ${toNodes.map(n => n.name).join(', ')}`);

    // ── 3. Run Dijkstra for each origin→destination pair ─────────────────
    const trafficFactor = getTimeOfDayTrafficFactor();
    const costConfig: Partial<CostConfig> = {
      trafficFactor,
      transferPenaltyMin: 5,
      maxTransfers: 3,
      pruneFactor: 2.0,
    };

    const allPaths: ScoredPath[] = [];
    const pairsChecked = new Set<string>();
    let skippedUnreachable = 0;

    for (const fromNode of fromNodes) {
      for (const toNode of toNodes) {
        if (fromNode.id === toNode.id) continue;
        const pairKey = `${fromNode.id}:${toNode.id}`;
        if (pairsChecked.has(pairKey)) continue;
        pairsChecked.add(pairKey);

        // Skip unreachable pairs instantly (O(1) component check)
        if (!areConnected(fromNode.id, toNode.id)) {
          skippedUnreachable++;
          continue;
        }

        const paths = findShortestPaths(fromNode.id, toNode.id, costConfig, 2);
        allPaths.push(...paths);

        // Early exit: stop searching after finding enough routes
        if (allPaths.length >= 5) break;
      }
      if (allPaths.length >= 5) break;
    }

    if (skippedUnreachable > 0) {
      logger.info(`[RouteEngine] Skipped ${skippedUnreachable} unreachable pairs`);
    }

    if (allPaths.length === 0) {
      // Cache empty results to avoid re-computing unreachable pairs
      try {
        const redis = getRedis();
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify([]));
      } catch {
        // Redis down — skip
      }
      const durationMs = Date.now() - startMs;
      totalDurationMs += durationMs;
      return { results: [], fromStop: primaryFromStop, toStop: primaryToStop, cached: false, durationMs };
    }

    // ── 4. Score and rank (includes Pareto filtering) ────────────────────
    const ranked = await scoreAndRankPaths(allPaths);

    // Take top 5 results
    const topRanked = ranked.slice(0, 5);

    // ── 5. Serialize ─────────────────────────────────────────────────────
    const results = serializeResults(
      topRanked,
      { lat: query.fromLat, lng: query.fromLng },
      { lat: query.toLat, lng: query.toLng },
    );

    // ── 6. Inject live ETA for top result only (performance) ──────────────
    if (results.length > 0) {
      const topResult = results[0];
      for (const leg of topResult.legs) {
        if (leg.type === 'BUS' && leg.routeId) {
          try {
            const speedData = await getRouteAverageSpeed(leg.routeId);
            if (speedData && speedData.averageSpeedKmh > 0) {
              const liveTimeMin = (leg.distance / speedData.averageSpeedKmh) * 60;
              leg.eta = Math.round(liveTimeMin);
            }
          } catch {
            // Use pre-calculated ETA
          }
        }
      }
      topResult.totalETA = topResult.legs.reduce((sum, l) => sum + l.eta, 0);
      topResult.arrivalTime = new Date(Date.now() + topResult.totalETA * 60_000).toISOString();
    }

    // ── 7. Cache in Redis (resilient) ────────────────────────────────────
    try {
      const redis = getRedis();
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(results));
    } catch {
      // Redis down — non-critical, skip caching
    }

    const durationMs = Date.now() - startMs;
    totalDurationMs += durationMs;
    logger.info(
      `[RouteEngine] ${primaryFromStop} → ${primaryToStop}: ${results.length} routes in ${durationMs}ms ` +
      `(pairs: ${pairsChecked.size}, traffic: ${trafficFactor.toFixed(2)})`,
    );

    return { results, fromStop: primaryFromStop, toStop: primaryToStop, cached: false, durationMs };
  } finally {
    activeRequests--;
  }
}

/**
 * Invalidate cache for route changes (resilient).
 */
export async function invalidateRouteCache(): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys('route:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`[RouteEngine] Invalidated ${keys.length} cached route plans`);
    }
  } catch {
    logger.warn('[RouteEngine] Redis unavailable — skipping cache invalidation');
  }
}

// ── Smart cache key: 150m grid + 5min time buckets ──────────────────────────

/**
 * Build a cache key using 150m spatial grid and 5-minute time buckets.
 *
 * 150m ≈ 0.00135° latitude, 0.00155° longitude at Hyderabad latitude.
 * We round to 4 decimal places (~11m precision) then quantize to grid cells.
 * Time bucket: 5 minutes (300 seconds).
 */
function buildSmartCacheKey(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): string {
  const gridSize = 0.00135; // ~150m
  const fromGridLat = Math.round(fromLat / gridSize);
  const fromGridLng = Math.round(fromLng / gridSize);
  const toGridLat = Math.round(toLat / gridSize);
  const toGridLng = Math.round(toLng / gridSize);
  const timeBucket = Math.floor(Date.now() / 300_000); // 5-minute buckets

  return `route:${fromGridLat}:${fromGridLng}:${toGridLat}:${toGridLng}:${timeBucket.toString(36)}`;
}
