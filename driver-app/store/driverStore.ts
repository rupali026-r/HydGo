/**
 * HydGo Driver — Zustand State Machine
 * Strict driver state transitions matching backend's driver-state.service.ts
 *
 * Valid transitions:
 *   PENDING_APPROVAL → [NO_BUS_ASSIGNED, OFFLINE]  // When approved
 *   NO_BUS_ASSIGNED  → [OFFLINE]                    // When bus assigned
 *   OFFLINE          → [ONLINE]
 *   ONLINE           → [ON_TRIP, IDLE, DISCONNECTED, OFFLINE]
 *   ON_TRIP          → [ONLINE, DISCONNECTED, OFFLINE]
 *   IDLE             → [ONLINE, DISCONNECTED, OFFLINE]
 *   DISCONNECTED     → [ONLINE, OFFLINE]
 */

import { create } from 'zustand';
import type {
  DriverStatus,
  DriverInitPayload,
  OccupancyLevel,
} from '../lib/types';

/* ── Transition map ────────────────────────────────────────────────────────── */

const VALID_TRANSITIONS: Record<DriverStatus, DriverStatus[]> = {
  PENDING_APPROVAL: ['NO_BUS_ASSIGNED', 'OFFLINE'],
  NO_BUS_ASSIGNED: ['OFFLINE'],
  OFFLINE: ['ONLINE', 'PENDING_APPROVAL', 'NO_BUS_ASSIGNED'],
  ONLINE: ['ON_TRIP', 'IDLE', 'DISCONNECTED', 'OFFLINE'],
  ON_TRIP: ['ONLINE', 'DISCONNECTED', 'OFFLINE'],
  IDLE: ['ONLINE', 'DISCONNECTED', 'OFFLINE'],
  DISCONNECTED: ['ONLINE', 'OFFLINE'],
};

/* ── Store shape ───────────────────────────────────────────────────────────── */

interface DriverState {
  // Driver state machine
  status: DriverStatus;
  prevStatus: DriverStatus | null;

  // Assignment info (set on socket driver:init)
  driverId: string | null;
  busId: string | null;
  registrationNo: string | null;
  routeId: string | null;
  routeNumber: string | null;
  routeName: string | null;
  capacity: number;

  // Trip
  activeTripId: string | null;
  tripStartTime: string | null;

  // Occupancy
  passengerCount: number;
  lastOccupancy: OccupancyLevel | null;

  // Connection & reliability
  socketConnected: boolean;
  gpsActive: boolean;
  lastError: string | null;
  lastLocationTimestamp: string | null;
  lastHeartbeatAt: number | null;
  networkOnline: boolean;
  backgroundTrackingActive: boolean;
  bufferSize: number;

  // Actions
  transition: (to: DriverStatus) => boolean;
  setInit: (payload: DriverInitPayload) => void;
  setTripStarted: (tripId: string, startTime: string) => void;
  setTripEnded: () => void;
  setPassengerCount: (count: number) => void;
  incrementPassengers: () => void;
  decrementPassengers: () => void;
  setOccupancy: (level: OccupancyLevel) => void;
  setSocketConnected: (connected: boolean) => void;
  setGpsActive: (active: boolean) => void;
  setError: (error: string | null) => void;
  setLastLocationTimestamp: (ts: string) => void;
  setLastHeartbeatAt: (ts: number) => void;
  setNetworkOnline: (online: boolean) => void;
  setBackgroundTrackingActive: (active: boolean) => void;
  setBufferSize: (size: number) => void;
  reset: () => void;
}

/* ── Initial state ─────────────────────────────────────────────────────────── */

const INITIAL: Omit<
  DriverState,
  | 'transition'
  | 'setInit'
  | 'setTripStarted'
  | 'setTripEnded'
  | 'setPassengerCount'
  | 'incrementPassengers'
  | 'decrementPassengers'
  | 'setOccupancy'
  | 'setSocketConnected'
  | 'setGpsActive'
  | 'setError'
  | 'setLastLocationTimestamp'
  | 'setLastHeartbeatAt'
  | 'setNetworkOnline'
  | 'setBackgroundTrackingActive'
  | 'setBufferSize'
  | 'reset'
> = {
  status: 'OFFLINE',
  prevStatus: null,
  driverId: null,
  busId: null,
  registrationNo: null,
  routeId: null,
  routeNumber: null,
  routeName: null,
  capacity: 52,
  activeTripId: null,
  tripStartTime: null,
  passengerCount: 0,
  lastOccupancy: null,
  socketConnected: false,
  gpsActive: false,
  lastError: null,
  lastLocationTimestamp: null,
  lastHeartbeatAt: null,
  networkOnline: true,
  backgroundTrackingActive: false,
  bufferSize: 0,
};

/* ── Store ─────────────────────────────────────────────────────────────────── */

export const useDriverStore = create<DriverState>((set, get) => ({
  ...INITIAL,

  transition: (to: DriverStatus) => {
    const current = get().status;
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed.includes(to)) {
      console.warn(
        `[DriverStore] Blocked transition: ${current} → ${to}. Allowed: [${allowed.join(', ')}]`,
      );
      return false;
    }
    set({ status: to, prevStatus: current, lastError: null });
    return true;
  },

  setInit: (payload: DriverInitPayload) => {
    set({
      driverId: payload.driverId,
      busId: payload.busId,
      registrationNo: payload.registrationNo,
      routeId: payload.routeId ?? null,
      routeNumber: payload.routeNumber ?? null,
      routeName: payload.routeName ?? null,
      capacity: payload.capacity,
      status: 'ONLINE',
      prevStatus: 'OFFLINE',
      socketConnected: true,
      lastError: null,
    });
  },

  setTripStarted: (tripId: string, startTime: string) => {
    set({ activeTripId: tripId, tripStartTime: startTime });
  },

  setTripEnded: () => {
    set({ activeTripId: null, tripStartTime: null });
  },

  setPassengerCount: (count: number) => {
    const cap = get().capacity;
    set({ passengerCount: Math.max(0, Math.min(count, cap)) });
  },

  incrementPassengers: () => {
    const { passengerCount, capacity } = get();
    if (passengerCount < capacity) {
      set({ passengerCount: passengerCount + 1 });
    }
  },

  decrementPassengers: () => {
    const { passengerCount } = get();
    if (passengerCount > 0) {
      set({ passengerCount: passengerCount - 1 });
    }
  },

  setOccupancy: (level: OccupancyLevel) => {
    set({ lastOccupancy: level });
  },

  setSocketConnected: (connected: boolean) => {
    set({ socketConnected: connected });
  },

  setGpsActive: (active: boolean) => {
    set({ gpsActive: active });
  },

  setError: (error: string | null) => {
    set({ lastError: error });
  },

  setLastLocationTimestamp: (ts: string) => {
    set({ lastLocationTimestamp: ts });
  },

  setLastHeartbeatAt: (ts: number) => {
    set({ lastHeartbeatAt: ts });
  },

  setNetworkOnline: (online: boolean) => {
    set({ networkOnline: online });
  },

  setBackgroundTrackingActive: (active: boolean) => {
    set({ backgroundTrackingActive: active });
  },

  setBufferSize: (size: number) => {
    set({ bufferSize: size });
  },

  reset: () => {
    set(INITIAL);
  },
}));
