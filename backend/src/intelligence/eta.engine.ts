// ── Predictive ETA Engine ───────────────────────────────────────────────────
// Replaces naive distance/speed ETA with a 4-component predictive model:
//
//   ETA = remainingDistance / weightedSpeed
//       + predictedStopDelay
//       + trafficFactor adjustment
//       + congestionPenalty
//
// Performance budget: < 5ms per calculation.

import { haversineDistance } from '../utils/geo';
import { getRouteAverageSpeed, getTimeOfDayTrafficFactor } from './speed-memory';

// ── Types ───────────────────────────────────────────────────────────────────

export type TrafficLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type CongestionLevel = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY';

export interface PredictiveETAResult {
  distanceKm: number;
  estimatedMinutes: number;
  formattedETA: string;
  // Intelligence fields
  trafficLevel: TrafficLevel;
  congestionLevel: CongestionLevel;
  trafficFactor: number;
  congestionPenaltyMin: number;
  stopDelayMin: number;
  weightedSpeedKmh: number;
}

export interface ETAInput {
  busLat: number;
  busLng: number;
  targetLat: number;
  targetLng: number;
  // Current bus state
  currentSpeedKmh: number;
  routeAvgSpeedKmh: number;
  // Route context
  routeId?: string;
  upcomingStopCount?: number;
  occupancyPercent?: number; // 0-100
  // Congestion context
  nearbyBusCount?: number;    // buses within 300m on same route
  routeOccupancyAvg?: number; // average occupancy across all route buses (0-100)
}

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_SPEED_KMH = 5;        // floor to avoid divide-by-zero

// S1-A tuning: reduced currentSpeed weight from 0.5→0.4 to dampen GPS noise oscillation
const SPEED_WEIGHT_CURRENT = 0.4;
const SPEED_WEIGHT_ROUTE_AVG = 0.4;
const SPEED_WEIGHT_HISTORICAL = 0.2;

// Stop dwell times by occupancy
const DWELL_HIGH_SEC = 20;    // occupancy > 70%
const DWELL_MED_SEC = 12;     // occupancy > 40%
const DWELL_LOW_SEC = 6;      // occupancy <= 40%
const DWELL_MAX_SEC = 25;     // S1-C: hard cap per stop to prevent spike > 90s

// Congestion thresholds
const CONGESTION_BUS_RADIUS_THRESHOLD = 3;   // 3+ buses within 300m → MODERATE
const CONGESTION_BUS_HEAVY_THRESHOLD = 5;    // S8: 5+ buses → HEAVY regardless of occupancy
const CONGESTION_OCCUPANCY_THRESHOLD = 70;   // avg occupancy > 70%

// Traffic speed-drop threshold: 25% below baseline
const TRAFFIC_SPEED_DROP_THRESHOLD = 0.75;

// S1-B: traffic factor smoothing state (per-route, in-memory)
const _prevTrafficFactor = new Map<string, number>();

// ── Main Engine ─────────────────────────────────────────────────────────────

