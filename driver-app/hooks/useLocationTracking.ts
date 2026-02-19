/**
 * HydGo Driver — GPS location tracking hook (Phase 5 — Reliability Layer)
 * Uses expo-location with production settings.
 *
 * Phase 5 additions:
 *   - Adaptive GPS: 5s interval when slow (< 5 km/h), 3s when moving
 *   - Buffer fallback: push to locationBuffer when DISCONNECTED
 *   - Stronger duplicate watcher guard
 *   - Auto-restart after disconnect recovery
 *
 * Config (matching backend expectations):
 *   Accuracy:  Balanced (battery-efficient)
 *   Distance:  5m filter
 *   Throttle:  3s trailing-edge
 *
 * Safety:
 *   - Single watcher (no duplicates)
 *   - Validates before emit (accuracy ≤ 100m, speed ≤ 120 km/h)
 *   - Stops when status is OFFLINE
 *   - Clean cleanup on unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { useDriverStore } from '../store/driverStore';
import { useLocationBuffer } from '../store/locationBuffer';
import { validateLocation } from '../utils/validateLocation';
import { throttle } from '../utils/throttle';
import type { LocationUpdatePayload } from '../lib/types';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const SLOW_SPEED_KMH = 5;
const FAST_INTERVAL_MS = 3000;
const SLOW_INTERVAL_MS = 5000;
const MPS_TO_KMH = 3.6;

interface UseLocationTrackingOptions {
  emit: (event: string, payload: LocationUpdatePayload) => void;
}

export function useLocationTracking({ emit }: UseLocationTrackingOptions) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const mountedRef = useRef(true);
  const lastSpeedRef = useRef(0);
  const currentIntervalRef = useRef(FAST_INTERVAL_MS);
  const isStartingRef = useRef(false);

  const status = useDriverStore((s) => s.status);
  const busId = useDriverStore((s) => s.busId);
  const setGpsActive = useDriverStore((s) => s.setGpsActive);
  const setError = useDriverStore((s) => s.setError);
  const setBufferSize = useDriverStore((s) => s.setBufferSize);

  // Throttled emission — trailing-edge 3s
  const throttledEmit = useRef(
    throttle((payload: LocationUpdatePayload) => {
      emit('driver:location:update', payload);
    }, 3000),
  ).current;

  const stopTracking = useCallback(() => {
    if (watcherRef.current) {
      try {
        // Safely remove subscription with type check
        if (watcherRef.current && typeof watcherRef.current.remove === 'function') {
          watcherRef.current.remove();
        }
      } catch (error) {
        // Silently handle cleanup errors during unmount
        console.warn('Location tracking cleanup error:', error);
      } finally {
        watcherRef.current = null;
      }
    }
    setGpsActive(false);
    isStartingRef.current = false;
  }, [setGpsActive]);

  const startTracking = useCallback(async () => {
    // Guard: no duplicate watchers (atomic check-and-set)
    if (watcherRef.current || isStartingRef.current) return;
    isStartingRef.current = true;

    const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      setError('Location permission denied');
      isStartingRef.current = false;
      return;
    }

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: currentIntervalRef.current,
          distanceInterval: 5,
        },
        (loc) => {
          if (!mountedRef.current) return;

          const result = validateLocation(loc);

          if (!result.valid) {
            // Silently skip invalid readings
            return;
          }

          const currentStore = useDriverStore.getState();

          // Track speed for adaptive interval
          const speedKmh = result.location.speed * MPS_TO_KMH;
          lastSpeedRef.current = speedKmh;

          // Adapt interval based on speed
          const desiredInterval = speedKmh < SLOW_SPEED_KMH ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS;
          if (desiredInterval !== currentIntervalRef.current) {
            currentIntervalRef.current = desiredInterval;
            // Note: expo-location doesn't support dynamic interval changes
            // The new interval will apply on next watcher restart
          }

          if (currentStore.status === 'OFFLINE' || !currentStore.busId) {
            return;
          }

          const payload: LocationUpdatePayload = {
            busId: currentStore.busId,
            lat: result.location.latitude,
            lng: result.location.longitude,
            speed: result.location.speed,
            heading: result.location.heading,
            accuracy: result.location.accuracy,
            passengerCount: currentStore.passengerCount,
          };

          // Buffer fallback when disconnected
          if (currentStore.status === 'DISCONNECTED' || !currentStore.socketConnected) {
            useLocationBuffer.getState().push({
              lat: result.location.latitude,
              lng: result.location.longitude,
              speed: result.location.speed,
              heading: result.location.heading,
              accuracy: result.location.accuracy,
              timestamp: Date.now(),
            });
            setBufferSize(useLocationBuffer.getState().size());
            return;
          }

          throttledEmit(payload);
        },
      );

      watcherRef.current = subscription;
      isStartingRef.current = false;
      setGpsActive(true);
    } catch {
      isStartingRef.current = false;
      setError('Failed to start GPS tracking');
    }
  }, [emit, throttledEmit, setGpsActive, setError, setBufferSize]);

  // Auto-stop when status goes OFFLINE
  useEffect(() => {
    if (status === 'OFFLINE') {
      stopTracking();
    }
  }, [status, stopTracking]);

  // Auto-restart GPS when reconnecting from DISCONNECTED → ONLINE
  // Socket.io auto-reconnect triggers driver:init → status becomes ONLINE
  // but GPS was stopped during DISCONNECTED — restart it
  useEffect(() => {
    if (
      (status === 'ONLINE' || status === 'ON_TRIP') &&
      !watcherRef.current &&
      !isStartingRef.current &&
      busId
    ) {
      startTracking();
    }
  }, [status, busId, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (watcherRef.current) {
        try {
          // Safely remove subscription during unmount
          if (watcherRef.current && typeof watcherRef.current.remove === 'function') {
            watcherRef.current.remove();
          }
        } catch (error) {
          // Silently handle cleanup errors during unmount/logout
          console.warn('Location tracking unmount cleanup error:', error);
        } finally {
          watcherRef.current = null;
        }
      }
    };
  }, []);

  return { startTracking, stopTracking };
}
