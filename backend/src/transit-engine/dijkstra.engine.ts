// ── Dijkstra Engine (Hardened with Priority Queue) ──────────────────────────
// Modified Dijkstra's shortest-path algorithm for transit routing.
// Uses a binary min-heap priority queue for O(E log V) complexity.
// Supports transfer penalties, traffic factors, dominated path pruning,
// heap size caps, and early exit optimization.
//
// Phase 7.5 Scale Optimizations:
// - Predecessor map: O(1) state creation (no path array copying)
// - Path reconstruction only on destination reached
// - Time-based bailout (25ms per call)
// - Tighter iteration / heap limits for 8000-node graphs

import { getAdjacency, getNode } from './graph.loader';
import type { GraphEdgeData, DijkstraState, ScoredPath, RouteChange, CostConfig } from './types';

// ── Min-Heap Priority Queue ─────────────────────────────────────────────────

interface HeapEntry {
  key: string;
  cost: number;
}

class MinHeap {
  private data: HeapEntry[] = [];

  get size(): number { return this.data.length; }

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].cost <= this.data[i].cost) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].cost < this.data[smallest].cost) smallest = left;
      if (right < n && this.data[right].cost < this.data[smallest].cost) smallest = right;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ── Safety limits ───────────────────────────────────────────────────────────
const MAX_ITERATIONS = 8_000;   // Tight limit for 8000-node scale
const MAX_HEAP_SIZE  = 2_000;   // Tighter cap for memory
const EARLY_EXIT_FACTOR = 1.3;  // Exit when cost > 1.3× best found ETA
const MAX_TIME_MS = 15;         // Hard time-based bailout per Dijkstra call

// ── Default cost config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: CostConfig = {
  trafficFactor: 1.0,
  transferPenaltyMin: 5,
  maxTransfers: 2,
  pruneFactor: 1.8,
  unreliabilityWeight: 0.1,
  congestionWeight: 0.05,
};

// ── Lightweight state for predecessor tracking ──────────────────────────────
// Instead of copying the entire path array per state (O(pathLen) per expansion),
// we store a predecessor pointer and reconstruct the path only when needed.

interface LightState {
  nodeId: string;
  cost: number;
  currentRouteId: string | null;
  transferCount: number;
  edge: GraphEdgeData | null;  // edge used to reach this state
  prevKey: string | null;      // predecessor state key
}

// ── Dijkstra search stats (exported for monitoring) ─────────────────────────
export interface DijkstraStats {
  iterations: number;
  heapPeak: number;
  heapDrops: number;
  earlyExits: number;
  dominatedPrunes: number;
  resultsFound: number;
  durationMs: number;
  timedOut: boolean;
}

let lastStats: DijkstraStats = {
  iterations: 0, heapPeak: 0, heapDrops: 0,
  earlyExits: 0, dominatedPrunes: 0, resultsFound: 0, durationMs: 0, timedOut: false,
};

/** Get the stats from the last Dijkstra run */
export function getLastDijkstraStats(): DijkstraStats { return lastStats; }

// ── Dijkstra ────────────────────────────────────────────────────────────────

/**
 * Find shortest paths from origin to destination using modified Dijkstra.
 *
 * Returns up to `maxResults` distinct paths (different route combinations).
 * Each path tracks transfers, total cost, and the edge sequence.
 *
 * Hardening (Phase 7.5):
 * - Predecessor tracking (O(1) per state instead of O(path) copying)
 * - Max heap size cap (3000)
 * - Early exit at 1.3× best found ETA
 * - Time-based bailout (25ms)
 * - Dominated path pruning
 * - Strict max_transfers enforcement
 */
