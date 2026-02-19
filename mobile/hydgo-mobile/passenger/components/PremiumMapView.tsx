// ── Premium Map View Layer ──────────────────────────────────────────────────
// Enhanced dark-themed Mapbox GL JS map with:
// - Animated bus markers with scale pulse on selection
// - Bus halo pulse effect on selected bus
// - Confidence shimmer (low confidence buses fade)
// - Occupancy color coding (green/amber/red)
// - Smooth 500ms cubic-bezier camera easing
// - Route polyline highlight with stroke-dashoffset animation
// - Zoom to selected route bounds
// - Auto-follow mode toggle
// - "Recenter to me" floating button
// - Traffic overlay color blending
// - Viewport-based bus filtering for performance

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { useBusInterpolation, InterpolatedPositions } from '../hooks/useBusInterpolation';
import { decodePolyline } from '../utils/geo';
import { getRoadRoute } from '../../lib/directions.api';
import { api } from '../../lib/api';
import type { BusState, OccupancyLevel } from '../types';

// Mapbox GL JS import (web only)
let mapboxgl: typeof import('mapbox-gl') | null = null;
if (Platform.OS === 'web') {
  try {
    mapboxgl = require('mapbox-gl');
  } catch {}
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const HYDERABAD_CENTER: [number, number] = [78.4867, 17.385];
const DEFAULT_ZOOM = 13;

// ── Inject premium CSS styles ───────────────────────────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes hydgo-pulse {
      0% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes hydgo-bus-halo {
      0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
      50% { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    }
    @keyframes hydgo-bus-scale-pulse {
      0% { transform: scale(1.15); }
      50% { transform: scale(1.22); }
      100% { transform: scale(1.15); }
    }
    @keyframes hydgo-confidence-shimmer {
      0% { opacity: 0.35; }
      50% { opacity: 0.55; }
      100% { opacity: 0.35; }
    }
    @keyframes hydgo-dash-offset {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -40; }
    }
    .hydgo-user-halo {
      position: absolute;
      width: 30px; height: 30px;
      background: rgba(59,130,246,0.3);
      border-radius: 50%;
      animation: hydgo-pulse 2s ease-out infinite;
      top: 0; left: 0;
      transform-origin: center;
      pointer-events: none;
    }
    .hydgo-bus-marker {
      transition: transform 0.5s cubic-bezier(0.2, 0, 0, 1),
                  box-shadow 0.3s ease,
                  opacity 0.3s ease;
      will-change: transform, opacity;
    }
    .hydgo-bus-marker:hover {
      transform: scale(1.08) !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
    }
    .hydgo-bus-marker.selected {
      animation: hydgo-bus-scale-pulse 1.5s ease-in-out infinite,
                 hydgo-bus-halo 2s ease-out infinite;
    }
    .hydgo-bus-marker.low-confidence {
      animation: hydgo-confidence-shimmer 2.5s ease-in-out infinite;
    }
    .mapboxgl-marker {
      overflow: visible !important;
    }
  `;
  document.head.appendChild(style);
}

interface MapViewLayerProps {
  onBusPress: (busId: string) => void;
}

export function MapViewLayer({ onBusPress }: MapViewLayerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const onBusPressRef = useRef(onBusPress);
  onBusPressRef.current = onBusPress;
  const autoFollowRef = useRef(false);

  const buses = usePassengerStore((s) => s.buses);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const selectedBusId = usePassengerStore((s) => s.selectedBusId);
  const previewRoute = usePassengerStore((s) => s.previewRoute);
  const trackingMode = usePassengerStore((s) => s.trackingMode);
  const trackingBusId = usePassengerStore((s) => s.trackingBusId);
  const trackingOriginStop = usePassengerStore((s) => s.trackingOriginStop);
  const trackingRoadCoords = usePassengerStore((s) => s.trackingRoadCoords);
  const updateTracking = usePassengerStore((s) => s.updateTracking);
  const setTrackingRoadCoords = usePassengerStore((s) => s.setTrackingRoadCoords);
  const stopTracking = usePassengerStore((s) => s.stopTracking);
  const setMapViewport = usePassengerStore((s) => s.setMapViewport);
  const setIsInitialLoad = usePassengerStore((s) => s.setIsInitialLoad);

  const [mapReady, setMapReady] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapboxgl || !mapContainerRef.current) return;

    (mapboxgl as any).accessToken = MAPBOX_TOKEN;

    const map = new (mapboxgl as any).Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: HYDERABAD_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      pitch: 0,
      bearing: 0,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapReady(true);
      setIsInitialLoad(false);

      // ── Route polyline source/layers ──
      map.addSource('route-polyline', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [] },
          properties: {},
        },
      });

      // Route glow (under)
      map.addLayer({
        id: 'route-polyline-glow',
        type: 'line',
        source: 'route-polyline',
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.12,
          'line-blur': 8,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });

      // Route line (over) with dash array for animation effect
      map.addLayer({
        id: 'route-polyline-layer',
        type: 'line',
        source: 'route-polyline',
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.5,
          'line-opacity': 0.85,
          'line-dasharray': [2, 1],
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });

      // Route dash-offset animation via timer
      let dashOffset = 0;
      const animateDash = () => {
        if (!map || !map.getLayer('route-polyline-layer')) return;
        dashOffset = (dashOffset + 0.02) % 6;
        map.setPaintProperty('route-polyline-layer', 'line-dasharray', [
          2 + Math.sin(dashOffset) * 0.5,
          1,
        ]);
      };
      const dashInterval = setInterval(animateDash, 50);

      // ── Tracking polyline source/layers (Phase 9) ──
      map.addSource('tracking-polyline', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [] },
          properties: {},
        },
      });

      map.addLayer({
        id: 'tracking-polyline-glow',
        type: 'line',
        source: 'tracking-polyline',
        paint: {
          'line-color': '#3B82F6',
          'line-width': 12,
          'line-opacity': 0.15,
          'line-blur': 10,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });

      map.addLayer({
        id: 'tracking-polyline-layer',
        type: 'line',
        source: 'tracking-polyline',
        paint: {
          'line-color': '#3B82F6',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1],
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });

      // ── Bus stop circles source/layer ──────────────────────────────────
      map.addSource('bus-stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Outer glow circle (always visible, fades at low zoom)
      map.addLayer({
        id: 'bus-stops-glow',
        type: 'circle',
        source: 'bus-stops',
        minzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 10],
          'circle-color': '#38BDF8',
          'circle-opacity': 0.25,
          'circle-blur': 0.7,
        },
      });

      // Inner fill circle
      map.addLayer({
        id: 'bus-stops-fill',
        type: 'circle',
        source: 'bus-stops',
        minzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6],
          'circle-color': '#38BDF8',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0EA5E9',
        },
      });

      // Stop name labels (only visible at high zoom)
      map.addLayer({
        id: 'bus-stops-label',
        type: 'symbol',
        source: 'bus-stops',
        minzoom: 14,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 8,
        } as any,
        paint: {
          'text-color': '#BAE6FD',
          'text-halo-color': '#0C1B2E',
          'text-halo-width': 1.5,
          'text-opacity': 0.9,
        },
      });

      // Store cleanup ref
      (map as any).__dashInterval = dashInterval;
    });

    // ── Track viewport for bus filtering ──
    const updateViewport = () => {
      if (!map) return;
      const bounds = map.getBounds();
      if (bounds) {
        setMapViewport({
          sw: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
          ne: [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
        });
      }
    };
    map.on('moveend', updateViewport);
    map.on('zoomend', updateViewport);

    // ── Disable auto-follow on user gesture ──
    map.on('dragstart', () => {
      autoFollowRef.current = false;
      setAutoFollow(false);
    });

    // ── Fly-to-user custom event ──
    const handleFlyToUser = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail;
      map.flyTo({
        center: [lng, lat],
        zoom: 15.5,
        duration: 1200,
        essential: true,
      });
    };
    window.addEventListener('hydgo:flyToUser', handleFlyToUser);

    return () => {
      window.removeEventListener('hydgo:flyToUser', handleFlyToUser);
      clearInterval((map as any).__dashInterval);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Fetch stops and populate Mapbox stops source ───────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const loadStops = async () => {
      try {
        const res = await api.get('/stops');
        const stops: any[] = res.data?.data ?? [];

        // Deduplicate by name for the map (keep first occurrence per name)
        const seen = new Set<string>();
        const features: any[] = [];
        for (const s of stops) {
          if (!seen.has(s.name)) {
            seen.add(s.name);
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [s.longitude, s.latitude],
              },
              properties: {
                id: s.id,
                name: s.name,
                routeNumber: s.route?.routeNumber ?? '',
              },
            });
          }
        }

        // Wait for map to be ready then set source data
        const setData = () => {
          const map = mapRef.current;
          if (!map || !map.getSource('bus-stops')) {
            setTimeout(setData, 300);
            return;
          }
          (map.getSource('bus-stops') as any).setData({
            type: 'FeatureCollection',
            features,
          });
        };
        setData();
      } catch {
        // Non-critical — map still works without stop circles
      }
    };

    loadStops();
  }, []);

  // ── Bus marker frame callback ─────────────────────────────────────────────
  const handleFrame = useCallback((positions: InterpolatedPositions) => {
    if (!mapRef.current || Platform.OS !== 'web' || !mapboxgl) return;

    const map = mapRef.current;
    const currentBusIds = new Set<string>();
    const currentBuses = usePassengerStore.getState().buses;
    const currentSelectedId = usePassengerStore.getState().selectedBusId;

    const bounds = map.getBounds();
    const pad = 0.01;

    currentBuses.forEach((bus, busId) => {
      currentBusIds.add(busId);
      const pos = positions[busId] ?? {
        latitude: bus.latitude,
        longitude: bus.longitude,
      };

      // Viewport culling
      if (bounds) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        if (
          pos.latitude < sw.lat - pad ||
          pos.latitude > ne.lat + pad ||
          pos.longitude < sw.lng - pad ||
          pos.longitude > ne.lng + pad
        ) {
          const existing = markersRef.current.get(busId);
          if (existing) {
            existing.remove();
            markersRef.current.delete(busId);
          }
          return;
        }
      }

      const existing = markersRef.current.get(busId);
      const isSelected = currentSelectedId === busId;
      const isLowConf = (bus.confidence ?? 0.7) < 0.6;

      if (existing) {
        existing.setLngLat([pos.longitude, pos.latitude]);
        const wrapper = existing.getElement();
        const inner = wrapper?.querySelector('.hydgo-bus-marker') as HTMLElement | null;
        if (inner) {
          // Update selected/confidence classes
          inner.classList.toggle('selected', isSelected);
          inner.classList.toggle('low-confidence', isLowConf && !isSelected);

          if (!isSelected && !isLowConf) {
            inner.style.transform = 'scale(1)';
          }
          inner.style.zIndex = isSelected ? '100' : '10';
          if (!isSelected) {
            inner.style.opacity = isLowConf ? '0.5' : '1';
          }
        }
      } else {
        const el = createBusMarkerElement(bus, isSelected);

        // Confidence shimmer for low confidence
        if (isLowConf && !isSelected) {
          el.classList.add('low-confidence');
          el.style.opacity = '0.5';
        }
        if (isSelected) {
          el.classList.add('selected');
        }

        el.addEventListener('click', (e: Event) => {
          e.stopPropagation();
          onBusPressRef.current(busId);
        });

        const container = document.createElement('div');
        container.style.cssText = 'overflow:visible;';
        container.appendChild(el);

        const marker = new (mapboxgl as any).Marker({
          element: container,
          anchor: 'center',
        })
          .setLngLat([pos.longitude, pos.latitude])
          .addTo(map);

        markersRef.current.set(busId, marker);
      }
    });

    // Remove stale
    markersRef.current.forEach((marker, busId) => {
      if (!currentBusIds.has(busId)) {
        marker.remove();
        markersRef.current.delete(busId);
      }
    });
  }, []);

  useBusInterpolation(handleFrame);

  // ── User location marker ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || Platform.OS !== 'web' || !mapboxgl) return;
    if (!userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([
        userLocation.longitude,
        userLocation.latitude,
      ]);
    } else {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'overflow:visible;width:0;height:0;';

      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        width: 30px; height: 30px;
        top: -15px; left: -15px;
        pointer-events: none;
        overflow: visible;
      `;

      const halo = document.createElement('div');
      halo.className = 'hydgo-user-halo';
      container.appendChild(halo);

      const dot = document.createElement('div');
      dot.style.cssText = `
        position: absolute;
        width: 16px; height: 16px;
        background: #3B82F6;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 16px rgba(59,130,246,0.6);
        top: 50%; left: 50%;
        margin-top: -8px; margin-left: -8px;
      `;
      container.appendChild(dot);
      wrapper.appendChild(container);

      const marker = new (mapboxgl as any).Marker({
        element: wrapper,
        anchor: 'center',
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);

      const mapboxWrapper = marker.getElement();
      if (mapboxWrapper) {
        mapboxWrapper.style.overflow = 'visible';
        mapboxWrapper.style.zIndex = '9999';
      }

      userMarkerRef.current = marker;

      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: DEFAULT_ZOOM,
        duration: 2000,
        essential: true,
      });
    }

    // Auto-follow mode
    if (autoFollowRef.current && mapRef.current) {
      mapRef.current.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        duration: 500,
      });
    }
  }, [userLocation, mapReady]);

  // ── Route polyline ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const source = mapRef.current.getSource('route-polyline');
    if (!source) return;

    if (previewRoute?.polyline) {
      // Handle both JSON coordinate arrays and Google-encoded polylines
      let coords: [number, number][];
      const raw = previewRoute.polyline as any;
      if (Array.isArray(raw)) {
        // Backend returns [[lat, lng], ...] → convert to [lng, lat] for Mapbox
        coords = raw.map((p: number[]) => [p[1], p[0]] as [number, number]);
      } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        // JSON string of coordinate array
        try {
          const parsed = JSON.parse(raw);
          coords = parsed.map((p: number[]) => [p[1], p[0]] as [number, number]);
        } catch {
          coords = [];
        }
      } else if (typeof raw === 'string' && raw.length > 0) {
        // Google-encoded polyline string
        coords = decodePolyline(raw);
      } else {
        coords = [];
      }

      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });

      // Zoom to route bounds
      if (coords.length >= 2) {
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];
        mapRef.current.fitBounds(bounds, {
          padding: { top: 100, bottom: 280, left: 40, right: 40 },
          duration: 800,
          maxZoom: 16,
        });
      }
    } else {
      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
        properties: {},
      });
    }
  }, [previewRoute, mapReady]);

  // ── Tracking polyline: road-following route from Mapbox Directions API ──
  const roadFetchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const source = mapRef.current.getSource('tracking-polyline');
    if (!source) return;

    if (trackingMode && trackingBusId && trackingOriginStop) {
      const bus = buses.get(trackingBusId);
      if (bus) {
        // Update distance + ETA in store
        const distKm = haversineDistanceCalc(
          bus.latitude, bus.longitude,
          trackingOriginStop.latitude, trackingOriginStop.longitude,
        );
        const distMeters = Math.round(distKm * 1000);
        const speed = bus.speed > 2 ? bus.speed : 25;
        const eta = Math.max(1, Math.round((distKm / speed) * 60));
        updateTracking(distMeters, eta);

        // Fetch road geometry (cached 20s)
        const fetchKey = `${bus.latitude.toFixed(4)},${bus.longitude.toFixed(4)}`;
        if (fetchKey !== roadFetchRef.current) {
          roadFetchRef.current = fetchKey;
          getRoadRoute(
            { lat: bus.latitude, lng: bus.longitude },
            { lat: trackingOriginStop.latitude, lng: trackingOriginStop.longitude },
          ).then((roadCoords) => {
            if (!mapRef.current) return;
            const src = mapRef.current.getSource('tracking-polyline');
            if (!src) return;

            const coords: [number, number][] =
              roadCoords.length > 0
                ? roadCoords
                : [[bus.longitude, bus.latitude], [trackingOriginStop.longitude, trackingOriginStop.latitude]];

            setTrackingRoadCoords(coords);
            src.setData({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: {},
            });
          });
        } else if (trackingRoadCoords.length > 0) {
          // Update source with existing cached coords (bus moved < 11m)
          source.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: trackingRoadCoords },
            properties: {},
          });
        }

        // Auto-follow tracked bus (use requestAnimationFrame for smooth updates)
        requestAnimationFrame(() => {
          mapRef.current?.easeTo({
            center: [bus.longitude, bus.latitude],
            duration: 800,
          });
        });
      }
    } else {
      roadFetchRef.current = null;
      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
        properties: {},
      });
    }
  }, [trackingMode, trackingBusId, trackingOriginStop, buses, mapReady]);

  // ── Tracking mode: hide non-tracked bus markers ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    markersRef.current.forEach((marker, busId) => {
      const el = marker.getElement();
      if (!el) return;

      if (trackingMode && trackingBusId) {
        // In tracking mode: hide all markers except the tracked bus
        el.style.display = busId === trackingBusId ? '' : 'none';
      } else {
        // Normal mode: show all
        el.style.display = '';
      }
    });
  }, [trackingMode, trackingBusId, mapReady, buses]);

  // ── Fly to selected bus (500ms cubic-bezier) ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || !selectedBusId) return;
    const bus = buses.get(selectedBusId);
    if (bus) {
      mapRef.current.flyTo({
        center: [bus.longitude, bus.latitude],
        zoom: 15.5,
        duration: 500,
        essential: true,
      });
    }
  }, [selectedBusId, mapReady]);

  // ── Auto-follow toggle handler ──
  const handleToggleAutoFollow = useCallback(() => {
    const next = !autoFollow;
    setAutoFollow(next);
    autoFollowRef.current = next;
    if (next && userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15.5,
        duration: 800,
        essential: true,
      });
    }
  }, [autoFollow, userLocation]);

  // ── Recenter to user ──
  const handleRecenter = useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    window.dispatchEvent(
      new CustomEvent('hydgo:flyToUser', {
        detail: { lat: userLocation.latitude, lng: userLocation.longitude },
      }),
    );
  }, [userLocation]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.nativeMapPlaceholder}>
          <Ionicons name="map-outline" size={48} color={Theme.textDim} />
          <Text style={styles.placeholderText}>Map available on web</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div ref={mapContainerRef as any} style={{ width: '100%', height: '100%' }} />

      {/* ── Tracking Panel (Phase 9) ── */}
      {trackingMode && trackingBusId && (
        <TrackingPanel
          busId={trackingBusId}
          onCancel={stopTracking}
        />
      )}

      {/* Auto-follow toggle */}
      <Pressable
        onPress={handleToggleAutoFollow}
        style={[
          styles.autoFollowBtn,
          autoFollow && styles.autoFollowActive,
        ]}
      >
        <Ionicons
          name={autoFollow ? 'navigate' : 'navigate-outline'}
          size={18}
          color={autoFollow ? Theme.accentBlue : Theme.textTertiary}
        />
      </Pressable>

      {/* Recenter button */}
      <Pressable onPress={handleRecenter} style={styles.recenterBtn}>
        <Ionicons name="locate-outline" size={20} color={Theme.text} />
      </Pressable>
    </View>
  );
}

