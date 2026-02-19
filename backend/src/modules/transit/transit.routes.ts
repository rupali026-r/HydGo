// ── Transit Route Plan API (Phase 8.7 — Stop-Based + Dijkstra Fallback) ─────
// GET /api/transit/route-plan?fromLat=...&fromLng=...&toLat=...&toLng=...
//
// Strategy:
//   1. FIRST: Find direct buses via stop-based query (fast, accurate)
//   2. FALLBACK: If no direct buses, run Dijkstra for transfer routes
//
// Returns route list with ETA, stops count, reliability, live bus info.

import { Router, Request, Response } from 'express';
import { findDirectBuses } from '../../transit-engine/stop-route.engine';
import { planRoute, getGraphStats, buildTransitGraph, loadGraph, isLoaded, isGraphBuilt } from '../../transit-engine';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/transit/route-plan
 * Query params: fromLat, fromLng, toLat, toLng, fromName?, toName?
 */
router.get('/route-plan', async (req: Request, res: Response) => {
  try {
    const fromLat = parseFloat(req.query.fromLat as string);
    const fromLng = parseFloat(req.query.fromLng as string);
    const toLat = parseFloat(req.query.toLat as string);
    const toLng = parseFloat(req.query.toLng as string);
    const fromName = (req.query.fromName as string) || undefined;
    const toName = (req.query.toName as string) || undefined;

    if ([fromLat, fromLng, toLat, toLng].some((v) => isNaN(v))) {
      return res.status(400).json({
        error: 'Invalid query params. Required: fromLat, fromLng, toLat, toLng (all numbers)',
      });
    }

    // ── Strategy 1: Stop-based direct bus lookup ───────────────────────────
    const directResult = await findDirectBuses({ fromLat, fromLng, toLat, toLng, fromName, toName });

    if (directResult.routes.length > 0) {
      logger.info(
        `[TransitAPI] DIRECT: ${directResult.originStop} → ${directResult.destinationStop}: ` +
        `${directResult.routes.length} buses in ${directResult.durationMs}ms`,
      );
      return res.json({
        status: 'ok',
        strategy: 'direct',
        fromStop: directResult.originStop,
        toStop: directResult.destinationStop,
        cached: false,
        durationMs: directResult.durationMs,
        count: directResult.routes.length,
        routes: directResult.routes,
      });
    }

    // ── Strategy 2: Dijkstra graph-based transfer routing (fallback) ──────
    logger.info(
      `[TransitAPI] No direct buses for ${directResult.originStop} → ${directResult.destinationStop}, ` +
      'falling back to Dijkstra transfer routing...',
    );

    const dijkstraResult = await planRoute({ fromLat, fromLng, toLat, toLng });

    return res.json({
      status: 'ok',
      strategy: 'transfer',
      fromStop: dijkstraResult.fromStop || directResult.originStop,
      toStop: dijkstraResult.toStop || directResult.destinationStop,
      cached: dijkstraResult.cached,
      durationMs: dijkstraResult.durationMs,
      count: dijkstraResult.results.length,
      routes: dijkstraResult.results,
    });
  } catch (error: any) {
    logger.error('[TransitAPI] route-plan error', { error: error.message });
    return res.status(500).json({ error: 'Route planning failed', message: error.message });
  }
});

/**
 * GET /api/transit/graph-stats
 * Returns node/edge counts and loaded status.
 */
router.get('/graph-stats', (_req: Request, res: Response) => {
  const stats = getGraphStats();
  res.json({ status: 'ok', ...stats });
});

/**
 * POST /api/transit/rebuild-graph
 * Admin: rebuild the graph from current route/stop data.
 */
router.post('/rebuild-graph', async (_req: Request, res: Response) => {
  try {
    const buildResult = await buildTransitGraph();
    await loadGraph();
    res.json({
      status: 'ok',
      message: 'Transit graph rebuilt and reloaded',
      ...buildResult,
    });
  } catch (error: any) {
    logger.error('[TransitAPI] rebuild-graph error', { error: error.message });
    res.status(500).json({ error: 'Graph rebuild failed', message: error.message });
  }
});

/**
 * POST /api/transit/reload-graph
 * Reload graph from StopNode/GraphEdge tables WITHOUT rebuilding from Route/Stop source.
 * Use after generate-large-graph.ts or direct DB inserts.
 */
router.post('/reload-graph', async (_req: Request, res: Response) => {
  try {
    await loadGraph();
    const stats = getGraphStats();
    res.json({
      status: 'ok',
      message: 'Transit graph reloaded from DB',
      ...stats,
    });
  } catch (error: any) {
    logger.error('[TransitAPI] reload-graph error', { error: error.message });
    res.status(500).json({ error: 'Graph reload failed', message: error.message });
  }
});

export default router;
