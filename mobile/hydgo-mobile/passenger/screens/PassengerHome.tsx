// ── Passenger Home Screen ───────────────────────────────────────────────────
// Premium layered layout:
//   1. Full-screen dark map with auto-follow + confidence shimmer (PremiumMapView)
//   2. TopSearchBar (floating top search)
//   3. FloatingBusCard (slides up on bus tap)
//   4. JourneyMode (Uber-style stop timeline + notifications during journey)
//   5. PremiumBottomSheet (live ETA countdown + intelligence row, hidden during journey)
//   6. ConnectionBanner (top overlay on disconnect)
//
// Hooks wired: socket, geolocation, journey, reverse-geocode, notifications.
// No empty-map entry: skeleton on initial load → map with live data.

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { usePassengerSocket } from '../hooks/usePassengerSocket';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { useJourney } from '../hooks/useJourney';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { useNotifications } from '../hooks/useNotifications';
import { PremiumMapView } from '../components/PremiumMapView';
import { TopSearchBar } from '../components/TopSearchBar';
import { PremiumBottomSheet } from '../components/PremiumBottomSheet';
import { FloatingBusCard } from '../components/BusInfoPanel';
import { JourneyMode } from '../components/JourneyMode';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { NotificationBell } from '../components/NotificationBell';
import { api } from '../../lib/api';
import type { StopInfo } from '../types';

