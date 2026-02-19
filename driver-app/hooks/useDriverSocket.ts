/**
 * HydGo Driver — Socket.io hook (Phase 5 — Reliability Layer)
 * Connects to backend /driver namespace with JWT auth.
 * Handles all server events per the tracking.handler.ts contract.
 *
 * Phase 5 additions:
 *   - Heartbeat: emit driver:heartbeat every 20s, force DISCONNECTED if no ack for 40s
 *   - Buffer replay: drain locationBuffer on reconnect, emit each in order
 *   - Crash recovery: driver:init restores activeTrip + auto-resumes tracking
 *   - Background socket bridge: setBackgroundSocket() for TaskManager
 *
 * Safety:
 *   - Single socket instance (no duplicates)
 *   - Clean disconnect on unmount
 *   - Reconnect logic built-in
 *   - Heartbeat auto-stops on disconnect
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from '../lib/api';
import { getItem } from '../lib/storage';
import { useDriverStore } from '../store/driverStore';
import { useLocationBuffer } from '../store/locationBuffer';
import { setBackgroundSocket } from '../lib/backgroundLocation.task';
import type {
  DriverInitPayload,
  LocationConfirmed,
  LocationRejected,
  TripStarted,
  TripEnded,
  SocketError,
  LocationUpdatePayload,
} from '../lib/types';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 40_000;

/* ── Hook ──────────────────────────────────────────────────────────────────── */

interface UseDriverSocketReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  emit: <T>(event: string, payload?: T) => void;
  isConnected: () => boolean;
}

