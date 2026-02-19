// ── Passenger Zustand Store ─────────────────────────────────────────────────
// Single source of truth for the passenger map engine.
// Uses Map<string, BusState> for O(1) bus lookups.
// Includes journey tracking, profile, and directions state.

import { create } from 'zustand';
import type {
  BusState,
  BusUpdate,
  ConnectionStatus,
  UserLocation,
  StopInfo,
  RouteInfo,
  SuggestionInfo,
  ActiveJourney,
  JourneyRecord,
  JourneyStatus,
  DirectionsRoute,
  SavedStop,
  FavoriteRoute,
  PassengerNotification,
} from '../types';

interface PassengerState {
  // ── Buses ──
  buses: Map<string, BusState>;
  selectedBusId: string | null;

  // ── User location ──
  userLocation: UserLocation | null;
  userLocationName: string | null;

  // ── Nearest stop ──
  nearestStop: StopInfo | null;
  nearbyStops: StopInfo[];
  nearestStopDistance: number | null;
  nearestStopReliability: string | null;

  // ── Route preview ──
  previewRoute: RouteInfo | null;

  // ── Socket ──
  connectionStatus: ConnectionStatus;

  // ── Bottom sheet ──
  sheetExpanded: boolean;

  // ── Intelligence: suggestions ──
  suggestions: SuggestionInfo[];

  // ── Journey ──
  activeJourney: ActiveJourney | null;
  journeyHistory: JourneyRecord[];

  // ── Directions ──
  directionsRoutes: DirectionsRoute[];
  selectedDirectionsRoute: DirectionsRoute | null;

  // ── Profile ──
  savedStops: SavedStop[];
  favoriteRoutes: FavoriteRoute[];

  // ── Notifications ──
  notifications: PassengerNotification[];

  // ── Tracking (Phase 9 + 8.2) ──
  trackingMode: boolean;
  trackingBusId: string | null;
  trackingOriginStop: StopInfo | null;
  trackingDestStop: StopInfo | null;
  trackingDistanceMeters: number;
  trackingEtaMinutes: number;
  trackingRoadCoords: [number, number][];  // GeoJSON [lng,lat] from Mapbox Directions

  // ── UI ──
  isInitialLoad: boolean;
  mapViewport: { sw: [number, number]; ne: [number, number] } | null;

