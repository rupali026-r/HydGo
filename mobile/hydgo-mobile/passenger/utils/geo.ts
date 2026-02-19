// ── Geo Utilities ───────────────────────────────────────────────────────────
// Client-side haversine + polyline decoder + road-snap (mirrors backend geo.ts)

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Haversine great-circle distance in km */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance in meters */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineDistance(lat1, lng1, lat2, lng2) * 1000;
}

/** Decode Google-encoded polyline → [lng, lat] pairs for Mapbox */
export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    // Mapbox expects [lng, lat]
    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

/** Format distance for display */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ── Road-snapping utilities ─────────────────────────────────────────────────

/** Point projected onto the nearest segment of a polyline.
 *  polyline is [lng, lat][] (Mapbox order).
 *  Returns { lng, lat, segmentIndex, segmentFraction, distAlongPath }.
 */
export interface PolylineProjection {
  lng: number;
  lat: number;
  segmentIndex: number;
  segmentFraction: number;
  /** Cumulative fraction [0–1] along the entire polyline */
  pathFraction: number;
}

/** Euclidean approximation for short distances — good enough at city scale */
function sqDist(x1: number, y1: number, x2: number, y2: number): number {
  return (x2 - x1) ** 2 + (y2 - y1) ** 2;
}

/** Project a point to the line segment (ax,ay)→(bx,by), return t clamped [0,1] */
function projectToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-14) return 0;
  return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
}

/** Find the closest point on a polyline to a given (lng, lat) coordinate.
 *  polyline: [lng, lat][] */
export function snapToPolyline(
  lng: number,
  lat: number,
  polyline: [number, number][],
): PolylineProjection | null {
  if (polyline.length < 2) return null;

  let bestDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [ax, ay] = polyline[i];
    const [bx, by] = polyline[i + 1];
    const t = projectToSegment(lng, lat, ax, ay, bx, by);
    const px = ax + t * (bx - ax);
    const py = ay + t * (by - ay);
    const d = sqDist(lng, lat, px, py);
    if (d < bestDist) {
      bestDist = d;
      bestSeg = i;
      bestT = t;
    }
  }

  // Compute cumulative lengths for pathFraction
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const len = Math.sqrt(sqDist(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]));
    segLens.push(len);
    totalLen += len;
  }

  let distAlong = 0;
  for (let i = 0; i < bestSeg; i++) distAlong += segLens[i];
  distAlong += segLens[bestSeg] * bestT;

  const [ax, ay] = polyline[bestSeg];
  const [bx, by] = polyline[bestSeg + 1];

  return {
    lng: ax + bestT * (bx - ax),
    lat: ay + bestT * (by - ay),
    segmentIndex: bestSeg,
    segmentFraction: bestT,
    pathFraction: totalLen > 0 ? distAlong / totalLen : 0,
  };
}

/**
 * Walk along a polyline from pathFraction `fromFrac` to `toFrac`.
 * Returns the intermediate (lng, lat) at the given `progress` [0–1].
 * polyline: [lng, lat][]
 */
export function walkPolyline(
  polyline: [number, number][],
  fromFrac: number,
  toFrac: number,
  progress: number,
): [number, number] {
  if (polyline.length < 2) return polyline[0] ?? [0, 0];
  const frac = fromFrac + (toFrac - fromFrac) * progress;
  const clamped = Math.max(0, Math.min(1, frac));

  // Compute cumulative segment lengths
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const len = Math.sqrt(sqDist(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]));
    segLens.push(len);
    totalLen += len;
  }

  if (totalLen < 1e-14) return polyline[0];

  const targetDist = clamped * totalLen;
  let accum = 0;

  for (let i = 0; i < segLens.length; i++) {
    if (accum + segLens[i] >= targetDist) {
      const t = (targetDist - accum) / segLens[i];
      const [ax, ay] = polyline[i];
      const [bx, by] = polyline[i + 1];
      return [ax + t * (bx - ax), ay + t * (by - ay)];
    }
    accum += segLens[i];
  }

  return polyline[polyline.length - 1];
}
