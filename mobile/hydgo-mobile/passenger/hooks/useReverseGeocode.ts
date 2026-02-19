// ── Reverse Geocode Hook ────────────────────────────────────────────────────
// Reverse geocodes user location to a readable address/stop name.

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePassengerStore } from '../store/passengerStore';

let ExpoLocation: any = null;
try {
  ExpoLocation = require('expo-location');
} catch {}

const GEOCODE_DEBOUNCE_MS = 10_000;

export function useReverseGeocode() {
  const userLocation = usePassengerStore((s) => s.userLocation);
  const setUserLocationName = usePassengerStore((s) => s.setUserLocationName);
  const lastGeoRef = useRef(0);

  useEffect(() => {
    if (!userLocation) return;

    const now = Date.now();
    if (now - lastGeoRef.current < GEOCODE_DEBOUNCE_MS) return;
    lastGeoRef.current = now;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Use Nominatim for web (free, no key needed)
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${userLocation.latitude}&lon=${userLocation.longitude}&format=json&addressdetails=1&accept-language=en`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'HydGo-App/1.0' },
          });
          const data = await res.json();
          if (data?.display_name) {
            // Extract short name
            const parts = data.display_name.split(',');
            const short = parts.slice(0, 2).join(',').trim();
            setUserLocationName(short);
          }
        } else if (ExpoLocation) {
          const results = await ExpoLocation.reverseGeocodeAsync({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          });
          if (results && results.length > 0) {
            const r = results[0];
            const name = [r.street, r.district, r.subregion]
              .filter(Boolean)
              .slice(0, 2)
              .join(', ');
            setUserLocationName(name || r.name || null);
          }
        }
      } catch {
        // Geocode failed silently
      }
    })();
  }, [userLocation?.latitude, userLocation?.longitude]);
}
