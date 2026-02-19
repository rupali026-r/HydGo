// ── useAllStops Hook ────────────────────────────────────────────────────────
// Fetches all TSRTC bus stops from the backend and caches them in memory.
// Used by the search bar for autocomplete across all Hyderabad stops.

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { StopInfo } from '../types';

interface DbStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId: string;
  stopOrder: number;
  route?: { routeNumber: string; name: string };
}

// Module-level cache so we don't re-fetch on every component mount
let _cachedStops: StopInfo[] = [];
let _fetching = false;

/** Deduplicate stops by name (same stop may appear on multiple routes) */
function deduplicateByName(stops: DbStop[]): StopInfo[] {
  const seen = new Map<string, StopInfo>();
  for (const s of stops) {
    const key = s.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        routeId: s.routeId,
        stopOrder: s.stopOrder,
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useAllStops() {
  const [stops, setStops] = useState<StopInfo[]>(_cachedStops);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    if (_cachedStops.length > 0) {
      setStops(_cachedStops);
      return;
    }

    if (_fetching) return;

    _fetching = true;
    api
      .get('/stops')
      .then((res) => {
        const data: DbStop[] = res.data?.data ?? [];
        const unique = deduplicateByName(data);
        _cachedStops = unique;
        if (mounted.current) setStops(unique);
      })
      .catch(() => {
        // Fallback: extract stops from routes endpoint if /stops fails
        api
          .get('/routes')
          .then((res) => {
            const routes = res.data?.data ?? [];
            const allStops: DbStop[] = [];
            for (const r of routes) {
              if (r.stops) {
                for (const s of r.stops) {
                  allStops.push({ ...s, route: { routeNumber: r.routeNumber, name: r.name } });
                }
              }
            }
            const unique = deduplicateByName(allStops);
            _cachedStops = unique;
            if (mounted.current) setStops(unique);
          })
          .catch(() => { /* silent */ });
      })
      .finally(() => { _fetching = false; });

    return () => { mounted.current = false; };
  }, []);

  return stops;
}
