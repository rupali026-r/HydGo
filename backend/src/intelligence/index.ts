// ── Intelligence Module Barrel Export ────────────────────────────────────────
// Central export for all intelligence engines.

export { recordSpeed, getRouteAverageSpeed, getAllRouteSpeedAverages, getTimeOfDayTrafficFactor } from './speed-memory';
export { calculatePredictiveETA, calculateQuickETA } from './eta.engine';
export type { PredictiveETAResult, ETAInput, TrafficLevel, CongestionLevel } from './eta.engine';
export { calculateConfidence } from './confidence.engine';
export type { ConfidenceInput, ConfidenceResult } from './confidence.engine';
export { rankBuses } from './suggestion.engine';
export type { SuggestionBus, SuggestionResult } from './suggestion.engine';
export { recordDelay, recordDisconnect, recordHighCongestion, getRouteReliability, getAllRouteReliabilities } from './reliability.engine';
export type { ReliabilityResult, ReliabilityLabel } from './reliability.engine';