// ── Haversine distance (km) for tracking ────────────────────────────────────

function haversineDistanceCalc(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Tracking Panel (Phase 9) — Floating bottom card during bus tracking ─────

function TrackingPanel({
  busId,
  onCancel,
}: {
  busId: string;
  onCancel: () => void;
}) {
  const bus = usePassengerStore((s) => s.buses.get(busId));
  const distanceMeters = usePassengerStore((s) => s.trackingDistanceMeters);
  const etaMinutes = usePassengerStore((s) => s.trackingEtaMinutes);
  const originStop = usePassengerStore((s) => s.trackingOriginStop);

  const distStr = distanceMeters < 1000
    ? `${distanceMeters}m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;

  const etaColor =
    etaMinutes <= 3 ? Theme.accentGreen : etaMinutes <= 8 ? '#F59E0B' : Theme.text;

  return (
    <View style={styles.trackingPanel}>
      {/* Bus badge */}
      <View style={styles.trackingHeader}>
        <View style={styles.trackingBusBadge}>
          <Ionicons name="bus" size={16} color={Theme.text} />
          <Text style={styles.trackingBusNumber}>{bus?.routeNumber ?? '---'}</Text>
        </View>
        <View style={styles.trackingLiveDot}>
          <View style={styles.trackingPulse} />
          <Text style={styles.trackingLiveText}>LIVE</Text>
        </View>
      </View>

      {/* Distance + ETA */}
      <View style={styles.trackingInfo}>
        <View style={styles.trackingMetric}>
          <Ionicons name="navigate-outline" size={16} color={Theme.textMuted} />
          <Text style={styles.trackingMetricValue}>{distStr} away</Text>
        </View>
        <View style={styles.trackingMetric}>
          <Ionicons name="time-outline" size={16} color={etaColor} />
          <Text style={[styles.trackingEta, { color: etaColor }]}>
            Arriving in {etaMinutes} min
          </Text>
        </View>
      </View>

      {/* Destination */}
      {originStop && (
        <Text style={styles.trackingDest} numberOfLines={1}>
          <Ionicons name="flag" size={11} color={Theme.accentGreen} /> {originStop.name}
        </Text>
      )}

      {/* Cancel */}
      <Pressable onPress={onCancel} style={styles.trackingCancelBtn}>
        <Ionicons name="close-circle" size={16} color={Theme.accentRed} />
        <Text style={styles.trackingCancelText}>Cancel Tracking</Text>
      </Pressable>
    </View>
  );
}

// ── Create bus marker DOM element ───────────────────────────────────────────

function createBusMarkerElement(
  bus: BusState,
  isSelected: boolean,
): HTMLDivElement {
  const color = OCCUPANCY_COLORS[bus.occupancy.level];
  const confidence = bus.confidence ?? 0.7;

  const el = document.createElement('div');
  el.className = `hydgo-bus-marker${isSelected ? ' selected' : ''}`;
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: max-content;
    background: ${Theme.bgCard};
    border: 2px solid ${color};
    border-radius: 18px;
    padding: 4px 10px;
    cursor: pointer;
    z-index: ${isSelected ? 100 : 10};
    user-select: none;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `;

  // Occupancy color dot
  const dot = document.createElement('span');
  dot.style.cssText = `
    width: 7px; height: 7px;
    background: ${color};
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  `;

  // Route number label
  const label = document.createElement('span');
  label.textContent = bus.routeNumber ?? '---';
  label.style.cssText = `
    color: ${Theme.text};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  el.appendChild(dot);
  el.appendChild(label);

  // ETA badge
  if (bus.eta) {
    const etaMin = bus.eta.estimatedMinutes ?? 99;
    const etaColor =
      etaMin <= 5 ? '#10B981' : etaMin <= 12 ? '#F59E0B' : '#EF4444';
    const etaBg =
      etaMin <= 5 ? '#10B98118' : etaMin <= 12 ? '#F59E0B18' : '#EF444418';

    const etaBadge = document.createElement('div');
    etaBadge.textContent = bus.eta.formattedETA;
    etaBadge.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 4px;
      background: ${etaBg};
      color: ${etaColor};
      font-size: 9px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 8px;
      white-space: nowrap;
      border: 1px solid ${etaColor}30;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: 0.3px;
    `;
    el.style.position = 'relative';
    el.appendChild(etaBadge);
  }

  return el;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  nativeMapPlaceholder: {
    flex: 1,
    backgroundColor: Theme.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    color: Theme.textDim,
    fontSize: Theme.font.md,
  },
  autoFollowBtn: {
    position: 'absolute',
    bottom: 260,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadowSubtle,
    zIndex: 150,
  } as any,
  autoFollowActive: {
    borderColor: Theme.accentBlue + '40',
    backgroundColor: Theme.accentBlue + '12',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 310,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadowSubtle,
    zIndex: 150,
  } as any,

  // ── Tracking Panel (Phase 9) ──
  trackingPanel: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    padding: 18,
    gap: 12,
    zIndex: 200,
    ...Theme.shadowHeavy,
  } as any,
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingBusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trackingBusNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  trackingLiveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trackingPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  trackingLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.5,
  },
  trackingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 16,
  },
  trackingMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackingMetricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CCC',
  },
  trackingEta: {
    fontSize: 17,
    fontWeight: '700',
  },
  trackingDest: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    textAlign: 'center',
  },
  trackingCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
  },
  trackingCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
});

// Alias so imports as PremiumMapView work
export { MapViewLayer as PremiumMapView };
