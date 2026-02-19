// ── Graph Loader (In-Memory Singleton) ──────────────────────────────────────
// Loads the transit graph from DB into memory for O(1) lookups.
// Singleton pattern — reload when routes change.

import { prisma } from '../config/database';
import { haversineDistance } from '../utils/geo';
import { logger } from '../utils/logger';
import type { AdjacencyMap, NodeMap, GraphNode, GraphEdgeData, StopToNodeMap } from './types';

// ── Singleton state ─────────────────────────────────────────────────────────
let adjacency: AdjacencyMap = new Map();
let nodeMap: NodeMap = new Map();
let stopToNode: StopToNodeMap = new Map();
let componentMap: Map<string, number> = new Map(); // nodeId → component ID
let componentCount = 0;
let loaded = false;
let nodeCount = 0;
let edgeCount = 0;

/**
 * Load the complete transit graph into memory.
 * Call on server start and when routes are updated.
 */
export async function loadGraph(): Promise<void> {
  const startMs = Date.now();

  // Load all nodes
  const nodes = await prisma.stopNode.findMany();
  const newNodeMap: NodeMap = new Map();
  const newStopToNode: StopToNodeMap = new Map();

  for (const n of nodes) {
    newNodeMap.set(n.id, {
      id: n.id,
      stopId: n.stopId,
      name: n.name,
      lat: n.lat,
      lng: n.lng,
    });
    newStopToNode.set(n.stopId, n.id);
  }

  // Load all edges
  const edges = await prisma.graphEdge.findMany();
  const newAdj: AdjacencyMap = new Map();

  // Initialize adjacency lists for all nodes
  for (const n of nodes) {
    newAdj.set(n.id, []);
  }

  for (const e of edges) {
    const edgeData: GraphEdgeData = {
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      routeId: e.routeId,
      routeNumber: e.routeNumber,
      distance: e.distance,
      avgTravelTime: e.avgTravelTime,
      transferCost: e.transferCost,
      stopOrder: e.stopOrder,
    };
    const list = newAdj.get(e.fromNodeId);
    if (list) list.push(edgeData);
  }

  // Swap in atomically
  adjacency = newAdj;
  nodeMap = newNodeMap;
  stopToNode = newStopToNode;
  nodeCount = nodes.length;
  edgeCount = edges.length;

  // ── Compute connected components (BFS, O(V+E)) ─────────────────────────
  const newComponentMap = new Map<string, number>();
  let compId = 0;
  for (const nodeId of newNodeMap.keys()) {
    if (newComponentMap.has(nodeId)) continue;
    // BFS from this node
    const queue: string[] = [nodeId];
    newComponentMap.set(nodeId, compId);
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const outEdges = newAdj.get(cur);
      if (outEdges) {
        for (let i = 0; i < outEdges.length; i++) {
          const nbr = outEdges[i].toNodeId;
          if (!newComponentMap.has(nbr)) {
            newComponentMap.set(nbr, compId);
            queue.push(nbr);
          }
        }
      }
    }
    compId++;
  }
  componentMap = newComponentMap;
  componentCount = compId;

  loaded = true;

  const elapsed = Date.now() - startMs;
  logger.info(`[GraphLoader] Loaded ${nodeCount} nodes, ${edgeCount} edges, ${componentCount} components in ${elapsed}ms`);
}

/** Get the adjacency map (outgoing edges per node) */
export function getAdjacency(): AdjacencyMap {
  return adjacency;
}

/** Get node info by nodeId */
export function getNode(nodeId: string): GraphNode | undefined {
  return nodeMap.get(nodeId);
}

/** Get all nodes */
export function getAllNodes(): GraphNode[] {
  return Array.from(nodeMap.values());
}

/** Get nodeId from stopId */
export function getNodeIdForStop(stopId: string): string | undefined {
  return stopToNode.get(stopId);
}

/** Check if graph is loaded */
export function isLoaded(): boolean {
  return loaded;
}

/** Get graph stats */
export function getGraphStats(): { nodes: number; edges: number; loaded: boolean; components: number } {
  return { nodes: nodeCount, edges: edgeCount, loaded, components: componentCount };
}

/**
 * Check if two nodes are in the same connected component.
 * O(1) lookup — use before Dijkstra to skip unreachable pairs.
 */
export function areConnected(nodeIdA: string, nodeIdB: string): boolean {
  const compA = componentMap.get(nodeIdA);
  const compB = componentMap.get(nodeIdB);
  return compA !== undefined && compB !== undefined && compA === compB;
}

/**
 * Find the nearest graph node to given coordinates.
 * Uses haversine distance — fast enough for 34–8000 nodes.
 */
export function findNearestNode(
  lat: number,
  lng: number,
  maxDistanceKm: number = 5,
): GraphNode | null {
  let bestNode: GraphNode | null = null;
  let bestDist = Infinity;

  for (const node of nodeMap.values()) {
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist < bestDist && dist <= maxDistanceKm) {
      bestDist = dist;
      bestNode = node;
    }
  }

  return bestNode;
}

/**
 * Find the top N nearest graph nodes to given coordinates.
 * Phase 7.5: supports multi-origin/destination for better walking optimization.
 */
export function findNearestNodes(
  lat: number,
  lng: number,
  maxDistanceKm: number = 5,
  topN: number = 3,
): GraphNode[] {
  const candidates: Array<{ node: GraphNode; dist: number }> = [];

  for (const node of nodeMap.values()) {
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist <= maxDistanceKm) {
      candidates.push({ node, dist });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, topN).map((c) => c.node);
}

/**
 * Find a node by stop name (case-insensitive).
 */
export function findNodeByName(name: string): GraphNode | null {
  const lower = name.toLowerCase().trim();
  for (const node of nodeMap.values()) {
    if (node.name.toLowerCase().trim() === lower) return node;
  }
  return null;
}

/** Force reload */
export async function reloadGraph(): Promise<void> {
  loaded = false;
  await loadGraph();
}