export async function calculatePredictiveETA(input: ETAInput): Promise<PredictiveETAResult> {
  const {
    busLat, busLng, targetLat, targetLng,
    currentSpeedKmh,
    routeAvgSpeedKmh,
    routeId,
    upcomingStopCount = 0,
    occupancyPercent = 0,
    nearbyBusCount = 0,
    routeOccupancyAvg = 0,
  } = input;

  // ── 1. Distance ──
  const distanceKm = haversineDistance(busLat, busLng, targetLat, targetLng);

  // ── 2. Weighted Speed ──
  // Get historical speed from Redis (last 5 min average for this route)
  let historicalSpeedKmh = routeAvgSpeedKmh; // fallback
  if (routeId) {
    const speedMemory = await getRouteAverageSpeed(routeId, 5 * 60 * 1000);
    if (speedMemory) {
      historicalSpeedKmh = speedMemory.averageSpeedKmh;
    }
  }

  const effectiveCurrent = Math.max(currentSpeedKmh, MIN_SPEED_KMH);
  const effectiveRouteAvg = Math.max(routeAvgSpeedKmh, MIN_SPEED_KMH);
  const effectiveHistorical = Math.max(historicalSpeedKmh, MIN_SPEED_KMH);

  const weightedSpeed = Math.max(
    (SPEED_WEIGHT_CURRENT * effectiveCurrent) +
    (SPEED_WEIGHT_ROUTE_AVG * effectiveRouteAvg) +
    (SPEED_WEIGHT_HISTORICAL * effectiveHistorical),
    MIN_SPEED_KMH,
  );

  // ── 3. Traffic Factor ──
  const timeOfDayFactor = getTimeOfDayTrafficFactor();
  let trafficFactor = timeOfDayFactor;

  // Increase if current speed drops > 25% below route baseline
  if (effectiveCurrent < effectiveRouteAvg * TRAFFIC_SPEED_DROP_THRESHOLD) {
    trafficFactor = Math.min(trafficFactor + 0.10, 1.30);
  }

  // Additional bump if many buses clustered (>5 buses on same segment)
  if (nearbyBusCount > 5) {
    trafficFactor = Math.min(trafficFactor + 0.05, 1.30);
  }

  // Clamp: 1.0 - 1.3
  trafficFactor = Math.max(1.0, Math.min(trafficFactor, 1.30));

  // S1-B: smooth traffic factor transitions to prevent instant ETA spikes
  const routeKey = routeId ?? '__default__';
  const prevFactor = _prevTrafficFactor.get(routeKey);
  if (prevFactor != null && Math.abs(trafficFactor - prevFactor) > 0.05) {
    trafficFactor = Math.round((0.7 * prevFactor + 0.3 * trafficFactor) * 100) / 100;
    trafficFactor = Math.max(1.0, Math.min(trafficFactor, 1.30));
  }
  _prevTrafficFactor.set(routeKey, trafficFactor);

  const trafficLevel: TrafficLevel =
    trafficFactor >= 1.20 ? 'HIGH' :
    trafficFactor >= 1.10 ? 'MODERATE' :
    'LOW';

  // ── 4. Stop Dwell Delay ──
  let perStopDwell: number; // seconds
  if (occupancyPercent > 70) {
    perStopDwell = DWELL_HIGH_SEC;
  } else if (occupancyPercent > 40) {
    perStopDwell = DWELL_MED_SEC;
  } else {
    perStopDwell = DWELL_LOW_SEC;
  }

  // S1-C: clamp each stop's dwell to DWELL_MAX_SEC to prevent unrealistic spikes
  const clampedDwell = Math.min(perStopDwell, DWELL_MAX_SEC);
  const totalStopDelaySec = upcomingStopCount * clampedDwell;
  const stopDelayMin = totalStopDelaySec / 60;

  // ── 5. Congestion Penalty ──
  let congestionPenaltyMin = 0;
  let congestionLevel: CongestionLevel = 'NONE';

  const hasBusCongestion = nearbyBusCount >= CONGESTION_BUS_RADIUS_THRESHOLD;
  const hasBusHeavyCongestion = nearbyBusCount >= CONGESTION_BUS_HEAVY_THRESHOLD;
  const hasOccupancyCongestion = routeOccupancyAvg > CONGESTION_OCCUPANCY_THRESHOLD;

  // S8: 5+ buses → HEAVY regardless; 3+ AND high occ → HEAVY; 3+ OR high occ → MODERATE
  if (hasBusHeavyCongestion || (hasBusCongestion && hasOccupancyCongestion)) {
    congestionPenaltyMin = 3;
    congestionLevel = 'HEAVY';
  } else if (hasBusCongestion || hasOccupancyCongestion) {
    congestionPenaltyMin = 2;
    congestionLevel = 'MODERATE';
  } else if (nearbyBusCount >= 2 || routeOccupancyAvg > 50) {
    congestionPenaltyMin = 1;
    congestionLevel = 'LIGHT';
  }

  // ── 6. Final ETA ──
  const baseMinutes = (distanceKm / weightedSpeed) * 60 * trafficFactor;
  const rawETA = baseMinutes + stopDelayMin + congestionPenaltyMin;

  // S9: guard against NaN/Infinity from bad inputs
  const estimatedMinutes = (!isFinite(rawETA) || isNaN(rawETA))
    ? 0
    : Math.max(Math.round(rawETA), 0);

  // Format
  let formattedETA: string;
  if (estimatedMinutes < 1) {
    formattedETA = 'Arriving now';
  } else if (estimatedMinutes < 60) {
    formattedETA = `${estimatedMinutes} min`;
  } else {
    const h = Math.floor(estimatedMinutes / 60);
    const m = estimatedMinutes % 60;
    formattedETA = `${h}h ${m}m`;
  }

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    estimatedMinutes,
    formattedETA,
    trafficLevel,
    congestionLevel,
    trafficFactor: Math.round(trafficFactor * 100) / 100,
    congestionPenaltyMin,
    stopDelayMin: Math.round(stopDelayMin * 10) / 10,
    weightedSpeedKmh: Math.round(weightedSpeed * 100) / 100,
  };
}

// ── Quick synchronous ETA (for simulation/bulk, no Redis) ───────────────────

export function calculateQuickETA(
  busLat: number,
  busLng: number,
  targetLat: number,
  targetLng: number,
  avgSpeedKmh: number,
): { distanceKm: number; estimatedMinutes: number; formattedETA: string } {
  const distanceKm = haversineDistance(busLat, busLng, targetLat, targetLng);
  const speedKmh = Math.max(avgSpeedKmh, MIN_SPEED_KMH);
  const estimatedMinutes = Math.round((distanceKm / speedKmh) * 60);

  let formattedETA: string;
  if (estimatedMinutes < 1) {
    formattedETA = 'Arriving now';
  } else if (estimatedMinutes < 60) {
    formattedETA = `${estimatedMinutes} min`;
  } else {
    const h = Math.floor(estimatedMinutes / 60);
    const m = estimatedMinutes % 60;
    formattedETA = `${h}h ${m}m`;
  }

  return { distanceKm: Math.round(distanceKm * 100) / 100, estimatedMinutes, formattedETA };
}