  // ── Actions ──
  setSnapshot: (buses: BusState[]) => void;
  updateBus: (update: BusUpdate) => void;
  updateBuses: (updates: BusUpdate[]) => void;
  removeBus: (busId: string) => void;
  setNearbyBuses: (buses: BusState[]) => void;
  setSuggestions: (suggestions: SuggestionInfo[]) => void;
  selectBus: (busId: string | null) => void;
  setUserLocation: (loc: UserLocation) => void;
  setUserLocationName: (name: string | null) => void;
  setNearestStop: (stop: StopInfo | null) => void;
  setNearbyStops: (stops: StopInfo[]) => void;
  setNearestStopDistance: (d: number | null) => void;
  setNearestStopReliability: (r: string | null) => void;
  setPreviewRoute: (route: RouteInfo | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSheetExpanded: (expanded: boolean) => void;
  setIsInitialLoad: (v: boolean) => void;
  setMapViewport: (vp: { sw: [number, number]; ne: [number, number] } | null) => void;

  // Journey actions
  startJourney: (journey: ActiveJourney) => void;
  updateJourney: (updates: Partial<ActiveJourney>) => void;
  completeJourney: () => void;
  cancelJourney: () => void;
  addJourneyRecord: (record: JourneyRecord) => void;

  // Directions actions
  setDirectionsRoutes: (routes: DirectionsRoute[]) => void;
  selectDirectionsRoute: (route: DirectionsRoute | null) => void;

  // Profile actions
  addSavedStop: (stop: SavedStop) => void;
  removeSavedStop: (id: string) => void;
  addFavoriteRoute: (route: FavoriteRoute) => void;
  removeFavoriteRoute: (id: string) => void;

  // Notification actions
  addNotification: (n: PassengerNotification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Tracking actions (Phase 9 + 8.2)
  startTracking: (busId: string, originStop: StopInfo, destStop?: StopInfo) => void;
  updateTracking: (distanceMeters: number, etaMinutes: number) => void;
  setTrackingRoadCoords: (coords: [number, number][]) => void;
  stopTracking: () => void;

  reset: () => void;
}

const initialState = {
  buses: new Map<string, BusState>(),
  selectedBusId: null as string | null,
  userLocation: null as UserLocation | null,
  userLocationName: null as string | null,
  nearestStop: null as StopInfo | null,
  nearbyStops: [] as StopInfo[],
  nearestStopDistance: null as number | null,
  nearestStopReliability: null as string | null,
  previewRoute: null as RouteInfo | null,
  connectionStatus: 'disconnected' as ConnectionStatus,
  sheetExpanded: false,
  suggestions: [] as SuggestionInfo[],
  activeJourney: null as ActiveJourney | null,
  journeyHistory: [] as JourneyRecord[],
  directionsRoutes: [] as DirectionsRoute[],
  selectedDirectionsRoute: null as DirectionsRoute | null,
  savedStops: [] as SavedStop[],
  favoriteRoutes: [] as FavoriteRoute[],
  notifications: [] as PassengerNotification[],
  // ── Tracking (Phase 9 + 8.2) ──
  trackingMode: false,
  trackingBusId: null as string | null,
  trackingOriginStop: null as StopInfo | null,
  trackingDestStop: null as StopInfo | null,
  trackingDistanceMeters: 0,
  trackingEtaMinutes: 0,
  trackingRoadCoords: [] as [number, number][],
  isInitialLoad: true,
  mapViewport: null as { sw: [number, number]; ne: [number, number] } | null,
};

export const usePassengerStore = create<PassengerState>((set, get) => ({
  ...initialState,

  setSnapshot: (buses) => {
    const map = new Map<string, BusState>();
    for (const bus of buses) {
      map.set(bus.id, bus);
    }
    set({ buses: map });
  },

  updateBus: (update) => {
    const { buses } = get();
    const next = new Map(buses);
    const existing = next.get(update.busId);

    const merged: BusState = {
      id: update.busId,
      registrationNo: existing?.registrationNo ?? '',
      routeNumber: update.routeNumber ?? existing?.routeNumber,
      routeName: existing?.routeName,
      routeType: existing?.routeType,
      routeId: update.routeId ?? existing?.routeId,
      latitude: update.latitude,
      longitude: update.longitude,
      heading: update.heading,
      speed: update.speed,
      passengerCount: update.passengerCount,
      capacity: update.capacity,
      occupancy: update.occupancy ?? existing?.occupancy ?? { level: 'LOW' as const, percent: 0, available: 0 },
      eta: existing?.eta,
      distanceMeters: existing?.distanceMeters,
    };

    next.set(update.busId, merged);
    set({ buses: next });
  },

  updateBuses: (updates) => {
    const { buses } = get();
    const next = new Map(buses);

    for (const update of updates) {
      const existing = next.get(update.busId);
      const merged: BusState = {
        id: update.busId,
        registrationNo: existing?.registrationNo ?? '',
        routeNumber: update.routeNumber ?? existing?.routeNumber,
        routeName: existing?.routeName,
        routeType: existing?.routeType,
        routeId: update.routeId ?? existing?.routeId,
        latitude: update.latitude,
        longitude: update.longitude,
        heading: update.heading,
        speed: update.speed,
        passengerCount: update.passengerCount,
        capacity: update.capacity,
        occupancy: update.occupancy ?? existing?.occupancy ?? { level: 'LOW' as const, percent: 0, available: 0 },
        eta: existing?.eta,
        distanceMeters: existing?.distanceMeters,
      };
      next.set(update.busId, merged);
    }

    set({ buses: next });
  },

  removeBus: (busId) => {
    const { buses, selectedBusId } = get();
    const next = new Map(buses);
    next.delete(busId);
    set({
      buses: next,
      selectedBusId: selectedBusId === busId ? null : selectedBusId,
      previewRoute: selectedBusId === busId ? null : get().previewRoute,
    });
  },

  setNearbyBuses: (buses) => {
    const { buses: existing } = get();
    const next = new Map(existing);
    for (const bus of buses) {
      next.set(bus.id, bus);
    }
    set({ buses: next });
  },

  setSuggestions: (suggestions) => set({ suggestions }),

  selectBus: (busId) => {
    set({ selectedBusId: busId, previewRoute: busId ? get().previewRoute : null });
  },

  setUserLocation: (loc) => set({ userLocation: loc }),
  setUserLocationName: (name) => set({ userLocationName: name }),
  setNearestStop: (stop) => set({ nearestStop: stop }),
  setNearbyStops: (stops) => set({ nearbyStops: stops }),
  setNearestStopDistance: (d) => set({ nearestStopDistance: d }),
  setNearestStopReliability: (r) => set({ nearestStopReliability: r }),
  setPreviewRoute: (route) => set({ previewRoute: route }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSheetExpanded: (expanded) => set({ sheetExpanded: expanded }),
  setIsInitialLoad: (v) => set({ isInitialLoad: v }),
  setMapViewport: (vp) => set({ mapViewport: vp }),

  // ── Journey actions ──
  startJourney: (journey) => set({ activeJourney: journey }),
  updateJourney: (updates) => {
    const current = get().activeJourney;
    if (!current) return;
    set({ activeJourney: { ...current, ...updates } });
  },
  completeJourney: () => {
    const j = get().activeJourney;
    if (!j) return;
    const record: JourneyRecord = {
      id: j.id,
      routeNumber: j.routeNumber,
      routeName: j.routeName,
      fromStopName: j.fromStop.name,
      toStopName: j.toStop?.name,
      date: new Date().toISOString(),
      waitTimeMinutes: Math.round((Date.now() - j.startedAt) / 60000),
      travelDurationMinutes: j.destinationEtaMinutes ?? 0,
      reliabilityExperienced: 'HIGH',
      trafficLevel: j.trafficLevel ?? 'LOW',
    };
    set({
      activeJourney: null,
      journeyHistory: [record, ...get().journeyHistory],
    });
  },
  cancelJourney: () => set({ activeJourney: null }),
  addJourneyRecord: (record) =>
    set({ journeyHistory: [record, ...get().journeyHistory] }),

  // ── Directions actions ──
  setDirectionsRoutes: (routes) => set({ directionsRoutes: routes }),
  selectDirectionsRoute: (route) => set({ selectedDirectionsRoute: route }),

  // ── Profile actions ──
  addSavedStop: (stop) =>
    set({ savedStops: [...get().savedStops, stop] }),
  removeSavedStop: (id) =>
    set({ savedStops: get().savedStops.filter((s) => s.id !== id) }),
  addFavoriteRoute: (route) =>
    set({ favoriteRoutes: [...get().favoriteRoutes, route] }),
  removeFavoriteRoute: (id) =>
    set({ favoriteRoutes: get().favoriteRoutes.filter((r) => r.id !== id) }),

  // ── Notification actions ──
  addNotification: (n) =>
    set({ notifications: [n, ...get().notifications].slice(0, 50) }),
  markNotificationRead: (id) =>
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }),
  clearNotifications: () => set({ notifications: [] }),

  // ── Tracking actions (Phase 9) ──
  startTracking: (busId, originStop, destStop) =>
    set({
      trackingMode: true,
      trackingBusId: busId,
      trackingOriginStop: originStop,
      trackingDestStop: destStop ?? null,
      trackingDistanceMeters: 0,
      trackingEtaMinutes: 0,
      selectedBusId: busId,
    }),
  updateTracking: (distanceMeters, etaMinutes) =>
    set({ trackingDistanceMeters: distanceMeters, trackingEtaMinutes: etaMinutes }),
  setTrackingRoadCoords: (coords) =>
    set({ trackingRoadCoords: coords }),
  stopTracking: () =>
    set({
      trackingMode: false,
      trackingBusId: null,
      trackingOriginStop: null,
      trackingDestStop: null,
      trackingDistanceMeters: 0,
      trackingEtaMinutes: 0,
      trackingRoadCoords: [],
      selectedBusId: null,
    }),

  reset: () => set(initialState),
}));
