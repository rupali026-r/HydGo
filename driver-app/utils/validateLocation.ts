/**
 * HydGo Driver — GPS validation
 * Mirrors backend driver-safety.service.ts rules:
 *   accuracy ≤ 100m
 *   speed    ≤ 120 km/h
 */

import type { LocationValidation } from '../lib/types';

interface RawLocation {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  };
  timestamp: number;
}

const MAX_ACCURACY_M = 100;
const MAX_SPEED_KMH = 120;
const MPS_TO_KMH = 3.6;

export function validateLocation(loc: RawLocation): LocationValidation {
  const { latitude, longitude, accuracy, speed, heading } = loc.coords;

  // Accuracy check
  if (accuracy !== null && accuracy > MAX_ACCURACY_M) {
    return { valid: false, reason: `Accuracy too low: ${accuracy.toFixed(0)}m > ${MAX_ACCURACY_M}m` };
  }

  // Speed check (GPS returns m/s, convert to km/h)
  const speedMs = speed ?? 0;
  const speedKmh = Math.abs(speedMs) * MPS_TO_KMH;
  if (speedKmh > MAX_SPEED_KMH) {
    return { valid: false, reason: `Speed too high: ${speedKmh.toFixed(0)} km/h > ${MAX_SPEED_KMH} km/h` };
  }

  return {
    valid: true,
    location: {
      latitude,
      longitude,
      speed: speedKmh,
      heading: heading ?? 0,
      accuracy: accuracy ?? 0,
    },
  };
}
