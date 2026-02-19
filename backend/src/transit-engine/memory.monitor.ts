// ── Memory & Performance Monitor (Phase 7.5) ────────────────────────────────
// Periodic heap/RSS monitoring with leak detection.
// Logs warnings when memory grows beyond thresholds.

import { logger } from '../utils/logger';
import { getRouteEngineMetrics } from './route.engine';
import { getLastDijkstraStats } from './dijkstra.engine';
import { getGraphStats } from './graph.loader';

// ── Snapshot tracking ───────────────────────────────────────────────────────

interface MemorySnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  activeRequests: number;
}

const SNAPSHOT_HISTORY_SIZE = 60; // keep last 60 snapshots (30 min at 30s interval)
const snapshots: MemorySnapshot[] = [];
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let baselineHeapMB = 0;

// ── Thresholds ──────────────────────────────────────────────────────────────
const HEAP_WARNING_MB = 256;
const HEAP_CRITICAL_MB = 512;
const LEAK_GROWTH_THRESHOLD_MB = 50; // warn if heap grows > 50MB over baseline

/**
 * Take a single memory snapshot and check for anomalies.
 */
export function takeSnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const routeMetrics = getRouteEngineMetrics();

  const snapshot: MemorySnapshot = {
    timestamp: Date.now(),
    heapUsedMB: Math.round(mem.heapUsed / 1048576 * 100) / 100,
    heapTotalMB: Math.round(mem.heapTotal / 1048576 * 100) / 100,
    rssMB: Math.round(mem.rss / 1048576 * 100) / 100,
    externalMB: Math.round((mem.external || 0) / 1048576 * 100) / 100,
    activeRequests: routeMetrics.activeRequests,
  };

  // Track baseline
  if (baselineHeapMB === 0) {
    baselineHeapMB = snapshot.heapUsedMB;
  }

  // Store snapshot
  snapshots.push(snapshot);
  if (snapshots.length > SNAPSHOT_HISTORY_SIZE) {
    snapshots.shift();
  }

  // ── Anomaly detection ──────────────────────────────────────────────────
  if (snapshot.heapUsedMB > HEAP_CRITICAL_MB) {
    logger.error(
      `[MemoryMonitor] CRITICAL: Heap ${snapshot.heapUsedMB}MB exceeds ${HEAP_CRITICAL_MB}MB`,
    );
  } else if (snapshot.heapUsedMB > HEAP_WARNING_MB) {
    logger.warn(
      `[MemoryMonitor] WARNING: Heap ${snapshot.heapUsedMB}MB exceeds ${HEAP_WARNING_MB}MB`,
    );
  }

  // Leak detection: compare to baseline
  const heapGrowth = snapshot.heapUsedMB - baselineHeapMB;
  if (heapGrowth > LEAK_GROWTH_THRESHOLD_MB) {
    logger.warn(
      `[MemoryMonitor] Potential leak: Heap grew ${heapGrowth.toFixed(1)}MB since baseline ` +
      `(${baselineHeapMB.toFixed(1)}MB → ${snapshot.heapUsedMB.toFixed(1)}MB)`,
    );
  }

  return snapshot;
}

/**
 * Start periodic memory monitoring (every 30 seconds).
 */
export function startMemoryMonitor(intervalMs: number = 30_000): void {
  if (monitorInterval) {
    logger.warn('[MemoryMonitor] Already running');
    return;
  }

  // Take initial snapshot
  const initial = takeSnapshot();
  logger.info(
    `[MemoryMonitor] Started — baseline heap: ${initial.heapUsedMB}MB, RSS: ${initial.rssMB}MB`,
  );

  monitorInterval = setInterval(() => {
    const snap = takeSnapshot();
    const graphStats = getGraphStats();
    const routeMetrics = getRouteEngineMetrics();
    const dijkstraStats = getLastDijkstraStats();

    logger.debug(
      `[MemoryMonitor] heap: ${snap.heapUsedMB}MB | RSS: ${snap.rssMB}MB | ` +
      `graph: ${graphStats.nodes}n/${graphStats.edges}e | ` +
      `routes: ${routeMetrics.totalRequests} req (${routeMetrics.cacheHitRate}% cache hit) | ` +
      `active: ${routeMetrics.activeRequests} | ` +
      `last djk: ${dijkstraStats.iterations} iters, ${dijkstraStats.durationMs}ms`,
    );
  }, intervalMs);
}

/**
 * Stop memory monitoring.
 */
export function stopMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[MemoryMonitor] Stopped');
  }
}

/**
 * Get the full memory metrics report (for admin API).
 */
export function getMemoryMetrics() {
  const current = takeSnapshot();
  const graphStats = getGraphStats();
  const routeMetrics = getRouteEngineMetrics();
  const dijkstraStats = getLastDijkstraStats();

  // Trend analysis: compare first and last snapshots
  let trend: 'stable' | 'growing' | 'shrinking' = 'stable';
  if (snapshots.length >= 5) {
    const first5Avg = snapshots.slice(0, 5).reduce((s, sn) => s + sn.heapUsedMB, 0) / 5;
    const last5Avg = snapshots.slice(-5).reduce((s, sn) => s + sn.heapUsedMB, 0) / 5;
    const diff = last5Avg - first5Avg;
    if (diff > 10) trend = 'growing';
    else if (diff < -10) trend = 'shrinking';
  }

  return {
    memory: {
      current: {
        heapUsedMB: current.heapUsedMB,
        heapTotalMB: current.heapTotalMB,
        rssMB: current.rssMB,
        externalMB: current.externalMB,
      },
      baselineHeapMB,
      heapGrowthMB: Math.round((current.heapUsedMB - baselineHeapMB) * 100) / 100,
      trend,
      snapshotCount: snapshots.length,
    },
    graph: graphStats,
    routing: routeMetrics,
    lastDijkstra: dijkstraStats,
    uptime: Math.round(process.uptime()),
    cpuUsage: process.cpuUsage(),
  };
}
