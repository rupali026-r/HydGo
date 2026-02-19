import { haversineDistance } from './geo';

export interface ETAResult {
  distanceKm: number;
  estimatedMinutes: number;
  formattedETA: string;
}

export function calculateETA(
  busLat: number,
  busLng: number,
  stopLat: number,
  stopLng: number,
  avgSpeedKmh: number,
  trafficFactor = 1.0,
): ETAResult {
  const distanceKm = haversineDistance(busLat, busLng, stopLat, stopLng);
  const speedKmh = Math.max(avgSpeedKmh, 5); // never divide by ~0
  const clampedTraffic = Math.max(1.0, Math.min(trafficFactor, 2.0));
  const estimatedMinutes = Math.round((distanceKm / speedKmh) * 60 * clampedTraffic);

  let formattedETA: string;
  if (estimatedMinutes < 1) {
    formattedETA = 'Arriving now';
  } else if (estimatedMinutes < 60) {
    formattedETA = `${estimatedMinutes} min`;
  } else {
    const h = Math.floor(estimatedMinutes / 60);
    const m = estimatedMinutes % 60;
    formattedETA = `${h}h ${m}m`;
  }

  return { distanceKm: Math.round(distanceKm * 100) / 100, estimatedMinutes, formattedETA };
}