export function useDriverSocket(): UseDriverSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeatAckRef = useRef<number>(Date.now());

  // Store selectors
  const setInit = useDriverStore((s) => s.setInit);
  const transition = useDriverStore((s) => s.transition);
  const setTripStarted = useDriverStore((s) => s.setTripStarted);
  const setTripEnded = useDriverStore((s) => s.setTripEnded);
  const setOccupancy = useDriverStore((s) => s.setOccupancy);
  const setSocketConnected = useDriverStore((s) => s.setSocketConnected);
  const setError = useDriverStore((s) => s.setError);
  const setLastLocationTimestamp = useDriverStore((s) => s.setLastLocationTimestamp);
  const setLastHeartbeatAt = useDriverStore((s) => s.setLastHeartbeatAt);
  const setBufferSize = useDriverStore((s) => s.setBufferSize);
  const reset = useDriverStore((s) => s.reset);

  /* ── Heartbeat ────────────────────────────────────────────────────────── */

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    lastHeartbeatAckRef.current = Date.now();

    heartbeatTimerRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        stopHeartbeat();
        return;
      }

      socket.emit('driver:heartbeat', { timestamp: Date.now() });

      // Check if we've missed acks for too long
      const elapsed = Date.now() - lastHeartbeatAckRef.current;
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        console.warn('[Heartbeat] No ack for', elapsed, 'ms — forcing DISCONNECTED');
        stopHeartbeat();
        const currentStatus = useDriverStore.getState().status;
        if (currentStatus === 'ONLINE' || currentStatus === 'ON_TRIP' || currentStatus === 'IDLE') {
          transition('DISCONNECTED');
        }
        setSocketConnected(false);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat, transition, setSocketConnected]);

  /* ── Buffer Replay ───────────────────────────────────────────────────── */

  const replayBuffer = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const entries = useLocationBuffer.getState().drain();
    if (entries.length === 0) return;

    const store = useDriverStore.getState();
    if (!store.busId) return;

    console.log('[BufferReplay] Replaying', entries.length, 'buffered locations');

    // Emit each buffered location in chronological order
    for (const entry of entries) {
      const payload: LocationUpdatePayload = {
        busId: store.busId,
        lat: entry.lat,
        lng: entry.lng,
        speed: entry.speed,
        heading: entry.heading,
        accuracy: entry.accuracy,
        passengerCount: store.passengerCount,
      };
      socket.emit('driver:location:update', payload);
    }

    setBufferSize(0);
  }, [setBufferSize]);

  /* ── Connect ─────────────────────────────────────────────────────────── */

  const connect = useCallback(async () => {
    // Guard: no duplicate connections
    if (socketRef.current?.connected) return;

    const token = await getItem('accessToken');
    if (!token) {
      setError('No access token');
      return;
    }

    // Clean any stale socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setBackgroundSocket(null);
    }

    const socket = io(`${API_BASE}/driver`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });

    socketRef.current = socket;
    setBackgroundSocket(socket);

    /* ── Connection lifecycle ───────────────────────────────────── */

    socket.on('connect', () => {
      if (!mountedRef.current) return;
      setSocketConnected(true);
      setError(null);
      startHeartbeat();
    });

    socket.on('disconnect', (reason) => {
      if (!mountedRef.current) return;
      setSocketConnected(false);
      stopHeartbeat();

      // Only transition to DISCONNECTED if we were online or on trip
      const currentStatus = useDriverStore.getState().status;
      if (currentStatus === 'ONLINE' || currentStatus === 'ON_TRIP' || currentStatus === 'IDLE') {
        transition('DISCONNECTED');
      }

      if (reason === 'io server disconnect') {
        // Server forced disconnect — don't auto-reconnect
        setError('Disconnected by server');
      }
    });

    socket.on('connect_error', (err) => {
      if (!mountedRef.current) return;
      setSocketConnected(false);
      stopHeartbeat();
      setError(err.message || 'Connection failed');
    });

    socket.io.on('reconnect', () => {
      if (!mountedRef.current) return;
      setSocketConnected(true);
      setError(null);
      startHeartbeat();
    });

    /* ── Server → Client events ────────────────────────────────── */

    socket.on('driver:init', (payload: DriverInitPayload) => {
      if (!mountedRef.current) return;
      
      // CRITICAL: driver:init is the SOURCE OF TRUTH
      // Always overwrite local state with server data (reactive, no re-login needed)
      setInit(payload);

      // Crash recovery: if server reports an active trip, restore it
      const initPayloadWithTrip = payload as DriverInitPayload & {
        activeTripId?: string | null;
        tripStartTime?: string | null;
      };

      if (initPayloadWithTrip.activeTripId) {
        transition('ON_TRIP');
        setTripStarted(
          initPayloadWithTrip.activeTripId,
          initPayloadWithTrip.tripStartTime ?? new Date().toISOString(),
        );
      }

      // Replay buffered locations NOW — busId is guaranteed set after setInit
      replayBuffer();
    });

    socket.on('driver:heartbeat:ack', () => {
      if (!mountedRef.current) return;
      lastHeartbeatAckRef.current = Date.now();
      setLastHeartbeatAt(Date.now());
    });

    socket.on('location:confirmed', (payload: LocationConfirmed) => {
      if (!mountedRef.current) return;
      setOccupancy(payload.occupancy.level);
      setLastLocationTimestamp(payload.timestamp);
    });

    socket.on('location:rejected', (payload: LocationRejected) => {
      if (!mountedRef.current) return;
      setError(`Location rejected: ${payload.reason}`);
    });

    socket.on('trip:started', (payload: TripStarted) => {
      if (!mountedRef.current) return;
      transition('ON_TRIP');
      setTripStarted(payload.tripId, payload.startTime);
    });

    socket.on('trip:ended', (payload: TripEnded) => {
      if (!mountedRef.current) return;
      transition('ONLINE');
      setTripEnded();
    });

    socket.on('driver:force-offline', () => {
      if (!mountedRef.current) return;
      // Force transition to OFFLINE regardless of current state
      stopHeartbeat();
      const store = useDriverStore.getState();
      store.reset();
      setError('Forced offline by server');
    });

    socket.on('error', (payload: SocketError) => {
      if (!mountedRef.current) return;
      setError(payload.message);
    });

    // ── Driver Lifecycle Events ──────────────────────────────────────────
    
    // State: Pending Approval (keep socket alive, show waiting screen)
    socket.on('driver:pending-approval', (payload: any) => {
      if (!mountedRef.current) return;
      console.log('[Socket] Driver pending approval', payload);
      transition('PENDING_APPROVAL');
      setSocketConnected(true);
      setError(null); // Clear any previous error
    });

    // State: No Bus Assigned (keep socket alive, wait for bus assignment)
    socket.on('driver:no-bus-assigned', (payload: any) => {
      if (!mountedRef.current) return;
      console.log('[Socket] Driver approved but no bus assigned', payload);
      transition('NO_BUS_ASSIGNED');
      setSocketConnected(true);
      setError(null); // Clear any previous error
    });

    // Real-time bus assignment events (reactive system - no re-login required)
    socket.on('driver:approved', (payload: any) => {
      if (!mountedRef.current) return;
      console.log('[Socket] Driver approved with bus assignment', payload);
      
      // Update store immediately with bus info (reactive update)
      if (payload.busId && payload.registrationNo) {
        const store = useDriverStore.getState();
        store.setInit({
          driverId: payload.driverId || store.driverId || '',
          busId: payload.busId,
          registrationNo: payload.registrationNo,
          routeId: payload.routeId || null,
          routeNumber: payload.routeNumber || null,
          routeName: payload.routeName || null,
          capacity: payload.capacity || 40, // Default capacity if not provided
          status: store.status,
        });
        // Transition from PENDING_APPROVAL or NO_BUS_ASSIGNED to OFFLINE
        if (store.status === 'PENDING_APPROVAL' || store.status === 'NO_BUS_ASSIGNED') {
          transition('OFFLINE');
        }
        setError(null); // Clear any errors
        console.log('[Socket] Bus assigned reactively:', payload.registrationNo);
      }
    });

    socket.on('driver:bus-assigned', (payload: any) => {
      if (!mountedRef.current) return;
      console.log('[Socket] Bus assigned in real-time', payload);
      
      // Update store immediately (reactive - no re-login needed)
      const store = useDriverStore.getState();
      store.setInit({
        driverId: payload.driverId || store.driverId || '',
        busId: payload.busId,
        registrationNo: payload.registrationNo,
        routeId: payload.routeId || store.routeId,
        routeNumber: payload.routeNumber || store.routeNumber,
        routeName: payload.routeName || store.routeName,
        capacity: payload.capacity || store.capacity,
        status: store.status,
      });
      
      // Transition to OFFLINE (bus now assigned, ready to GO ONLINE)
      if (store.status === 'NO_BUS_ASSIGNED' || store.status === 'PENDING_APPROVAL') {
        transition('OFFLINE');
      }
      
      console.log('[Socket] Store updated reactively - bus:', payload.registrationNo);
      // GO ONLINE button will now work immediately without re-login
    });

    socket.on('driver:rejected', (payload: any) => {
      if (!mountedRef.current) return;
      console.log('[Socket] Driver rejected', payload);
      setError('Your driver application has been rejected');
      // Force logout after delay
      setTimeout(() => {
        const store = useDriverStore.getState();
        store.reset();
      }, 3000);
    });

    socket.connect();
  }, [setInit, transition, setTripStarted, setTripEnded, setOccupancy, setSocketConnected, setError, setLastLocationTimestamp, setLastHeartbeatAt, setBufferSize, reset, startHeartbeat, stopHeartbeat, replayBuffer]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setBackgroundSocket(null);
    }
    setSocketConnected(false);
  }, [setSocketConnected, stopHeartbeat]);

  const emit = useCallback(<T,>(event: string, payload?: T) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    }
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopHeartbeat();
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setBackgroundSocket(null);
      }
    };
  }, [stopHeartbeat]);

  return { connect, disconnect, emit, isConnected };
}