export default function PassengerHome() {
  const router = useRouter();
  const { sendLocation } = usePassengerSocket();
  useGeoLocation();
  useJourney();
  useReverseGeocode();
  useNotifications();

  const selectBus = usePassengerStore((s) => s.selectBus);
  const setPreviewRoute = usePassengerStore((s) => s.setPreviewRoute);
  const setNearestStop = usePassengerStore((s) => s.setNearestStop);
  const setNearbyStops = usePassengerStore((s) => s.setNearbyStops);
  const setNearestStopDistance = usePassengerStore((s) => s.setNearestStopDistance);
  const startJourney = usePassengerStore((s) => s.startJourney);
  const cancelJourney = usePassengerStore((s) => s.cancelJourney);
  const selectedBusId = usePassengerStore((s) => s.selectedBusId);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const activeJourney = usePassengerStore((s) => s.activeJourney);
  const isInitialLoad = usePassengerStore((s) => s.isInitialLoad);
  const trackingMode = usePassengerStore((s) => s.trackingMode);
  const trackingBusId = usePassengerStore((s) => s.trackingBusId);
  const stopTracking = usePassengerStore((s) => s.stopTracking);

  // ── Send location to backend (throttled 5s) ──────────────────────────────
  const lastSendRef = useRef(0);
  useEffect(() => {
    if (!userLocation) return;
    const now = Date.now();
    if (now - lastSendRef.current < 5000) return;
    lastSendRef.current = now;
    sendLocation(userLocation.latitude, userLocation.longitude);
  }, [userLocation, sendLocation]);

  // ── Fetch nearby stops periodically ──────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;

    const fetchStops = async () => {
      try {
        const res = await api.get('/stops/nearby', {
          params: {
            lat: userLocation.latitude,
            lng: userLocation.longitude,
            radius: 2000,
            limit: 20,
          },
        });
        if (cancelled) return;

        const nearStops: StopInfo[] = (res.data?.data ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          routeId: s.routeId,
          stopOrder: s.stopOrder,
        }));

        setNearbyStops(nearStops);
        if (nearStops.length > 0) {
          setNearestStop(nearStops[0]);
          // distanceMetres comes from the backend response
          const dist = res.data?.data?.[0]?.distanceMetres ?? 0;
          setNearestStopDistance(dist);
        }
      } catch {
        // Silently fail — stops are a nice-to-have
      }
    };

    fetchStops();
    const interval = setInterval(fetchStops, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userLocation?.latitude, userLocation?.longitude, setNearbyStops, setNearestStop, setNearestStopDistance]);

  // ── Bus tap → fetch route polyline ───────────────────────────────────────
  const handleBusPress = useCallback(
    async (busId: string) => {
      const { selectedBusId: current, buses } = usePassengerStore.getState();

      if (current === busId) {
        selectBus(null);
        setPreviewRoute(null);
        return;
      }

      selectBus(busId);

      const bus = buses.get(busId);
      if (!bus?.routeId) return;

      try {
        const res = await api.get(`/routes/${bus.routeId}`);
        const route = res.data?.data;
        if (route) {
          setPreviewRoute({
            id: route.id,
            routeNumber: route.routeNumber,
            name: route.name,
            routeType: route.routeType,
            polyline: route.polyline ?? '',
            avgSpeed: route.avgSpeed ?? 30,
            distance: route.distance ?? 0,
            stops: route.stops,
          });
        }
      } catch {
        // Route fetch failed — still show the bus info panel
      }
    },
    [selectBus, setPreviewRoute],
  );

  // ── Deselect handler ─────────────────────────────────────────────────────
  const handleDeselectBus = useCallback(() => {
    selectBus(null);
    setPreviewRoute(null);
  }, [selectBus, setPreviewRoute]);

  // ── Start Journey handler (from FloatingBusCard) ─────────────────────────
  // Starts JourneyMode panel (Uber-style timeline on Home screen)
  const handleStartJourney = useCallback(() => {
    const state = usePassengerStore.getState();
    const bus = state.selectedBusId ? state.buses.get(state.selectedBusId) : null;
    if (!bus) return;

    const fromStop: StopInfo = state.nearestStop ?? {
      id: 'current',
      name: 'Current Location',
      latitude: state.userLocation?.latitude ?? 0,
      longitude: state.userLocation?.longitude ?? 0,
      routeId: '',
      stopOrder: 0,
    };

    const routeStops = state.previewRoute?.stops ?? [];
    const lastStop = routeStops.length > 0 ? routeStops[routeStops.length - 1] : undefined;
    const toStop: StopInfo | undefined = lastStop
      ? { id: lastStop.id, name: lastStop.name, latitude: lastStop.latitude, longitude: lastStop.longitude, routeId: lastStop.routeId ?? '', stopOrder: lastStop.stopOrder ?? 0 }
      : undefined;

    startJourney({
      id: `journey-${Date.now()}`,
      busId: bus.id,
      routeId: bus.routeId ?? '',
      routeNumber: bus.routeNumber ?? '---',
      routeName: state.previewRoute?.name ?? '',
      fromStop,
      toStop,
      status: 'waiting',
      startedAt: Date.now(),
      etaMinutes: bus.eta?.estimatedMinutes ?? 0,
      busDistanceMeters: 0,
    });

    // Clear floating card — JourneyMode panel takes over on Home
    selectBus(null);
  }, [startJourney, selectBus]);

  // ── Cancel Journey handler ───────────────────────────────────────────────
  const handleCancelJourney = useCallback(() => {
    cancelJourney();
    stopTracking();
  }, [cancelJourney, stopTracking]);

  // ── View Route handler (from FloatingBusCard) ────────────────────────────
  const handleViewRoute = useCallback(() => {
    const state = usePassengerStore.getState();
    const bus = state.selectedBusId ? state.buses.get(state.selectedBusId) : null;
    if (!bus?.routeId) return;
    router.push({
      pathname: '/(app)/passenger/directions',
      params: {
        fromStop: state.nearestStop?.name ?? '',
        toStop: state.previewRoute?.name ?? '',
      },
    } as any);
  }, [router]);

  // ── Nearest stop press handler (from NearestStopCard) ────────────────────
  const handleStopPress = useCallback(() => {
    const state = usePassengerStore.getState();
    const stop = state.nearestStop;
    if (stop) {
      setNearestStop(stop);
    }
  }, [setNearestStop]);

  const hasJourney = !!activeJourney;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* L1: Full-screen dark map — Premium with auto-follow + confidence shimmer */}
      <PremiumMapView onBusPress={handleBusPress} />

      {/* L2: Connection banner (below search bar, only on disconnect) */}
      <View style={styles.bannerOverlay}>
        <ConnectionBanner />
      </View>

      {/* Locate-me button — now built into PremiumMapView */}

      {/* Notification bell */}
      {!hasJourney && !trackingMode && (
        <View style={styles.notificationOverlay}>
          <NotificationBell />
        </View>
      )}

      {/* L3: Top search bar (hidden during journey + tracking) */}
      {!hasJourney && !trackingMode && (
        <View style={styles.searchBarOverlay}>
          <TopSearchBar />
        </View>
      )}

      {/* L4: Floating bus card (appears on bus tap, hidden during journey + tracking) */}
      {selectedBusId && !hasJourney && !trackingMode && (
        <View style={styles.floatingCardOverlay}>
          <FloatingBusCard
            onClose={handleDeselectBus}
            onViewRoute={handleViewRoute}
            onStartJourney={handleStartJourney}
          />
        </View>
      )}

      {/* L5: Journey Mode — Uber-style with stop timeline + notifications */}
      {hasJourney && (
        <View style={styles.journeyOverlay}>
          <JourneyMode onCancel={handleCancelJourney} />
        </View>
      )}

      {/* L6: Premium bottom sheet — live countdown + intelligence row */}
      {!hasJourney && !trackingMode && (
        <PremiumBottomSheet onBusPress={handleBusPress} onStopPress={handleStopPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  bannerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : 112,
    left: 16,
    right: 16,
    zIndex: 300,
  },

  notificationOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : 112,
    right: 16,
    zIndex: 210,
  },
  searchBarOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 56,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  floatingCardOverlay: {
    position: 'absolute',
    bottom: 340,
    left: 16,
    right: 16,
    zIndex: 180,
  },
  journeyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 250,
  },
});
