// ── Route Serializer ────────────────────────────────────────────────────────
// Converts internal ScoredPath into the UI-friendly RoutePlanResult format.
// Groups consecutive edges by route into legs, adds walking segments.
//
// Walk caps (Phase 10):
//   - Individual walk leg: max 2km / 25 min
//   - Total walk per route: max 2km → route discarded if exceeded

const MAX_WALK_DIST_KM = 2.0;   // 2km max per walk leg
const MAX_WALK_TIME_MIN = 25;    // 25 min max per walk leg
const WALK_SPEED_M_PER_MIN = 80; // ~4.8 km/h

import { getNode, findNearestNode } from './graph.loader';
import { haversineDistance } from '../utils/geo';
import type { ScoredPath, RoutePlanResult, RouteLeg, GraphNode } from './types';

/**
 * Serialize a scored path into the API response format.
 */
export function serializePath(
  path: ScoredPath & { score: number },
  originCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number },
): RoutePlanResult {
  const legs: RouteLeg[] = [];

  if (path.path.length === 0) {
    return {
      totalETA: 0,
      arrivalTime: new Date().toISOString(),
      transfers: 0,
      reliabilityScore: 0,
      confidence: 0,
      score: path.score,
      legs: [],
    };
  }

  // ── Walking leg to first bus stop ────────────────────────────────────────
  const firstEdge = path.path[0];
  const firstNode = getNode(firstEdge.fromNodeId);
  if (firstNode) {
    const walkDistKm = haversineDistance(
      originCoords.lat,
      originCoords.lng,
      firstNode.lat,
      firstNode.lng,
    );
    const walkDistMeters = Math.round(walkDistKm * 1000);
    if (walkDistMeters > 30) {
      // Skip route entirely if first walk > 2km
      if (walkDistKm > MAX_WALK_DIST_KM) {
        return null as any; // Will be filtered in serializeResults
      }
      const walkTimeMin = Math.min(Math.round(walkDistMeters / WALK_SPEED_M_PER_MIN), MAX_WALK_TIME_MIN);
      legs.push({
        type: 'WALK',
        stops: 0,
        departureStop: 'Your Location',
        departureStopId: '',
        arrivalStop: firstNode.name,
        arrivalStopId: firstNode.stopId,
        eta: walkTimeMin,
        distance: walkDistKm,
        occupancy: 'LOW',
        liveTrackingAvailable: false,
      });
    }
  }

  // ── Group edges by route into BUS legs ──────────────────────────────────
  let currentRouteId = path.path[0].routeId;
  let currentRouteNumber = path.path[0].routeNumber;
  let legEdges: typeof path.path = [path.path[0]];

  for (let i = 1; i < path.path.length; i++) {
    const edge = path.path[i];
    if (edge.routeId === currentRouteId) {
      legEdges.push(edge);
    } else {
      // Flush current leg
      legs.push(buildBusLeg(legEdges, currentRouteNumber));

      // Start new leg
      currentRouteId = edge.routeId;
      currentRouteNumber = edge.routeNumber;
      legEdges = [edge];
    }
  }
  // Flush last leg
  if (legEdges.length > 0) {
    legs.push(buildBusLeg(legEdges, currentRouteNumber));
  }

  // ── Walking leg from last bus stop to destination ───────────────────────
  const lastEdge = path.path[path.path.length - 1];
  const lastNode = getNode(lastEdge.toNodeId);
  if (lastNode) {
    const walkDistKm = haversineDistance(
      lastNode.lat,
      lastNode.lng,
      destCoords.lat,
      destCoords.lng,
    );
    const walkDistMeters = Math.round(walkDistKm * 1000);
    if (walkDistMeters > 30) {
      // Skip route entirely if last walk > 2km
      if (walkDistKm > MAX_WALK_DIST_KM) {
        return null as any; // Will be filtered in serializeResults
      }
      const walkTimeMin = Math.min(Math.round(walkDistMeters / WALK_SPEED_M_PER_MIN), MAX_WALK_TIME_MIN);
      legs.push({
        type: 'WALK',
        stops: 0,
        departureStop: lastNode.name,
        departureStopId: lastNode.stopId,
        arrivalStop: 'Destination',
        arrivalStopId: '',
        eta: walkTimeMin,
        distance: walkDistKm,
        occupancy: 'LOW',
        liveTrackingAvailable: false,
      });
    }
  }

  // ── Compute totals ────────────────────────────────────────────────────
  const totalETA = legs.reduce((sum, l) => sum + l.eta, 0);
  const arrivalTime = new Date(Date.now() + totalETA * 60_000).toISOString();

  // Reliability: average across route segments
  const numRoutes = path.routeChanges.length + 1;
  const baseReliability = path.transferCount === 0 ? 85 : path.transferCount === 1 ? 72 : 60;
  const reliabilityScore = Math.max(0, Math.min(100, baseReliability));

  const confidence = Math.max(
    0.45,
    Math.min(1.0, 0.90 - path.transferCount * 0.1 - (path.totalTime > 60 ? 0.1 : 0)),
  );

  return {
    totalETA,
    arrivalTime,
    transfers: path.transferCount,
    reliabilityScore,
    confidence: Math.round(confidence * 100) / 100,
    score: path.score,
    legs,
  };
}

/**
 * Build a BUS leg from a sequence of edges on the same route.
 */
function buildBusLeg(
  edges: Array<{ fromNodeId: string; toNodeId: string; routeId: string; routeNumber: string; distance: number; avgTravelTime: number }>,
  routeNumber: string,
): RouteLeg {
  const firstNode = getNode(edges[0].fromNodeId);
  const lastNode = getNode(edges[edges.length - 1].toNodeId);

  const totalDistance = edges.reduce((sum, e) => sum + e.distance, 0);
  const totalTime = edges.reduce((sum, e) => sum + e.avgTravelTime, 0);

  return {
    type: 'BUS',
    routeId: edges[0].routeId,
    routeNumber,
    stops: edges.length,
    departureStop: firstNode?.name ?? 'Unknown',
    departureStopId: firstNode?.stopId ?? '',
    arrivalStop: lastNode?.name ?? 'Unknown',
    arrivalStopId: lastNode?.stopId ?? '',
    eta: Math.round(totalTime),
    distance: Math.round(totalDistance * 100) / 100,
    occupancy: totalTime > 30 ? 'HIGH' : totalTime > 15 ? 'MEDIUM' : 'LOW',
    liveTrackingAvailable: true,
  };
}

/**
 * Serialize multiple paths into API response format.
 */
export function serializeResults(
  paths: Array<ScoredPath & { score: number }>,
  originCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number },
): RoutePlanResult[] {
  return paths
    .map((p) => serializePath(p, originCoords, destCoords))
    .filter((r): r is RoutePlanResult => {
      if (!r || !r.legs) return false;
      // Discard routes with total walking > 2km
      const totalWalkKm = r.legs
        .filter((l) => l.type === 'WALK')
        .reduce((sum, l) => sum + (l.distance ?? 0), 0);
      if (totalWalkKm > MAX_WALK_DIST_KM) return false;
      // Discard routes with any walk leg > 25 min
      const badWalk = r.legs.find((l) => l.type === 'WALK' && l.eta > MAX_WALK_TIME_MIN);
      if (badWalk) return false;
      return true;
    });
}
