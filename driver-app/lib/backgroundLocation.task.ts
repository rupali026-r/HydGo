/**
 * HydGo Driver — Background Location Task
 *
 * Uses expo-task-manager + expo-location for OS-level background tracking.
 * When the app is backgrounded or the screen is locked, the OS delivers
 * location updates to this task, which validates and emits them via socket.
 *
 * If socket is disconnected, locations are buffered for anti-teleport replay.
 *
 * Validation mirrors backend safety rules:
 *   accuracy ≤ 100m
 *   speed    ≤ 120 km/h
 *   throttle  3s between emissions
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useDriverStore } from '../store/driverStore';
import { useLocationBuffer } from '../store/locationBuffer';

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const LOCATION_BACKGROUND_TASK = 'HYDGO_DRIVER_BACKGROUND_LOCATION';

const MAX_ACCURACY_M = 100;
const MAX_SPEED_KMH = 120;
const MPS_TO_KMH = 3.6;
const THROTTLE_MS = 3000;

/** Module-scoped (survives across task invocations, not app restarts) */
let _lastEmitTimestamp = 0;

/* ── Shared socket reference for background task ─────────────────────────── */

import type { Socket } from 'socket.io-client';

let _backgroundSocket: Socket | null = null;

export function setBackgroundSocket(socket: Socket | null): void {
  _backgroundSocket = socket;
}

export function getBackgroundSocket(): Socket | null {
  return _backgroundSocket;
}

/* ── Task Definition ─────────────────────────────────────────────────────── */

interface TaskBody {
  locations?: Location.LocationObject[];
  error?: { message: string };
}

TaskManager.defineTask<TaskBody>(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundLocation] Task error:', error.message);
    return;
  }

  const locations = data?.locations;
  if (!locations || locations.length === 0) return;

  // Process only the most recent location
  const loc = locations[locations.length - 1];
  const { latitude, longitude, accuracy, speed, heading } = loc.coords;

  // ── Validation ──
  if (accuracy !== null && accuracy > MAX_ACCURACY_M) return;

  const speedMs = speed ?? 0;
  const speedKmh = Math.abs(speedMs) * MPS_TO_KMH;
  if (speedKmh > MAX_SPEED_KMH) return;

  // ── Throttle ──
  const now = Date.now();
  if (now - _lastEmitTimestamp < THROTTLE_MS) return;
  _lastEmitTimestamp = now;

  // ── Read store state ──
  const store = useDriverStore.getState();
  if (store.status === 'OFFLINE' || !store.busId) return;

  const payload = {
    busId: store.busId,
    lat: latitude,
    lng: longitude,
    speed: speedKmh,
    heading: heading ?? 0,
    accuracy: accuracy ?? 0,
    passengerCount: store.passengerCount,
  };

  // ── Emit or buffer ──
  const socket = getBackgroundSocket();
  if (socket?.connected) {
    socket.emit('driver:location:update', payload);
  } else {
    // Buffer for anti-teleport replay on reconnect
    useLocationBuffer.getState().push({
      lat: latitude,
      lng: longitude,
      speed: speedKmh,
      heading: heading ?? 0,
      accuracy: accuracy ?? 0,
      timestamp: now,
    });
  }
});

/* ── Start / Stop helpers ────────────────────────────────────────────────── */

let _isBackgroundTracking = false;

export async function startBackgroundTracking(): Promise<boolean> {
  if (_isBackgroundTracking) return true;

  // Request background permissions
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  if (Platform.OS !== 'web') {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      console.warn('[BackgroundLocation] Background permission denied');
      // Continue with foreground-only — still useful when app is visible
    }
  }

  // Check if task is already registered
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    LOCATION_BACKGROUND_TASK,
  );

  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
      distanceInterval: 5,
      deferredUpdatesInterval: 3000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'HydGo Driver',
        notificationBody: 'Live tracking active',
        notificationColor: '#ffffff',
      },
    });
  }

  _isBackgroundTracking = true;
  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  if (!_isBackgroundTracking) return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      LOCATION_BACKGROUND_TASK,
    );
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
    }
  } catch {
    // Task may already be stopped
  }

  _isBackgroundTracking = false;
}

export function isBackgroundTrackingActive(): boolean {
  return _isBackgroundTracking;
}
