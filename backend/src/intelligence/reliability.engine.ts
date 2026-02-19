// ── Route Reliability Engine ────────────────────────────────────────────────
// Tracks per-route reliability metrics in Redis and computes a reliability index.
//
// Reliability = 100
//   - (delayMinutes × 5)
//   - (disconnectCount × 10)
//   - (highCongestionMinutes × 2)
//
// Labels: HIGH (≥80), MEDIUM (≥50), LOW (<50)
//
// Metrics are stored in Redis hashes with a 1-hour sliding window.

import { getRedis } from '../config/redis';

const RELIABILITY_PREFIX = 'route_reliability:';
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type ReliabilityLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReliabilityResult {
  score: number;         // 0 – 100
  label: ReliabilityLabel;
  delayMinutes: number;
  disconnectCount: number;
  highCongestionMinutes: number;
}

// ── Write: record events ────────────────────────────────────────────────────

/**
 * Record a delay event on a route (e.g., ETA overshoot vs. actual).
 * Fire-and-forget.
 */
export async function recordDelay(routeId: string, delayMinutes: number): Promise<void> {
  if (!routeId || delayMinutes <= 0) return;
  try {
    const redis = getRedis();
    const key = `${RELIABILITY_PREFIX}${routeId}`;
    await redis.hincrbyfloat(key, 'delayMinutes', delayMinutes);
    await redis.hset(key, 'lastUpdated', Date.now().toString());
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
  } catch { /* non-critical */ }
}

/**
 * Record a driver disconnect on a route.
 */
export async function recordDisconnect(routeId: string): Promise<void> {
  if (!routeId) return;
  try {
    const redis = getRedis();
    const key = `${RELIABILITY_PREFIX}${routeId}`;
    await redis.hincrby(key, 'disconnectCount', 1);
    await redis.hset(key, 'lastUpdated', Date.now().toString());
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
  } catch { /* non-critical */ }
}

/**
 * Record high congestion duration on a route.
 */
export async function recordHighCongestion(routeId: string, minutes: number): Promise<void> {
  if (!routeId || minutes <= 0) return;
  try {
    const redis = getRedis();
    const key = `${RELIABILITY_PREFIX}${routeId}`;
    await redis.hincrbyfloat(key, 'highCongestionMinutes', minutes);
    await redis.hset(key, 'lastUpdated', Date.now().toString());
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
  } catch { /* non-critical */ }
}

// ── Read: get reliability score ─────────────────────────────────────────────

export async function getRouteReliability(routeId: string): Promise<ReliabilityResult> {
  const defaultResult: ReliabilityResult = {
    score: 100,
    label: 'HIGH',
    delayMinutes: 0,
    disconnectCount: 0,
    highCongestionMinutes: 0,
  };

  if (!routeId) return defaultResult;

  try {
    const redis = getRedis();
    const key = `${RELIABILITY_PREFIX}${routeId}`;
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) return defaultResult;

    const delayMinutes = parseFloat(data.delayMinutes || '0');
    const disconnectCount = parseInt(data.disconnectCount || '0', 10);
    const highCongestionMinutes = parseFloat(data.highCongestionMinutes || '0');

    // S3: reduced penalty multipliers for gradual degradation (×5→×3, ×10→×7)
    const raw = 100 - (delayMinutes * 3) - (disconnectCount * 7) - (highCongestionMinutes * 2);
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    let label: ReliabilityLabel;
    if (score >= 80) {
      label = 'HIGH';
    } else if (score >= 50) {
      label = 'MEDIUM';
    } else {
      label = 'LOW';
    }

    return { score, label, delayMinutes, disconnectCount, highCongestionMinutes };
  } catch {
    return defaultResult;
  }
}

// ── Read: all route reliabilities (admin) ───────────────────────────────────

export async function getAllRouteReliabilities(): Promise<
  Array<{ routeId: string } & ReliabilityResult>
> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`${RELIABILITY_PREFIX}*`);
    if (!keys.length) return [];

    const results: Array<{ routeId: string } & ReliabilityResult> = [];

    for (const key of keys) {
      const routeId = key.replace(RELIABILITY_PREFIX, '');
      const result = await getRouteReliability(routeId);
      results.push({ routeId, ...result });
    }

    return results;
  } catch {
    return [];
  }
}