export function findShortestPaths(
  originNodeId: string,
  destNodeId: string,
  config: Partial<CostConfig> = {},
  maxResults: number = 5,
): ScoredPath[] {
  const startMs = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const adj = getAdjacency();

  const stats: DijkstraStats = {
    iterations: 0, heapPeak: 0, heapDrops: 0,
    earlyExits: 0, dominatedPrunes: 0, resultsFound: 0, durationMs: 0, timedOut: false,
  };

  if (!adj.has(originNodeId) || !adj.has(destNodeId)) {
    lastStats = { ...stats, durationMs: Date.now() - startMs };
    return [];
  }

  // State: best cost per (nodeId, currentRouteId, transferCount)
  const visited = new Map<string, number>();

  // Dominated-path index: nodeId → best (cost, transfers) reaching this node
  const dominance = new Map<string, Array<{ cost: number; transfers: number }>>();

  // Predecessor map: stateKey → LightState (O(1) per new state)
  const states = new Map<string, LightState>();

  const heap = new MinHeap();
  const resultKeys: string[] = []; // state keys that reached destination
  let bestResultCost = Infinity;

  // Initial state
  const initKey = mkKey(originNodeId, null, 0);
  states.set(initKey, {
    nodeId: originNodeId,
    cost: 0,
    currentRouteId: null,
    transferCount: 0,
    edge: null,
    prevKey: null,
  });
  heap.push({ key: initKey, cost: 0 });

  while (heap.size > 0 && stats.iterations < MAX_ITERATIONS) {
    stats.iterations++;

    // Time-based bailout
    if ((stats.iterations & 0xFF) === 0) { // check every 256 iterations
      if (Date.now() - startMs > MAX_TIME_MS) {
        stats.timedOut = true;
        break;
      }
    }

    if (heap.size > stats.heapPeak) stats.heapPeak = heap.size;

    const entry = heap.pop()!;
    const currentKey = entry.key;
    const current = states.get(currentKey);
    if (!current) continue;

    // Skip if already found a better path to this state
    const bestSeen = visited.get(currentKey);
    if (bestSeen !== undefined && bestSeen < current.cost) continue;
    visited.set(currentKey, current.cost);

    // Early exit: cost exceeds factor × best found
    if (bestResultCost < Infinity && current.cost > bestResultCost * EARLY_EXIT_FACTOR) {
      stats.earlyExits++;
      continue;
    }

    // ── Destination reached ──────────────────────────────────────────────
    if (current.nodeId === destNodeId) {
      resultKeys.push(currentKey);
      stats.resultsFound++;
      if (current.cost < bestResultCost) bestResultCost = current.cost;

      if (resultKeys.length >= maxResults * 2) break;
      if (current.cost > bestResultCost * cfg.pruneFactor) break;
      continue;
    }

    // Prune: cost already too high
    if (resultKeys.length > 0 && current.cost > bestResultCost * cfg.pruneFactor) continue;

    // ── Expand neighbors ─────────────────────────────────────────────────
    const edges = adj.get(current.nodeId);
    if (!edges) continue;

    for (let ei = 0; ei < edges.length; ei++) {
      const edge = edges[ei];
      let edgeCost = edge.avgTravelTime * cfg.trafficFactor;

      let newTransferCount = current.transferCount;
      if (current.currentRouteId !== null && current.currentRouteId !== edge.routeId) {
        newTransferCount++;
        if (newTransferCount > cfg.maxTransfers) continue;
        edgeCost += cfg.transferPenaltyMin;
      }

      const newCost = current.cost + edgeCost;
      const newKey = mkKey(edge.toNodeId, edge.routeId, newTransferCount);

      // Skip if visited with better cost
      const existingCost = visited.get(newKey);
      if (existingCost !== undefined && existingCost <= newCost) continue;

      // Dominated path pruning
      const domKey = edge.toNodeId;
      const domList = dominance.get(domKey);
      if (domList) {
        let dominated = false;
        for (let di = 0; di < domList.length; di++) {
          if (domList[di].cost <= newCost && domList[di].transfers <= newTransferCount) {
            dominated = true;
            break;
          }
        }
        if (dominated) {
          stats.dominatedPrunes++;
          continue;
        }
        // Remove entries dominated by new state (in-place filtering)
        let writeIdx = 0;
        for (let di = 0; di < domList.length; di++) {
          if (!(newCost <= domList[di].cost && newTransferCount <= domList[di].transfers)) {
            domList[writeIdx++] = domList[di];
          }
        }
        domList.length = writeIdx;
        domList.push({ cost: newCost, transfers: newTransferCount });
      } else {
        dominance.set(domKey, [{ cost: newCost, transfers: newTransferCount }]);
      }

      // Store lightweight state (O(1) — no path copying)
      states.set(newKey, {
        nodeId: edge.toNodeId,
        cost: newCost,
        currentRouteId: edge.routeId,
        transferCount: newTransferCount,
        edge,
        prevKey: currentKey,
      });

      // Heap size cap
      if (heap.size >= MAX_HEAP_SIZE) {
        stats.heapDrops++;
        if (bestResultCost === Infinity || newCost < bestResultCost * cfg.pruneFactor) {
          heap.push({ key: newKey, cost: newCost });
        }
      } else {
        heap.push({ key: newKey, cost: newCost });
      }
    }
  }

  stats.durationMs = Date.now() - startMs;
  lastStats = stats;

  // ── Reconstruct paths from predecessor chains ─────────────────────────
  const results: ScoredPath[] = [];
  for (const rk of resultKeys) {
    const path = reconstructPath(states, rk);
    const routeChanges = extractRouteChanges(path);
    results.push({
      cost: states.get(rk)!.cost,
      path,
      transferCount: routeChanges.length,
      totalDistance: path.reduce((sum, e) => sum + e.distance, 0),
      totalTime: path.reduce((sum, e) => sum + e.avgTravelTime, 0),
      routeChanges,
    });
  }

  results.sort((a, b) => a.cost - b.cost);
  return deduplicatePaths(results).slice(0, maxResults);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mkKey(nodeId: string, routeId: string | null, transfers: number): string {
  return `${nodeId}|${routeId ?? '_'}|${transfers}`;
}

/**
 * Reconstruct the edge path by walking the predecessor chain.
 */
function reconstructPath(states: Map<string, LightState>, endKey: string): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  let key: string | null = endKey;

  while (key) {
    const st = states.get(key);
    if (!st) break;
    if (st.edge) edges.push(st.edge);
    key = st.prevKey;
  }

  edges.reverse();
  return edges;
}

/**
 * Extract route changes (transfers) from a path of edges.
 */
function extractRouteChanges(path: GraphEdgeData[]): RouteChange[] {
  const changes: RouteChange[] = [];
  for (let i = 1; i < path.length; i++) {
    if (path[i].routeId !== path[i - 1].routeId) {
      const node = getNode(path[i].fromNodeId);
      changes.push({
        fromRouteId: path[i - 1].routeId,
        fromRouteNumber: path[i - 1].routeNumber,
        toRouteId: path[i].routeId,
        toRouteNumber: path[i].routeNumber,
        atNodeId: path[i].fromNodeId,
        atStopName: node?.name ?? 'Unknown',
      });
    }
  }
  return changes;
}

/**
 * Remove duplicate paths that use exactly the same ordered route sequence.
 */
function deduplicatePaths(paths: ScoredPath[]): ScoredPath[] {
  const seen = new Set<string>();
  const unique: ScoredPath[] = [];

  for (const p of paths) {
    // Build route signature: ordered list of route segments
    const segments: string[] = [];
    let currentRoute = '';
    for (const edge of p.path) {
      if (edge.routeId !== currentRoute) {
        segments.push(edge.routeId);
        currentRoute = edge.routeId;
      }
    }
    const sig = segments.join('→');
    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(p);
    }
  }

  return unique;
}
