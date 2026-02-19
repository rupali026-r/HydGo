// ── Mapbox Directions API — Road-following route geometry ────────────────────
// Returns GeoJSON coordinates that follow actual roads.
// Cached for 20 seconds to avoid API spam on frequent updates.

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

interface LatLng {
  lat: number;
  lng: number;
}

interface CachedRoute {
  coordinates: [number, number][];
  timestamp: number;
  key: string;
}

const CACHE_TTL_MS = 20_000; // 20s cache
let routeCache: CachedRoute | null = null;

function cacheKey(from: LatLng, to: LatLng): string {
  // Round to 4 decimals (~11m precision) for stable cache keys
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}-${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

/**
 * Fetch road-following geometry from Mapbox Directions API.
 * Returns array of [lng, lat] coordinates (GeoJSON order).
 * Caches result for 20s. Returns empty array on failure (straight-line fallback).
 */
export async function getRoadRoute(
  from: LatLng,
  to: LatLng,
): Promise<[number, number][]> {
  const key = cacheKey(from, to);

  // Return cached if fresh
  if (routeCache && routeCache.key === key && Date.now() - routeCache.timestamp < CACHE_TTL_MS) {
    return routeCache.coordinates;
  }

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?geometries=geojson&overview=full&language=en&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[Directions API] HTTP error:', res.status);
      return [];
    }

    const data = await res.json();
    const coords: [number, number][] = data.routes?.[0]?.geometry?.coordinates ?? [];

    if (coords.length > 0) {
      routeCache = { coordinates: coords, timestamp: Date.now(), key };
    }

    return coords;
  } catch (err) {
    console.warn('[Directions API] fetch error:', err);
    return [];
  }
}

/**
 * Invalidate the route cache (call when tracking is cancelled).
 */
export function clearRouteCache(): void {
  routeCache = null;
}
