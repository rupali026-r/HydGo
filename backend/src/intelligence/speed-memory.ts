// ── Historical Speed Memory ─────────────────────────────────────────────────
// Records per-route speed samples in Redis sorted sets (score = timestamp).
// Provides the "last N minutes average speed" for weighted ETA calculation.
// Performance budget: < 2ms per read, < 1ms per write.

import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

const ROUTE_SPEED_PREFIX = 'route_speed:';
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SAMPLES = 200;                   // cap per route to bound memory

// ── Write: record a speed sample ────────────────────────────────────────────

/**
 * Record a bus speed sample on a route.
 * Called from driver:location:update handler.
 * Fire-and-forget — never blocks the critical path.
 */
export async function recordSpeed(routeId: string, speedKmh: number): Promise<void> {
  if (!routeId || speedKmh < 0) return;

  try {
    const redis = getRedis();
    const key = `${ROUTE_SPEED_PREFIX}${routeId}`;
    const now = Date.now();

    // ZADD with timestamp as score, value encodes speed + timestamp for uniqueness
    await redis.zadd(key, now, `${speedKmh}:${now}`);

    // S5: always set TTL (15 min) on every write to prevent unbounded key growth
    await redis.expire(key, 900);

    // Trim old entries beyond window (lazy cleanup — run every ~10th call)
    if (Math.random() < 0.10) {
      const cutoff = now - DEFAULT_WINDOW_MS;
      await redis.zremrangebyscore(key, '-inf', cutoff);
      // Also cap total entries
      const count = await redis.zcard(key);
      if (count > MAX_SAMPLES) {
        await redis.zremrangebyrank(key, 0, count - MAX_SAMPLES - 1);
      }
    }
  } catch {
    // Redis failure — speed memory is non-critical
  }
}

// ── Read: get average speed for a route ─────────────────────────────────────

export interface SpeedMemoryResult {
  averageSpeedKmh: number;
  sampleCount: number;
  windowMs: number;
}

/**
 * Get the average speed recorded on a route over a time window.
 * Returns route's last N-minute average speed, or null if no data.
 */
export async function getRouteAverageSpeed(
  routeId: string,
  windowMs: number = 5 * 60 * 1000, // default 5 min for ETA weighting
): Promise<SpeedMemoryResult | null> {
  if (!routeId) return null;

  try {
    const redis = getRedis();
    const key = `${ROUTE_SPEED_PREFIX}${routeId}`;
    const cutoff = Date.now() - windowMs;

    // ZRANGEBYSCORE to get all entries within window
    const entries = await redis.zrangebyscore(key, cutoff, '+inf');
    if (!entries || entries.length === 0) return null;

    let total = 0;
    let count = 0;

    for (const entry of entries) {
      const speed = parseFloat(entry.split(':')[0]);
      if (!isNaN(speed) && speed >= 0) {
        total += speed;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      averageSpeedKmh: Math.round((total / count) * 100) / 100,
      sampleCount: count,
      windowMs,
    };
  } catch {
    // Redis failure — return null so callers fall back to route avgSpeed
    return null;
  }
}

// ── Read: get all route speed averages (for admin metrics) ──────────────────

export async function getAllRouteSpeedAverages(): Promise<
  Array<{ routeId: string; averageSpeedKmh: number; sampleCount: number }>
> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`${ROUTE_SPEED_PREFIX}*`);
    if (!keys.length) return [];

    const results: Array<{ routeId: string; averageSpeedKmh: number; sampleCount: number }> = [];
    const cutoff = Date.now() - DEFAULT_WINDOW_MS;

    for (const key of keys) {
      const routeId = key.replace(ROUTE_SPEED_PREFIX, '');
      const entries = await redis.zrangebyscore(key, cutoff, '+inf');
      if (!entries || entries.length === 0) continue;

      let total = 0;
      let count = 0;
      for (const entry of entries) {
        const speed = parseFloat(entry.split(':')[0]);
        if (!isNaN(speed) && speed >= 0) {
          total += speed;
          count++;
        }
      }
      if (count > 0) {
        results.push({
          routeId,
          averageSpeedKmh: Math.round((total / count) * 100) / 100,
          sampleCount: count,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Utility: get peak hours traffic factor ──────────────────────────────────

/**
 * Returns a time-of-day traffic factor.
 * Peak hours: 8-11 AM, 5-8 PM → factor 1.15-1.30
 * Off-peak: factor 1.0
 */
export function getTimeOfDayTrafficFactor(): number {
  const hour = new Date().getHours();

  // Morning peak: 8-11 AM
  if (hour >= 8 && hour < 11) {
    // Ramp: 8→1.15, 9→1.25, 10→1.20
    if (hour === 9) return 1.25;
    if (hour === 10) return 1.20;
    return 1.15;
  }

  // Evening peak: 5-8 PM
  if (hour >= 17 && hour < 20) {
    // Ramp: 17→1.20, 18→1.30, 19→1.25
    if (hour === 18) return 1.30;
    if (hour === 19) return 1.25;
    return 1.20;
  }

  // Mid-day slight bump (12-2 PM)
  if (hour >= 12 && hour < 14) return 1.05;

  return 1.0;
}
