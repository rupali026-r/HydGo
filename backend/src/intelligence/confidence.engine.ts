// ── Confidence Score Engine ─────────────────────────────────────────────────
// Calculates how confident we are in the current ETA prediction.
//
// Starts at 1.0 (perfect confidence), subtracts penalties:
//   -0.20  traffic HIGH
//   -0.10  congestion MODERATE
//   -0.20  congestion HIGH/HEAVY
//   -0.10  GPS accuracy > 80m
//   -0.10  driver reconnected < 2 min ago
//   -0.05  speed = 0 (stopped, uncertain when bus resumes)
//   -0.05  low sample count (< 5 historical speed samples)
//
// Clamped to minimum 0.40 — we never show "zero confidence".

import type { TrafficLevel, CongestionLevel } from './eta.engine';

export interface ConfidenceInput {
  trafficLevel: TrafficLevel;
  congestionLevel: CongestionLevel;
  gpsAccuracyMeters?: number;
  reconnectedAgoMs?: number;  // ms since last reconnection, undefined = no recent reconnect
  currentSpeedKmh: number;
  historicalSampleCount?: number;
}

export interface ConfidenceResult {
  score: number;        // 0.40 – 1.00
  label: string;        // 'HIGH' | 'MEDIUM' | 'LOW'
  penalties: string[];  // human‑readable explanations
}

// S4: increased traffic penalty from 0.20→0.25 to ensure confidence reflects heavy traffic
const PENALTY_TRAFFIC_HIGH = 0.25;
const PENALTY_CONGESTION_MODERATE = 0.10;
const PENALTY_CONGESTION_HEAVY = 0.20;
const PENALTY_GPS_BAD = 0.10;
const PENALTY_RECONNECT_RECENT = 0.10;
const PENALTY_STOPPED = 0.05;
const PENALTY_LOW_SAMPLES = 0.05;

const GPS_ACCURACY_THRESHOLD_M = 80;
const RECONNECT_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const MIN_SAMPLE_COUNT = 5;
// S4: raised floor from 0.40→0.45 to prevent excessively low confidence
const MIN_CONFIDENCE = 0.45;

export function calculateConfidence(input: ConfidenceInput): ConfidenceResult {
  let score = 1.0;
  const penalties: string[] = [];

  // Traffic penalty
  if (input.trafficLevel === 'HIGH') {
    score -= PENALTY_TRAFFIC_HIGH;
    penalties.push('Heavy traffic');
  }

  // Congestion penalty
  if (input.congestionLevel === 'HEAVY') {
    score -= PENALTY_CONGESTION_HEAVY;
    penalties.push('Heavy congestion');
  } else if (input.congestionLevel === 'MODERATE') {
    score -= PENALTY_CONGESTION_MODERATE;
    penalties.push('Moderate congestion');
  }

  // GPS accuracy
  if (input.gpsAccuracyMeters != null && input.gpsAccuracyMeters > GPS_ACCURACY_THRESHOLD_M) {
    score -= PENALTY_GPS_BAD;
    penalties.push('Low GPS accuracy');
  }

  // Recent reconnect
  if (input.reconnectedAgoMs != null && input.reconnectedAgoMs < RECONNECT_THRESHOLD_MS) {
    score -= PENALTY_RECONNECT_RECENT;
    penalties.push('Recent reconnection');
  }

  // Bus stopped
  if (input.currentSpeedKmh <= 0) {
    score -= PENALTY_STOPPED;
    penalties.push('Bus currently stopped');
  }

  // Low historical data
  if (input.historicalSampleCount != null && input.historicalSampleCount < MIN_SAMPLE_COUNT) {
    score -= PENALTY_LOW_SAMPLES;
    penalties.push('Limited historical data');
  }

  // S9: guard against NaN
  if (isNaN(score) || !isFinite(score)) score = MIN_CONFIDENCE;

  // Clamp
  score = Math.max(MIN_CONFIDENCE, Math.min(1.0, Math.round(score * 100) / 100));

  // Label
  let label: string;
  if (score >= 0.80) {
    label = 'HIGH';
  } else if (score >= 0.60) {
    label = 'MEDIUM';
  } else {
    label = 'LOW';
  }

  return { score, label, penalties };
}
