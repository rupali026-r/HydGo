/**
 * HydGo Driver — Orchestration hook (Phase 5 — Reliability Layer)
 * Coordinates socket connection, GPS tracking, and state machine transitions.
 * This is the main control interface for going online/offline and managing trips.
 *
 * Phase 5 additions:
 *   - Background tracking: request bg permissions, start/stop background task
 *   - Duplicate trip protection: check activeTrip before startTrip
 *   - Network monitoring: auto pause/resume on connectivity loss/restore
 *   - Session restore: auto-reconnect after crash
 *
 * Flow:
 *   goOnline  → connect socket → wait for driver:init → start GPS + background task
 *   goOffline → stop GPS + background task → disconnect socket → set OFFLINE
 *   startTrip → guard duplicate → emit driver:trip:start → server confirms → ON_TRIP
 *   endTrip   → emit driver:trip:end → server confirms → ONLINE
 */

import { useCallback, useRef } from 'react';
import { useDriverStore } from '../store/driverStore';
import { useDriverSocket } from './useDriverSocket';
import { useLocationTracking } from './useLocationTracking';
import { useNetworkMonitor } from './useNetworkMonitor';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../lib/backgroundLocation.task';

export function useDriverState() {
  const status = useDriverStore((s) => s.status);
  const activeTripId = useDriverStore((s) => s.activeTripId);
  const transition = useDriverStore((s) => s.transition);
  const setError = useDriverStore((s) => s.setError);
  const setBackgroundTrackingActive = useDriverStore((s) => s.setBackgroundTrackingActive);
  const setNetworkOnline = useDriverStore((s) => s.setNetworkOnline);
  const reset = useDriverStore((s) => s.reset);

  // Concurrency lock — prevents rapid toggle race conditions
  const busyRef = useRef(false);

  const { connect, disconnect, emit, isConnected } = useDriverSocket();
  const { startTracking, stopTracking } = useLocationTracking({ emit });

  /* ── Network monitoring ──────────────────────────────────────────────── */

  const handleNetworkLost = useCallback(() => {
    setNetworkOnline(false);
    // Socket.io will detect disconnect and trigger DISCONNECTED transition
    // Location tracking continues and buffers to locationBuffer
  }, [setNetworkOnline]);

  const handleNetworkRestored = useCallback(() => {
    setNetworkOnline(true);
    // Socket.io auto-reconnect will fire, which triggers:
    //   - driver:init → store ONLINE
    //   - buffer replay
    //   - heartbeat restart
    // No manual action needed — the socket hook handles everything
  }, [setNetworkOnline]);

  useNetworkMonitor({
    onNetworkLost: handleNetworkLost,
    onNetworkRestored: handleNetworkRestored,
  });

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const goOnline = useCallback(async () => {
    if (busyRef.current) return;
    
    // Lifecycle validation: must not be in pending/no-bus states
    if (status === 'PENDING_APPROVAL') {
      setError('Account pending admin approval');
      return;
    }
    if (status === 'NO_BUS_ASSIGNED') {
      setError('No bus assigned - contact admin');
      return;
    }
    
    if (status !== 'OFFLINE' && status !== 'DISCONNECTED') {
      setError(`Cannot go online from ${status}`);
      return;
    }

    // Extra validation: ensure bus is actually assigned in store
    const store = useDriverStore.getState();
    if (!store.busId || !store.registrationNo) {
      setError('No bus assigned - contact admin');
      return;
    }

    busyRef.current = true;
    try {
      await connect();

      // Start foreground GPS tracking
      await startTracking();

      // Start background tracking (requests bg permission if needed)
      const bgStarted = await startBackgroundTracking();
      setBackgroundTrackingActive(bgStarted);
    } catch {
      setError('Failed to go online');
    } finally {
      busyRef.current = false;
    }
  }, [status, connect, startTracking, setError, setBackgroundTrackingActive]);

  const goOffline = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      // Stop all tracking
      stopTracking();

      // Stop background tracking
      await stopBackgroundTracking();
      setBackgroundTrackingActive(false);

      if (isConnected()) {
        // Let the server know we're going offline gracefully
        disconnect();
      }

      // Force to OFFLINE regardless of current state
      const currentStatus = useDriverStore.getState().status;
      if (currentStatus !== 'OFFLINE') {
        transition('OFFLINE');
      }
    } finally {
      busyRef.current = false;
    }
  }, [stopTracking, disconnect, isConnected, transition, setBackgroundTrackingActive]);

  const startTrip = useCallback(() => {
    if (status !== 'ONLINE') {
      setError('Must be ONLINE to start a trip');
      return;
    }

    // Duplicate trip protection
    if (activeTripId) {
      setError(`Trip already active: ${activeTripId}`);
      return;
    }

    emit('driver:trip:start');
    // Server will confirm with trip:started event → store handles transition
  }, [status, activeTripId, emit, setError]);

  const endTrip = useCallback(() => {
    if (status !== 'ON_TRIP') {
      setError('No active trip to end');
      return;
    }
    emit('driver:trip:end');
    // Server will confirm with trip:ended event → store handles transition
  }, [status, emit, setError]);

  return {
    status,
    goOnline,
    goOffline,
    startTrip,
    endTrip,
    isConnected,
  };
}
