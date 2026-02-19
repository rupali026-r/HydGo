// ── Viewport Bus Filter Hook ────────────────────────────────────────────────
// Only returns buses within the current map viewport.
// Prevents rendering off-screen markers for performance.

import { useMemo } from 'react';
import { usePassengerStore } from '../store/passengerStore';
import type { BusState } from '../types';

/**
 * Returns only buses that are within the current map viewport bounds.
 * Falls back to all buses if viewport is not set.
 */
export function useViewportBuses(): BusState[] {
  const buses = usePassengerStore((s) => s.buses);
  const viewport = usePassengerStore((s) => s.mapViewport);

  return useMemo(() => {
    const all = Array.from(buses.values());
    if (!viewport) return all;

    const [swLng, swLat] = viewport.sw;
    const [neLng, neLat] = viewport.ne;

    return all.filter(
      (b) =>
        b.latitude >= swLat &&
        b.latitude <= neLat &&
        b.longitude >= swLng &&
        b.longitude <= neLng,
    );
  }, [buses, viewport]);
}
