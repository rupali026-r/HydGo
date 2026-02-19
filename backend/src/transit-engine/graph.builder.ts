// ── Graph Builder ───────────────────────────────────────────────────────────
// Builds transit graph from existing Route + Stop data.
// Creates StopNode and GraphEdge records in DB.
// Phase 8.6: Adds walking transfer edges between nearby stops on different routes.
// Run once on first deploy, or when routes change.

import { prisma } from '../config/database';
import { haversineDistance } from '../utils/geo';
import { logger } from '../utils/logger';

/** Maximum walking distance for transfer edges between stops (km) */
const TRANSFER_WALK_RADIUS_KM = 2.5; // 2.5 km — covers Hyderabad inter-hub distances (e.g. JBS↔Secunderabad)
/** Walking speed for transfer time calculation (km/h) */
const WALKING_SPEED_KMH = 4.5;
/** Transfer penalty added to walking time (minutes) — accounts for wait at new stop */
const TRANSFER_PENALTY_MIN = 3;

/**
 * Build or rebuild the transit graph from current route/stop data.
 * 1. Clears old graph data (StopNode + GraphEdge)
 * 2. Upserts a StopNode for each unique stop (deduped by name+coords)
 * 3. Creates directed GraphEdges between consecutive stops on each route
 * 4. Creates walking transfer edges between nearby stops on DIFFERENT routes
 */
