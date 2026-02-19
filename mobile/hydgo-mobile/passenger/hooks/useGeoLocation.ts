// ── Geolocation Hook ────────────────────────────────────────────────────────
// Requests GPS permission and watches user position.

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { usePassengerStore } from '../store/passengerStore';

const LOCATION_UPDATE_INTERVAL = 5_000;
const LOCATION_DISTANCE_FILTER = 10; // meters

export function useGeoLocation() {
  const setUserLocation = usePassengerStore((s) => s.setUserLocation);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) return;

        // Get initial position immediately
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (mounted) {
          setUserLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            heading: initial.coords.heading ?? undefined,
            accuracy: initial.coords.accuracy ?? undefined,
          });
        }

        // Watch for updates
        if (Platform.OS === 'web') {
          // Web: use navigator.geolocation.watchPosition
          const watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (!mounted) return;
              setUserLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                heading: pos.coords.heading ?? undefined,
                accuracy: pos.coords.accuracy ?? undefined,
              });
            },
            undefined,
            { enableHighAccuracy: false, maximumAge: LOCATION_UPDATE_INTERVAL },
          );

          subRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) } as any;
        } else {
          subRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: LOCATION_UPDATE_INTERVAL,
              distanceInterval: LOCATION_DISTANCE_FILTER,
            },
            (loc) => {
              if (!mounted) return;
              setUserLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                heading: loc.coords.heading ?? undefined,
                accuracy: loc.coords.accuracy ?? undefined,
              });
            },
          );
        }
      } catch {
        // Location permission denied or not available
      }
    })();

    return () => {
      mounted = false;
      subRef.current?.remove();
    };
  }, []);
}
