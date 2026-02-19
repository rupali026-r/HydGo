// ── Bus Interpolation Engine ────────────────────────────────────────────────
// Smoothly animates bus positions between socket updates at 60fps.
// Uses requestAnimationFrame for frame-accurate transitions.
// Road-following: snaps interpolation to the route polyline when available.

import { useRef, useEffect, useCallback } from 'react';
import { usePassengerStore } from '../store/passengerStore';
import {
  snapToPolyline,
  walkPolyline,
  decodePolyline,
} from '../utils/geo';
import { api } from '../../lib/api';
import type { BusState } from '../types';

const INTERPOLATION_DURATION_MS = 3000; // match backend tick interval

interface BusInterpolationState {
  prevLat: number;
  prevLng: number;
  targetLat: number;
  targetLng: number;
  startTime: number;
  /** If polyline is cached, road-snap fractions [0-1] along the path */
  fromFrac: number | null;
  toFrac: number | null;
  routeId: string | null;
}

export interface InterpolatedPositions {
  [busId: string]: { latitude: number; longitude: number };
}

/** Cached decoded polylines keyed by routeId */
const polylineCache = new Map<string, [number, number][]>();
/** Routes currently being fetched (avoid duplicate requests) */
const fetchingRoutes = new Set<string>();

/** Fetch and cache a route polyline on-demand */
async function ensurePolylineCached(routeId: string) {
  if (polylineCache.has(routeId) || fetchingRoutes.has(routeId)) return;
  fetchingRoutes.add(routeId);
  try {
    const res = await api.get(`/routes/${routeId}`);
    const route = res.data?.data;
    if (route?.polyline) {
      // Handle both JSON coordinate arrays and Google-encoded polylines
      let decoded: [number, number][];
      const raw = route.polyline;
      if (Array.isArray(raw)) {
        // Backend returns [[lat, lng], ...] → convert to [lng, lat] for Mapbox
        decoded = raw.map((p: number[]) => [p[1], p[0]] as [number, number]);
      } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          decoded = parsed.map((p: number[]) => [p[1], p[0]] as [number, number]);
        } catch {
          decoded = [];
        }
      } else if (typeof raw === 'string' && raw.length > 0) {
        decoded = decodePolyline(raw);
      } else {
        decoded = [];
      }
      if (decoded.length >= 2) {
        polylineCache.set(routeId, decoded);
      }
    } else if (route?.stops?.length >= 2) {
      // Fallback: use stop coordinates as polyline
      const stopCoords: [number, number][] = route.stops
        .sort((a: any, b: any) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
        .map((s: any) => [s.longitude, s.latitude] as [number, number]);
      polylineCache.set(routeId, stopCoords);
    }
  } catch {
    // Silently fail
  } finally {
    fetchingRoutes.delete(routeId);
  }
}

/**
 * useBusInterpolation
 *
 * Maintains a separate interpolation state per bus.
 * When a new bus position arrives, stores the prev → target,
 * and on each animation frame, computes the interpolated position.
 * When a route polyline is cached, the interpolation follows the road.
 *
 * Returns a ref that always contains the latest interpolated positions.
 * Components should read from onFrame callback.
 */
export function useBusInterpolation(onFrame: (positions: InterpolatedPositions) => void) {
  const interpRef = useRef<Map<string, BusInterpolationState>>(new Map());
  const positionsRef = useRef<InterpolatedPositions>({});
  const rafRef = useRef<number>(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // Track bus changes from store
  const buses = usePassengerStore((s) => s.buses);
  const prevBusesRef = useRef<Map<string, BusState>>(new Map());

  // Detect bus position changes and update interpolation targets
  useEffect(() => {
    const prev = prevBusesRef.current;
    const now = Date.now();

    buses.forEach((bus, busId) => {
      const prevBus = prev.get(busId);
      const interp = interpRef.current.get(busId);

      // If position actually changed
      if (!prevBus || prevBus.latitude !== bus.latitude || prevBus.longitude !== bus.longitude) {
        const prevLat = interp?.targetLat ?? bus.latitude;
        const prevLng = interp?.targetLng ?? bus.longitude;

        let fromFrac: number | null = null;
        let toFrac: number | null = null;
        const routeId = bus.routeId ?? null;

        // Try to snap to cached polyline
        if (routeId && polylineCache.has(routeId)) {
          const poly = polylineCache.get(routeId)!;
          const fromProj = snapToPolyline(prevLng, prevLat, poly);
          const toProj = snapToPolyline(bus.longitude, bus.latitude, poly);
          if (fromProj && toProj) {
            fromFrac = fromProj.pathFraction;
            toFrac = toProj.pathFraction;
          }
        } else if (routeId) {
          // Trigger lazy fetch of polyline for future frames
          ensurePolylineCached(routeId);
        }

        interpRef.current.set(busId, {
          prevLat,
          prevLng,
          targetLat: bus.latitude,
          targetLng: bus.longitude,
          startTime: now,
          fromFrac,
          toFrac,
          routeId,
        });
      }
    });

    // Clean up removed buses
    interpRef.current.forEach((_, busId) => {
      if (!buses.has(busId)) {
        interpRef.current.delete(busId);
        delete positionsRef.current[busId];
      }
    });

    prevBusesRef.current = new Map(buses);
  }, [buses]);

  // Animation loop
  const tick = useCallback(() => {
    const now = Date.now();
    const positions: InterpolatedPositions = {};
    let hasActive = false;

    interpRef.current.forEach((state, busId) => {
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / INTERPOLATION_DURATION_MS, 1);

      // Ease-out for smooth deceleration
      const eased = 1 - (1 - progress) * (1 - progress);

      // Road-following: walk along polyline if we have projections
      if (
        state.fromFrac !== null &&
        state.toFrac !== null &&
        state.routeId &&
        polylineCache.has(state.routeId)
      ) {
        const poly = polylineCache.get(state.routeId)!;
        const [lng, lat] = walkPolyline(poly, state.fromFrac, state.toFrac, eased);
        positions[busId] = { latitude: lat, longitude: lng };
      } else {
        // Fallback: straight-line lerp
        positions[busId] = {
          latitude: state.prevLat + (state.targetLat - state.prevLat) * eased,
          longitude: state.prevLng + (state.targetLng - state.prevLng) * eased,
        };
      }

      if (progress < 1) hasActive = true;
    });

    positionsRef.current = positions;
    onFrameRef.current(positions);

    // Always keep ticking to catch new updates
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return positionsRef;
}
