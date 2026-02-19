/**
 * HydGo Driver — Offline Location Buffer (Anti-Teleport System)
 *
 * Ring buffer that stores validated location updates when socket is disconnected.
 * On reconnect, buffered events are replayed in chronological order,
 * preventing teleport artifacts on the passenger map.
 *
 * Guarantees:
 *   - Max 30 entries (oldest evicted on overflow)
 *   - Chronological order maintained
 *   - No duplicate emissions (cleared after replay)
 *   - Thread-safe via Zustand atomic updates
 */

import { create } from 'zustand';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface BufferedLocation {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: number;
}

interface LocationBufferState {
  buffer: BufferedLocation[];
  readonly maxSize: number;

  /** Push a validated location into the ring buffer */
  push: (entry: BufferedLocation) => void;

  /** Drain all buffered entries (returns copy, clears buffer) */
  drain: () => BufferedLocation[];

  /** Current buffer length */
  size: () => number;

  /** Clear without returning */
  clear: () => void;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const MAX_BUFFER_SIZE = 30;

/* ── Store ─────────────────────────────────────────────────────────────────── */

export const useLocationBuffer = create<LocationBufferState>((set, get) => ({
  buffer: [],
  maxSize: MAX_BUFFER_SIZE,

  push: (entry: BufferedLocation) => {
    set((state) => {
      const next = [...state.buffer, entry];
      // Ring buffer: evict oldest if over capacity
      if (next.length > MAX_BUFFER_SIZE) {
        return { buffer: next.slice(next.length - MAX_BUFFER_SIZE) };
      }
      return { buffer: next };
    });
  },

  drain: () => {
    const entries = [...get().buffer];
    set({ buffer: [] });
    return entries;
  },

  size: () => get().buffer.length,

  clear: () => {
    set({ buffer: [] });
  },
}));
