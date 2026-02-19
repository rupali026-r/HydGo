import { logger } from '../../utils/logger';
import { haversineDistance } from '../../utils/geo';

// ── Driver Safety Validation Layer ──────────────────────────────────────────
//
// Validates incoming driver location updates for:
//   1. GPS accuracy threshold (reject if accuracy > 100m)
//   2. Speed sanity check (reject if > 120 km/h)
//   3. Rate limiting / throttling (max 1 update per 2 seconds per driver)
//   4. Position jump detection (reject if impossible movement)
//
// ────────────────────────────────────────────────────────────────────────────

const MAX_GPS_ACCURACY_M = 100;
const MAX_SPEED_KMH = 120;
const MIN_UPDATE_INTERVAL_MS = 2_000; // Throttle: 1 update per 2s
const MAX_JUMP_KM = 0.5; // 500m max jump between consecutive updates

interface DriverLocationUpdate {
  busId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  passengerCount?: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Track last update per driver for throttling + jump detection
interface LastUpdate {
  timestamp: number;
  latitude: number;
  longitude: number;
}

const lastUpdates = new Map<string, LastUpdate>();

// ── Validation Functions ────────────────────────────────────────────────────

/**
 * Validate a driver location update.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateDriverLocationUpdate(
  driverId: string,
  update: DriverLocationUpdate,
): ValidationResult {
  // 1. Basic coordinate validation
  if (
    typeof update.latitude !== 'number' ||
    typeof update.longitude !== 'number' ||
    update.latitude < -90 || update.latitude > 90 ||
    update.longitude < -180 || update.longitude > 180
  ) {
    return { valid: false, reason: 'Invalid coordinates' };
  }

  // 2. GPS accuracy check
  if (update.accuracy !== undefined && update.accuracy > MAX_GPS_ACCURACY_M) {
    return {
      valid: false,
      reason: `GPS accuracy too low: ${update.accuracy}m (max ${MAX_GPS_ACCURACY_M}m)`,
    };
  }

  // 3. Speed sanity check
  if (update.speed !== undefined && update.speed > MAX_SPEED_KMH) {
    logger.warn('Driver speed exceeds limit', {
      driverId,
      speed: update.speed,
      maxSpeed: MAX_SPEED_KMH,
    });
    return {
      valid: false,
      reason: `Speed ${update.speed} km/h exceeds maximum ${MAX_SPEED_KMH} km/h`,
    };
  }

  // 4. Throttle check
  const now = Date.now();
  const last = lastUpdates.get(driverId);

  if (last && now - last.timestamp < MIN_UPDATE_INTERVAL_MS) {
    return {
      valid: false,
      reason: 'Update throttled — too frequent',
    };
  }

  // 5. Position jump detection (only if we have a previous position)
  if (last) {
    const jumpKm = haversineDistance(
      last.latitude, last.longitude,
      update.latitude, update.longitude,
    );

    if (jumpKm > MAX_JUMP_KM) {
      logger.warn('Driver position jump detected', {
        driverId,
        jumpMeters: Math.round(jumpKm * 1000),
        maxJumpMeters: MAX_JUMP_KM * 1000,
      });
      return {
        valid: false,
        reason: `Position jump ${Math.round(jumpKm * 1000)}m exceeds maximum ${MAX_JUMP_KM * 1000}m`,
      };
    }
  }

  // 6. Passenger count validation
  if (update.passengerCount !== undefined) {
    if (update.passengerCount < 0 || !Number.isInteger(update.passengerCount)) {
      return { valid: false, reason: 'Invalid passenger count' };
    }
  }

  // All checks passed — record this update
  lastUpdates.set(driverId, {
    timestamp: now,
    latitude: update.latitude,
    longitude: update.longitude,
  });

  return { valid: true };
}

/**
 * Clean up tracking data for a driver (on disconnect).
 */
export function clearDriverSafetyData(driverId: string): void {
  lastUpdates.delete(driverId);
}

/**
 * Reset all tracking data (on shutdown).
 */
export function resetAllSafetyData(): void {
  lastUpdates.clear();
}
