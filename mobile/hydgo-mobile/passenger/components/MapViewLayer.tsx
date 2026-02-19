// ── Premium Map View Layer ──────────────────────────────────────────────────
// Dark-themed Mapbox GL JS map with:
// - Animated bus markers (DOM-based, no React re-render)
// - Smooth camera transitions (flyTo with easing)
// - User marker with pulsing halo
// - Route polyline highlight
// - Viewport tracking for performance
// - Only renders buses in viewport

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Theme, OCCUPANCY_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { useBusInterpolation, InterpolatedPositions } from '../hooks/useBusInterpolation';
import { decodePolyline } from '../utils/geo';
import type { BusState, OccupancyLevel } from '../types';

// Mapbox GL JS import (web only)
let mapboxgl: typeof import('mapbox-gl') | null = null;
if (Platform.OS === 'web') {
  try {
    mapboxgl = require('mapbox-gl');
  } catch {}
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const HYDERABAD_CENTER: [number, number] = [78.4867, 17.3850];
const DEFAULT_ZOOM = 13;

// Inject user marker styles (pulsing halo)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes hydgo-pulse {
      0% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(1); opacity: 0; }
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
      transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s ease;
      will-change: transform;
    }
    .hydgo-bus-marker:hover {
      transform: scale(1.08) !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
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

  const buses = usePassengerStore((s) => s.buses);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const selectedBusId = usePassengerStore((s) => s.selectedBusId);
  const previewRoute = usePassengerStore((s) => s.previewRoute);
  const setMapViewport = usePassengerStore((s) => s.setMapViewport);
  const setIsInitialLoad = usePassengerStore((s) => s.setIsInitialLoad);

  const [mapReady, setMapReady] = useState(false);

  // Initialize map
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

    // No navigation controls — map uses gestures only

    map.on('load', () => {
      mapRef.current = map;
      setMapReady(true);
      setIsInitialLoad(false);

      // Route polyline source/layer
      map.addSource('route-polyline', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });

      // Route glow (under)
      map.addLayer({
        id: 'route-polyline-glow',
        type: 'line',
        source: 'route-polyline',
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.15,
          'line-blur': 6,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });

      // Route line (over)
      map.addLayer({
        id: 'route-polyline-layer',
        type: 'line',
        source: 'route-polyline',
        paint: {
          'line-color': '#ffffff',
          'line-width': 3,
          'line-opacity': 0.8,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
    });

    // Track viewport for bus filtering
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

    // Listen for "fly to user" events from LocateMeButton
    const handleFlyToUser = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail;
      map.flyTo({ center: [lng, lat], zoom: 15.5, duration: 1200, essential: true });
    };
    window.addEventListener('hydgo:flyToUser', handleFlyToUser);

    return () => {
      window.removeEventListener('hydgo:flyToUser', handleFlyToUser);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Interpolation callback — updates marker positions every frame
  const handleFrame = useCallback(
    (positions: InterpolatedPositions) => {
      if (!mapRef.current || Platform.OS !== 'web' || !mapboxgl) return;

      const map = mapRef.current;
      const currentBusIds = new Set<string>();

      const currentBuses = usePassengerStore.getState().buses;
      const currentSelectedId = usePassengerStore.getState().selectedBusId;

      // Get viewport bounds for filtering
      const bounds = map.getBounds();
      const pad = 0.01; // Small padding outside viewport

      currentBuses.forEach((bus, busId) => {
        currentBusIds.add(busId);
        const pos = positions[busId] ?? { latitude: bus.latitude, longitude: bus.longitude };

        // Only render buses in viewport (with padding)
        if (bounds) {
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          if (
            pos.latitude < sw.lat - pad ||
            pos.latitude > ne.lat + pad ||
            pos.longitude < sw.lng - pad ||
            pos.longitude > ne.lng + pad
          ) {
            // Outside viewport — remove marker if exists
            const existing = markersRef.current.get(busId);
            if (existing) {
              existing.remove();
              markersRef.current.delete(busId);
            }
            return;
          }
        }

        const existing = markersRef.current.get(busId);

        if (existing) {
          existing.setLngLat([pos.longitude, pos.latitude]);
          const wrapper = existing.getElement();
          const inner = wrapper?.querySelector('.hydgo-bus-marker') as HTMLElement | null;
          if (inner) {
            const isSelected = currentSelectedId === busId;
            inner.style.transform = isSelected ? 'scale(1.15)' : 'scale(1)';
            inner.style.zIndex = isSelected ? '100' : '10';
            inner.style.boxShadow = isSelected
              ? '0 4px 20px rgba(255,255,255,0.15)'
              : '0 2px 8px rgba(0,0,0,0.4)';
          }
        } else {
          const el = createBusMarkerElement(bus, currentSelectedId === busId);
          el.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            onBusPressRef.current(busId);
          });

          // Wrap in a plain container so Mapbox controls transform on wrapper only
          const container = document.createElement('div');
          container.style.cssText = 'overflow:visible;';
          container.appendChild(el);

          const marker = new (mapboxgl as any).Marker({ element: container, anchor: 'center' })
            .setLngLat([pos.longitude, pos.latitude])
            .addTo(map);

          markersRef.current.set(busId, marker);
        }
      });

      // Remove stale markers
      markersRef.current.forEach((marker, busId) => {
        if (!currentBusIds.has(busId)) {
          marker.remove();
          markersRef.current.delete(busId);
        }
      });
    },
    [],
  );

  useBusInterpolation(handleFrame);

  // User location marker with pulsing halo
  useEffect(() => {
    if (!mapRef.current || !mapReady || Platform.OS !== 'web' || !mapboxgl) return;
    if (!userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
    } else {
      // Outer wrapper for Mapbox to control positioning
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'overflow:visible;width:0;height:0;';

      // Visual container (centered on the wrapper)
      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        width: 30px; height: 30px;
        top: -15px; left: -15px;
        pointer-events: none;
        overflow: visible;
      `;

      // Halo pulse
      const halo = document.createElement('div');
      halo.className = 'hydgo-user-halo';
      container.appendChild(halo);

      // Core dot
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

      const marker = new (mapboxgl as any).Marker({ element: wrapper, anchor: 'center' })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);

      // Force the Mapbox wrapper to show overflow
      const mapboxWrapper = marker.getElement();
      if (mapboxWrapper) {
        mapboxWrapper.style.overflow = 'visible';
        mapboxWrapper.style.zIndex = '9999';
      }

      userMarkerRef.current = marker;

      // Smooth camera transition to user
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: DEFAULT_ZOOM,
        duration: 2000,
        essential: true,
      });
    }
  }, [userLocation, mapReady]);

  // Route polyline
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const source = mapRef.current.getSource('route-polyline');
    if (!source) return;

    if (previewRoute?.polyline) {
      // Handle both JSON coordinate arrays and Google-encoded polylines
      let coords: [number, number][];
      const raw = previewRoute.polyline as any;
      if (Array.isArray(raw)) {
        coords = raw.map((p: number[]) => [p[1], p[0]] as [number, number]);
      } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          coords = parsed.map((p: number[]) => [p[1], p[0]] as [number, number]);
        } catch {
          coords = [];
        }
      } else if (typeof raw === 'string' && raw.length > 0) {
        coords = decodePolyline(raw);
      } else {
        coords = [];
      }

      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    } else {
      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
        properties: {},
      });
    }
  }, [previewRoute, mapReady]);

  // Fly to selected bus (smooth zoom)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !selectedBusId) return;
    const bus = buses.get(selectedBusId);
    if (bus) {
      mapRef.current.flyTo({
        center: [bus.longitude, bus.latitude],
        zoom: 15.5,
        duration: 1000,
        essential: true,
      });
    }
  }, [selectedBusId, mapReady]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.nativeMapPlaceholder} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div ref={mapContainerRef as any} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createBusMarkerElement(bus: BusState, isSelected: boolean): HTMLDivElement {
  const color = OCCUPANCY_COLORS[bus.occupancy.level];
  const el = document.createElement('div');
  el.className = 'hydgo-bus-marker';
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: max-content;
    background: ${Theme.bgCard};
    border: 2px solid ${color};
    border-radius: 16px;
    padding: 4px 10px;
    cursor: pointer;
    z-index: ${isSelected ? 100 : 10};
    transform: scale(${isSelected ? 1.15 : 1});
    user-select: none;
    box-shadow: ${isSelected
      ? '0 4px 20px rgba(255,255,255,0.15)'
      : '0 2px 8px rgba(0,0,0,0.4)'};
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `;

  const dot = document.createElement('span');
  dot.style.cssText = `
    width: 7px; height: 7px;
    background: ${color};
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  `;

  const label = document.createElement('span');
  label.textContent = bus.routeNumber ?? '---';
  label.style.cssText = `
    color: ${Theme.text};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  el.appendChild(dot);
  el.appendChild(label);

  if (bus.eta) {
    const etaMin = bus.eta.estimatedMinutes ?? 99;
    const etaColor = etaMin <= 5 ? '#10B981' : etaMin <= 12 ? '#F59E0B' : '#EF4444';
    const etaBg = etaMin <= 5 ? '#10B98118' : etaMin <= 12 ? '#F59E0B18' : '#EF444418';

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
  },
});
