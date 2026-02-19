// ── Transit Engine Barrel Export ─────────────────────────────────────────────

// Graph builder & loader
export { buildTransitGraph, isGraphBuilt } from './graph.builder';
export { loadGraph, reloadGraph, isLoaded, getGraphStats, findNearestNode, findNearestNodes, findNodeByName, getAllNodes, getNode, areConnected } from './graph.loader';

// Stop-based route engine (Phase 8.7 — primary strategy)
export { findDirectBuses } from './stop-route.engine';
export type { DirectBusResult, StopRouteResult } from './stop-route.engine';

// Dijkstra
export { findShortestPaths, getLastDijkstraStats } from './dijkstra.engine';
export type { DijkstraStats } from './dijkstra.engine';

// Route planning (main entry point)
export { planRoute, invalidateRouteCache, getRouteEngineMetrics } from './route.engine';

// Scoring & Pareto
export { scorePath, scoreAndRankPaths, paretoFilter } from './path.scorer';

// Transfers
export { calculateTransferPenalty, isTransferAllowed, estimateTransferWaitTime, getMaxTransfers } from './transfer.engine';

// Serializer
export { serializePath, serializeResults } from './route.serializer';

// Memory & Performance Monitor
export { startMemoryMonitor, stopMemoryMonitor, getMemoryMetrics, takeSnapshot } from './memory.monitor';

// Types
export type {
  GraphNode,
  GraphEdgeData,
  AdjacencyMap,
  NodeMap,
  StopToNodeMap,
  DijkstraState,
  ScoredPath,
  RouteChange,
  CostConfig,
  RouteLeg,
  RoutePlanResult,
  RoutePlanQuery,
  CacheKey,
} from './types';
