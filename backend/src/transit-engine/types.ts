// ── Transit Graph Engine Types ──────────────────────────────────────────────
// Core types for the graph-based transit routing engine.

export interface GraphNode {
  id: string;          // StopNode.id (cuid)
  stopId: string;      // original Stop.id
  name: string;
  lat: number;
  lng: number;
}

export interface GraphEdgeData {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  routeId: string;
  routeNumber: string;
  distance: number;        // km
  avgTravelTime: number;   // minutes
  transferCost: number;    // penalty minutes added when switching routes
  stopOrder: number;
}

/** Adjacency map: nodeId → outgoing edges */
export type AdjacencyMap = Map<string, GraphEdgeData[]>;

/** Node lookup: nodeId → GraphNode */
export type NodeMap = Map<string, GraphNode>;

/** stopId → nodeId mapping */
export type StopToNodeMap = Map<string, string>;

/** Dijkstra state for a visited node */
export interface DijkstraState {
  nodeId: string;
  cost: number;
  prevNodeId: string | null;
  prevEdge: GraphEdgeData | null;
  currentRouteId: string | null;
  transferCount: number;
  /** Ordered list of edges forming the path to this node */
  path: GraphEdgeData[];
}

/** A single leg of a multi-transfer journey */
export interface RouteLeg {
  type: 'WALK' | 'BUS';
  routeId?: string;
  routeNumber?: string;
  routeName?: string;
  stops: number;
  departureStop: string;
  departureStopId: string;
  arrivalStop: string;
  arrivalStopId: string;
  eta: number;            // minutes
  distance: number;       // km
  occupancy: 'LOW' | 'MEDIUM' | 'HIGH';
  liveTrackingAvailable: boolean;
}

/** Complete route plan result */
export interface RoutePlanResult {
  totalETA: number;
  arrivalTime: string;     // ISO date
  transfers: number;
  reliabilityScore: number;
  confidence: number;
  score: number;           // path scorer weighted score (lower = better)
  legs: RouteLeg[];
}

/** Scored path from Dijkstra + scorer */
export interface ScoredPath {
  cost: number;
  path: GraphEdgeData[];
  transferCount: number;
  totalDistance: number;
  totalTime: number;
  /** route changes: [{fromRouteId, toRouteId, atNodeId}] */
  routeChanges: RouteChange[];
}

export interface RouteChange {
  fromRouteId: string;
  fromRouteNumber: string;
  toRouteId: string;
  toRouteNumber: string;
  atNodeId: string;
  atStopName: string;
}

/** Config for Dijkstra cost calculation */
export interface CostConfig {
  trafficFactor: number;       // 1.0 – 1.3
  transferPenaltyMin: number;  // 4 – 6 minutes per transfer
  maxTransfers: number;        // default 2
  pruneFactor: number;         // prune paths > pruneFactor * best (default 2.0)
  unreliabilityWeight: number; // weight for unreliable routes
  congestionWeight: number;    // weight for congested segments
}

/** API query params */
export interface RoutePlanQuery {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

/** Cache key parts */
export interface CacheKey {
  fromNodeId: string;
  toNodeId: string;
  timeBucket: string;
}