export async function buildTransitGraph(): Promise<{ nodes: number; edges: number; transfers: number }> {
  const startMs = Date.now();
  logger.info('[GraphBuilder] Building transit graph from route/stop data...');

  // ── 1. Load all routes with ordered stops ────────────────────────────────
  const routes = await prisma.route.findMany({
    include: { stops: { orderBy: { stopOrder: 'asc' } } },
  });

  if (routes.length === 0) {
    logger.warn('[GraphBuilder] No routes found — graph is empty');
    return { nodes: 0, edges: 0, transfers: 0 };
  }

  // ── 2. Clear old graph completely (avoid stale large-graph data) ─────────
  await prisma.graphEdge.deleteMany({});
  await prisma.stopNode.deleteMany({});

  // ── 3. Deduplicate stops by name (case-insensitive) + create nodes ───────
  // Multiple routes may share stops with same name but different IDs.
  const nameToNode = new Map<string, string>(); // lowercase name → nodeId
  // Track which routes each node belongs to (for transfer edges)
  const nodeRoutes = new Map<string, Set<string>>(); // nodeId → Set<routeId>
  let nodesCreated = 0;

  for (const route of routes) {
    for (const stop of route.stops) {
      const key = stop.name.toLowerCase().trim();

      if (nameToNode.has(key)) {
        // Already have this stop — just record the additional route
        const existingNodeId = nameToNode.get(key)!;
        nodeRoutes.get(existingNodeId)?.add(route.id);
        continue;
      }

      const node = await prisma.stopNode.create({
        data: {
          stopId: stop.id,
          name: stop.name,
          lat: stop.latitude,
          lng: stop.longitude,
        },
      });
      nameToNode.set(key, node.id);
      nodeRoutes.set(node.id, new Set([route.id]));
      nodesCreated++;
    }
  }

  logger.info(`[GraphBuilder] ${nodesCreated} stop nodes created`);

  // ── 4. Create directed edges between consecutive stops on each route ─────
  type EdgeRow = {
    fromNodeId: string;
    toNodeId: string;
    routeId: string;
    routeNumber: string;
    distance: number;
    avgTravelTime: number;
    transferCost: number;
    stopOrder: number;
  };
  const edgeBatch: EdgeRow[] = [];

  for (const route of routes) {
    const stops = route.stops;
    if (stops.length < 2) continue;

    for (let i = 0; i < stops.length - 1; i++) {
      const fromStop = stops[i];
      const toStop = stops[i + 1];
      const fromKey = fromStop.name.toLowerCase().trim();
      const toKey = toStop.name.toLowerCase().trim();

      const fromNodeId = nameToNode.get(fromKey);
      const toNodeId = nameToNode.get(toKey);
      if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) continue;

      const distanceKm = haversineDistance(
        fromStop.latitude, fromStop.longitude,
        toStop.latitude, toStop.longitude,
      );

      const avgSpeedKmh = route.avgSpeed || 25;
      const avgTravelTimeMin = (distanceKm / avgSpeedKmh) * 60;

      // Forward edge
      edgeBatch.push({
        fromNodeId,
        toNodeId,
        routeId: route.id,
        routeNumber: route.routeNumber,
        distance: Math.round(distanceKm * 1000) / 1000,
        avgTravelTime: Math.round(avgTravelTimeMin * 100) / 100,
        transferCost: 0,
        stopOrder: fromStop.stopOrder,
      });

      // Reverse edge (bus routes run both directions)
      edgeBatch.push({
        fromNodeId: toNodeId,
        toNodeId: fromNodeId,
        routeId: route.id,
        routeNumber: route.routeNumber,
        distance: Math.round(distanceKm * 1000) / 1000,
        avgTravelTime: Math.round(avgTravelTimeMin * 100) / 100,
        transferCost: 0,
        stopOrder: toStop.stopOrder,
      });
    }
  }

  // ── 5. Walking transfer edges between nearby stops on DIFFERENT routes ───
  // This is what connects the graph across routes so Dijkstra can find
  // multi-route journeys (e.g., take 10K then transfer to 216).
  const nodes = Array.from(nameToNode.entries()).map(([key, nodeId]) => {
    // Find coordinates for this stop
    for (const route of routes) {
      for (const stop of route.stops) {
        if (stop.name.toLowerCase().trim() === key) {
          return { id: nodeId, name: stop.name, lat: stop.latitude, lng: stop.longitude };
        }
      }
    }
    return null;
  }).filter(Boolean) as Array<{ id: string; name: string; lat: number; lng: number }>;

  let transferEdges = 0;
  const transferPairs = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.id === b.id) continue;

      // Only add transfer edges between stops on DIFFERENT routes
      const aRoutes = nodeRoutes.get(a.id) ?? new Set();
      const bRoutes = nodeRoutes.get(b.id) ?? new Set();
      const sharedRoutes = [...aRoutes].some((r) => bRoutes.has(r));
      // If they share a route, they're already connected by bus edges
      // But also add transfer edges if they serve different routes (allow transfers)
      const aDiffB = [...aRoutes].some((r) => !bRoutes.has(r)) || [...bRoutes].some((r) => !aRoutes.has(r));
      if (!aDiffB) continue;

      const dist = haversineDistance(a.lat, a.lng, b.lat, b.lng);
      if (dist > TRANSFER_WALK_RADIUS_KM) continue;

      const pairKey = [a.id, b.id].sort().join(':');
      if (transferPairs.has(pairKey)) continue;
      transferPairs.add(pairKey);

      const walkTimeMin = (dist / WALKING_SPEED_KMH) * 60 + TRANSFER_PENALTY_MIN;

      // Bidirectional transfer edges (walking both ways)
      edgeBatch.push({
        fromNodeId: a.id,
        toNodeId: b.id,
        routeId: 'transfer',
        routeNumber: 'WALK',
        distance: Math.round(dist * 1000) / 1000,
        avgTravelTime: Math.round(walkTimeMin * 100) / 100,
        transferCost: TRANSFER_PENALTY_MIN,
        stopOrder: 0,
      });
      edgeBatch.push({
        fromNodeId: b.id,
        toNodeId: a.id,
        routeId: 'transfer',
        routeNumber: 'WALK',
        distance: Math.round(dist * 1000) / 1000,
        avgTravelTime: Math.round(walkTimeMin * 100) / 100,
        transferCost: TRANSFER_PENALTY_MIN,
        stopOrder: 0,
      });
      transferEdges += 2;
    }
  }

  // Batch insert all edges
  if (edgeBatch.length > 0) {
    await prisma.graphEdge.createMany({ data: edgeBatch });
  }

  const elapsed = Date.now() - startMs;
  logger.info(
    `[GraphBuilder] Transit graph built: ${nodesCreated} nodes, ${edgeBatch.length} edges (${transferEdges} transfer) in ${elapsed}ms`,
  );

  return { nodes: nodesCreated, edges: edgeBatch.length, transfers: transferEdges };
}

/**
 * Check if graph exists and is populated.
 */
export async function isGraphBuilt(): Promise<boolean> {
  const nodeCount = await prisma.stopNode.count();
  const edgeCount = await prisma.graphEdge.count();
  return nodeCount > 0 && edgeCount > 0;
}
