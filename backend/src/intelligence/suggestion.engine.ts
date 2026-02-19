// ── Smart Suggestion Engine ─────────────────────────────────────────────────
// Ranks nearby buses to give passengers "Best Bus" recommendations.
//
// Score formula (lower = better):
//   (etaSeconds × 0.5)
// + (distanceMeters × 0.2)
// + (occupancyPercent × 0.2)
// + (trafficFactor × 100 × 0.1)
// - (confidence × 50)
//
// Returns top 3 buses sorted by score.

export interface SuggestionBus {
  busId: string;
  etaMinutes: number;
  distanceMeters: number;
  occupancyPercent: number;
  trafficFactor: number;
  confidence: number;
  // Passthrough fields for display
  registrationNo?: string;
  routeNumber?: string;
  routeName?: string;
}

export interface SuggestionResult {
  busId: string;
  score: number;
  rank: number; // 1 = best
  reason: string;
  // Passthrough
  registrationNo?: string;
  routeNumber?: string;
  routeName?: string;
  etaMinutes: number;
  distanceMeters: number;
  occupancyPercent: number;
  confidence: number;
}

// S2: rebalanced weights so high-occupancy/low-confidence buses don't out-rank
// comfortable alternatives. Confidence bonus scaled to ×100 to properly offset ETA advantage.
const WEIGHT_ETA = 0.4;
const WEIGHT_DISTANCE = 0.2;
const WEIGHT_OCCUPANCY = 0.15;
const WEIGHT_TRAFFIC = 0.15;
const CONFIDENCE_BONUS = 120;
const MAX_SUGGESTIONS = 3;

export function rankBuses(buses: SuggestionBus[]): SuggestionResult[] {
  if (buses.length === 0) return [];

  const scored = buses.map((bus) => {
    const etaSeconds = bus.etaMinutes * 60;
    const score =
      (etaSeconds * WEIGHT_ETA) +
      (bus.distanceMeters * WEIGHT_DISTANCE) +
      (bus.occupancyPercent * WEIGHT_OCCUPANCY) +
      (bus.trafficFactor * 100 * WEIGHT_TRAFFIC) -
      (bus.confidence * CONFIDENCE_BONUS);

    return { ...bus, score: isFinite(score) ? score : Infinity };
  });

  // Sort ascending (lower score = better)
  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, MAX_SUGGESTIONS).map((bus, index) => ({
    busId: bus.busId,
    score: Math.round(bus.score * 100) / 100,
    rank: index + 1,
    reason: generateReason(bus, index),
    registrationNo: bus.registrationNo,
    routeNumber: bus.routeNumber,
    routeName: bus.routeName,
    etaMinutes: bus.etaMinutes,
    distanceMeters: bus.distanceMeters,
    occupancyPercent: bus.occupancyPercent,
    confidence: bus.confidence,
  }));
}

function generateReason(bus: SuggestionBus & { score: number }, rank: number): string {
  if (rank === 0) {
    // #1 bus — explain why it's the best
    if (bus.etaMinutes <= 3 && bus.occupancyPercent < 50) {
      return 'Arriving soon with plenty of seats';
    }
    if (bus.etaMinutes <= 3) {
      return 'Arriving soon';
    }
    if (bus.occupancyPercent < 30) {
      return 'Fastest option with empty seats';
    }
    if (bus.distanceMeters < 200) {
      return 'Very close by';
    }
    return 'Best overall option';
  }

  // #2, #3 — comparative reasons
  if (bus.occupancyPercent < 30) {
    return 'Less crowded alternative';
  }
  if (bus.distanceMeters < 300) {
    return 'Close alternative';
  }
  return 'Alternative option';
}
