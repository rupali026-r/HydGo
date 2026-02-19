// ── Sort & Suggestion Utilities ─────────────────────────────────────────────
// Smart bus sorting for the passenger UI

import type { BusState, OccupancyLevel } from '../types';

const OCCUPANCY_WEIGHT: Record<OccupancyLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  FULL: 3,
};

/**
 * Score a bus for smart suggestions.
 * Lower score = better suggestion.
 *
 * Primary: ETA ascending
 * Secondary: Occupancy lowest
 * Tertiary: Distance smallest
 */
function busScore(bus: BusState): number {
  const eta = bus.eta?.estimatedMinutes ?? 999;
  const occ = OCCUPANCY_WEIGHT[bus.occupancy.level];
  const dist = (bus.distanceMeters ?? 99999) / 1000; // normalize to km

  return eta * 100 + occ * 10 + dist;
}

/** Sort buses by smart suggestion score */
export function sortBySuggestion(buses: BusState[]): BusState[] {
  return [...buses].sort((a, b) => busScore(a) - busScore(b));
}

/** Get top N smartest suggestions */
export function getSmartSuggestions(buses: BusState[], count = 3): BusState[] {
  return sortBySuggestion(buses.filter((b) => b.occupancy.level !== 'FULL')).slice(0, count);
}

/** Group buses by route */
export function groupByRoute(buses: BusState[]): Map<string, BusState[]> {
  const grouped = new Map<string, BusState[]>();
  for (const bus of buses) {
    const key = bus.routeNumber ?? 'Unknown';
    const arr = grouped.get(key) ?? [];
    arr.push(bus);
    grouped.set(key, arr);
  }
  return grouped;
}
