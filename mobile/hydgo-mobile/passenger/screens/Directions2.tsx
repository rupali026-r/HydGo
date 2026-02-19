// ── Directions 2.0 — Real Transit Experience ───────────────────────────────
// Timeline-based route planning with:
// - Total time, transfer count, reliability dot, confidence %
// - Route number badges, walking distance meters
// - Sort by: Fastest | Least Transfers | Most Reliable
// - Click route → zoom map, animate bus markers, show fare placeholder
// - Full intelligence visualization per route

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Theme, RELIABILITY_COLORS, CONFIDENCE_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { api } from '../../lib/api';
import { useAllStops } from '../hooks/useAllStops';
import { ConfidenceDot, IntelligenceTooltip } from '../components/IntelligenceTooltip';
import { AppHeader } from '../components/AppHeader';
import { ReliabilityBadge } from '../components/ReliabilityBadge';
import { TrafficIndicator } from '../components/TrafficIndicator';
import type { StopInfo } from '../types';

const MAX_SUGGESTIONS = 8;

type SortMode = 'fastest' | 'transfers' | 'reliable';

export default function Directions() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    fromName?: string;
    toStopId?: string;
    toStopName?: string;
  }>();

  const userLocationName = usePassengerStore((s) => s.userLocationName);
  const nearbyStops = usePassengerStore((s) => s.nearbyStops);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const startTracking = usePassengerStore((s) => s.startTracking);
  const allStops = useAllStops();

  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);
  const isNavigatingRef = useRef(false);

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [didInitialSearch, setDidInitialSearch] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('fastest');
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null);

  // ── Selected stop objects (coordinates stored directly) ──
  const [selectedFrom, setSelectedFrom] = useState<StopInfo | null>(null);
  const [selectedTo, setSelectedTo] = useState<StopInfo | null>(null);
  const [nearbyBuses, setNearbyBuses] = useState<any[]>([]);
  const [showNearbyFallback, setShowNearbyFallback] = useState(false);
  /** 'direct' = stop-based bus list, 'transfer' = Dijkstra legs */
  const [routeStrategy, setRouteStrategy] = useState<'direct' | 'transfer'>('direct');

  // ── Initialize from params ──
  useEffect(() => {
    const from = params.fromName || userLocationName || 'Current Location';
    setFromText(from);
    if (params.toStopName) setToText(params.toStopName);
  }, []);

  // ── Auto-search ──
  useEffect(() => {
    if (
      !didInitialSearch &&
      params.toStopName &&
      fromText.length > 0 &&
      allStops.length > 0
    ) {
      setDidInitialSearch(true);
      findRoutes(fromText, params.toStopName);
    }
  }, [fromText, allStops, didInitialSearch, params.toStopName]);

  // ── Fuzzy stop search ──
  const filtered = useMemo<StopInfo[]>(() => {
    const query = activeField === 'from' ? fromText : toText;
    if (!query || query.trim().length < 1) return allStops.slice(0, MAX_SUGGESTIONS);
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    return allStops
      .filter((s) => words.every((w) => s.name.toLowerCase().includes(w)))
      .slice(0, MAX_SUGGESTIONS);
  }, [fromText, toText, activeField, allStops]);

  const showDropdown = activeField !== null && filtered.length > 0;

  // ── Sorted routes ──
  const sortedRoutes = useMemo(() => {
    if (routes.length === 0) return [];
    const cloned = [...routes];
    if (routeStrategy === 'direct') {
      // Direct bus results: sort by etaMinutes, stopsCount, reliability
      switch (sortMode) {
        case 'fastest':
          cloned.sort((a, b) => (a.etaMinutes ?? a.totalETA ?? 99) - (b.etaMinutes ?? b.totalETA ?? 99));
          break;
        case 'transfers':
          cloned.sort((a, b) => (a.stopsCount ?? a.transfers ?? 99) - (b.stopsCount ?? b.transfers ?? 99));
          break;
        case 'reliable':
          cloned.sort(
            (a, b) =>
              (b.reliability ?? b.reliabilityScore ?? 0) - (a.reliability ?? a.reliabilityScore ?? 0) ||
              (a.etaMinutes ?? a.totalETA ?? 99) - (b.etaMinutes ?? b.totalETA ?? 99),
          );
          break;
      }
    } else {
      // Transfer (Dijkstra) results: sort by totalETA, transfers count, reliability
      switch (sortMode) {
        case 'fastest':
          cloned.sort((a, b) => (a.totalETA ?? 99) - (b.totalETA ?? 99));
          break;
        case 'transfers':
          cloned.sort(
            (a, b) =>
              (a.transfers ?? 99) - (b.transfers ?? 99) ||
              (a.totalETA ?? 99) - (b.totalETA ?? 99),
          );
          break;
        case 'reliable':
          cloned.sort(
            (a, b) =>
              (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0) ||
              (a.totalETA ?? 99) - (b.totalETA ?? 99),
          );
          break;
      }
    }
    return cloned;
  }, [routes, sortMode, routeStrategy]);

  // ── Stop select ──
  const handleStopSelect = useCallback(
    (stop: StopInfo) => {
      if (activeField === 'from') {
        setFromText(stop.name);
        setSelectedFrom(stop);
        setActiveField('to');
        setTimeout(() => toRef.current?.focus(), 100);
      } else {
        setToText(stop.name);
        setSelectedTo(stop);
        setActiveField(null);
        Keyboard.dismiss();
        if (fromText.length > 0) findRoutes(fromText, stop.name, undefined, stop);
      }
    },
    [activeField, fromText],
  );

  // ── Swap ──
  const handleSwap = () => {
    const temp = fromText;
    setFromText(toText);
    setToText(temp);
    const tempStop = selectedFrom;
    setSelectedFrom(selectedTo);
    setSelectedTo(tempStop);
    setActiveField(null);
    if (toText.length > 0 && fromText.length > 0) findRoutes(toText, fromText, selectedTo, selectedFrom);
  };

  // ── Resolve stop coordinates (exact → fuzzy → user location) ──
  const resolveCoords = (
    name: string,
    preselected: StopInfo | null | undefined,
    fallbackLat?: number,
    fallbackLng?: number,
  ): { lat: number; lng: number } => {
    // 1. Use pre-selected stop coordinates if available
    if (preselected?.latitude && preselected?.longitude) {
      return { lat: preselected.latitude, lng: preselected.longitude };
    }
    // 2. Exact name match
    const exact =
      allStops.find((s) => s.name.toLowerCase() === name.toLowerCase()) ??
      nearbyStops.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exact?.latitude && exact?.longitude) {
      return { lat: exact.latitude, lng: exact.longitude };
    }
    // 3. Fuzzy partial match (name contains query or query contains name)
    const q = name.toLowerCase().trim();
    const fuzzy = allStops.find(
      (s) =>
        s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()),
    );
    if (fuzzy?.latitude && fuzzy?.longitude) {
      return { lat: fuzzy.latitude, lng: fuzzy.longitude };
    }
    // 4. Fallback (user location for "from", 0,0 for "to")
    return { lat: fallbackLat ?? 0, lng: fallbackLng ?? 0 };
  };

  // ── Fetch nearby buses for fallback ──
  const fetchNearbyBuses = async (lat: number, lng: number) => {
    try {
      const res = await api.get('/buses/nearby', {
        params: { latitude: lat, longitude: lng, radius: 5 },
      });
      const buses = res.data?.data ?? [];
      setNearbyBuses(buses.slice(0, 8));
      setShowNearbyFallback(buses.length > 0);
    } catch {
      setNearbyBuses([]);
      setShowNearbyFallback(false);
    }
  };

  // ── Find routes ──
  const findRoutes = async (
    from: string,
    to: string,
    fromStopOverride?: StopInfo | null,
    toStopOverride?: StopInfo | null,
  ) => {
    setRoutesLoading(true);
    setActiveField(null);
    setSelectedRouteIdx(null);
    setShowNearbyFallback(false);
    setNearbyBuses([]);
    try {
      const fromCoords = resolveCoords(
        from,
        fromStopOverride ?? selectedFrom,
        userLocation?.latitude,
        userLocation?.longitude,
      );
      const toCoords = resolveCoords(to, toStopOverride ?? selectedTo);

      if (toCoords.lat === 0 && toCoords.lng === 0) {
        setRoutes([]);
        // Still try nearby buses from user location
        if (fromCoords.lat !== 0) fetchNearbyBuses(fromCoords.lat, fromCoords.lng);
        setRoutesLoading(false);
        return;
      }

      const res = await api.get('/transit/route-plan', {
        params: {
          fromLat: fromCoords.lat,
          fromLng: fromCoords.lng,
          toLat: toCoords.lat,
          toLng: toCoords.lng,
          fromName: from,
          toName: to,
        },
      });

      const data = res.data;
      const strategy = data?.strategy ?? 'transfer';
      setRouteStrategy(strategy);

      if (data?.routes?.length > 0) {
        setRoutes(data.routes);
      } else {
        setRoutes([]);
        // Fallback: fetch nearby buses from destination area
        fetchNearbyBuses(toCoords.lat, toCoords.lng);
      }
    } catch {
      setRoutes([]);
    }
    setRoutesLoading(false);
  };

  // ── Navigate to Live Buses screen (optionally filtered by routeId) ──
  const handleViewLiveBuses = useCallback((route?: any) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => { isNavigatingRef.current = false; }, 1500);

    const fromCoords = resolveCoords(
      fromText,
      selectedFrom,
      userLocation?.latitude,
      userLocation?.longitude,
    );
    const toCoords = resolveCoords(toText, selectedTo);

    // Extract routeId from the route object (direct route has routeId; transfer has legs)
    const routeId: string | undefined =
      route?.routeId ??
      route?.legs?.find((l: any) => l.type === 'BUS')?.routeId ??
      undefined;
    const routeNumber: string | undefined =
      route?.routeNumber ??
      route?.legs?.find((l: any) => l.type === 'BUS')?.routeNumber ??
      undefined;

    router.push({
      pathname: '/(app)/passenger/livebuses',
      params: {
        ...(routeId ? { routeId, routeNumber: routeNumber ?? '' } : {}),
        originStop: fromText,
        originLat: String(fromCoords.lat),
        originLng: String(fromCoords.lng),
        destStop: toText,
        destLat: String(toCoords.lat),
        destLng: String(toCoords.lng),
      },
    } as any);
  }, [fromText, toText, selectedFrom, selectedTo, userLocation, router]);

  // ── Route select → toggle expand/collapse (no navigation) ──
  const handleRouteSelect = useCallback(
    (_route: any, index: number) => {
      setSelectedRouteIdx((prev) => (prev === index ? null : index));
    },
    [],
  );

  // ── Start Journey: auto-select best live bus for a direct route → tracking ──
  const handleStartJourney = useCallback(
    async (route: any) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      const fromCoords = resolveCoords(
        fromText,
        selectedFrom,
        userLocation?.latitude,
        userLocation?.longitude,
      );
      const toCoords = resolveCoords(toText, selectedTo);

      try {
        const res = await api.get('/live-buses', {
          params: {
            routeId: route.routeId,
            originStop: fromText || undefined,
            originLat: String(fromCoords.lat),
            originLng: String(fromCoords.lng),
            destStop: toText || undefined,
          },
        });
        const buses: any[] = res.data?.buses ?? [];

        if (buses.length > 0) {
          // Pick best bus (sorted by ETA ascending)
          const best = buses[0];
          const originStop = {
            id: '',
            name: fromText || route.fromStop?.name || 'Origin',
            latitude: fromCoords.lat,
            longitude: fromCoords.lng,
            routeId: route.routeId,
            stopOrder: 0,
          };
          const destStop = toText
            ? {
                id: '',
                name: toText || route.toStop?.name || '',
                latitude: toCoords.lat,
                longitude: toCoords.lng,
                routeId: route.routeId,
                stopOrder: 0,
              }
            : undefined;
          startTracking(best.busId, originStop, destStop);
          router.push('/(app)/passenger/tracking' as any);
          return;
        }
      } catch {
        // Fall through to LiveBuses
      } finally {
        setTimeout(() => { isNavigatingRef.current = false; }, 1500);
      }

      // No active buses found — show LiveBuses with route filter (empty state)
      router.push({
        pathname: '/(app)/passenger/livebuses',
        params: {
          routeId: route.routeId,
          routeNumber: route.routeNumber ?? '',
          originStop: fromText,
          originLat: String(fromCoords.lat),
          originLng: String(fromCoords.lng),
          destStop: toText,
          destLat: String(toCoords.lat),
          destLng: String(toCoords.lng),
        },
      } as any);
    },
    [fromText, toText, selectedFrom, selectedTo, userLocation, startTracking, router],
  );

  // ── Suggestion row renderer ──
  const renderSuggestion = useCallback(
    ({ item }: { item: StopInfo }) => (
      <Pressable style={styles.suggestionRow} onPress={() => handleStopSelect(item)}>
        <View style={styles.suggestionIcon}>
          <Ionicons name="bus" size={13} color={Theme.accent} />
        </View>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {item.name}
        </Text>
        <Ionicons name="arrow-forward" size={12} color={Theme.textMuted} />
      </Pressable>
    ),
    [handleStopSelect],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <AppHeader title="Directions">
        <IntelligenceTooltip />
      </AppHeader>

      {/* ── From/To Card ── */}
      <View style={[styles.inputCard, showDropdown && styles.inputCardOpen]}>
        <View style={styles.fieldsContainer}>
          {/* Timeline dots */}
          <View style={styles.timeline}>
            <View style={[styles.dot, styles.dotGreen]} />
            <View style={styles.timelineLine} />
            <View style={[styles.dot, styles.dotRed]} />
          </View>

          {/* Input fields */}
          <View style={styles.fieldsColumn}>
            <Pressable
              style={[
                styles.fieldRow,
                activeField === 'from' && styles.fieldRowActive,
              ]}
              onPress={() => {
                setActiveField('from');
                fromRef.current?.focus();
              }}
            >
              <TextInput
                ref={fromRef}
                style={styles.fieldInput}
                value={fromText}
                onChangeText={(t) => {
                  setFromText(t);
                  setActiveField('from');
                }}
                onFocus={() => setActiveField('from')}
                placeholder="Your location"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => {
                  setActiveField('to');
                  toRef.current?.focus();
                }}
              />
              {fromText.length > 0 && activeField === 'from' && (
                <Pressable
                  onPress={() => setFromText('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
                </Pressable>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.fieldRow,
                activeField === 'to' && styles.fieldRowActive,
              ]}
              onPress={() => {
                setActiveField('to');
                toRef.current?.focus();
              }}
            >
              <TextInput
                ref={toRef}
                style={styles.fieldInput}
                value={toText}
                onChangeText={(t) => {
                  setToText(t);
                  setActiveField('to');
                }}
                onFocus={() => setActiveField('to')}
                placeholder="Where to?"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="search"
              />
              {toText.length > 0 && activeField === 'to' && (
                <Pressable
                  onPress={() => setToText('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
                </Pressable>
              )}
            </Pressable>
          </View>

          {/* Swap button */}
          <Pressable onPress={handleSwap} style={styles.swapBtn} hitSlop={6}>
            <Ionicons name="swap-vertical" size={18} color={Theme.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* ── Autocomplete Dropdown ── */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.id}-${item.name}`}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={filtered.length > 5}
            style={{ maxHeight: 340 }}
          />
        </View>
      )}

      {/* ── Sort Controls ── */}
      {routes.length > 1 && !showDropdown && (
        <View style={styles.sortRow}>
          <SortPill
            label="Fastest"
            icon="flash-outline"
            active={sortMode === 'fastest'}
            onPress={() => setSortMode('fastest')}
          />
          <SortPill
            label={routeStrategy === 'direct' ? 'Fewest Stops' : 'Least Transfers'}
            icon="swap-horizontal-outline"
            active={sortMode === 'transfers'}
            onPress={() => setSortMode('transfers')}
          />
          <SortPill
            label="Most Reliable"
            icon="shield-checkmark-outline"
            active={sortMode === 'reliable'}
            onPress={() => setSortMode('reliable')}
          />
        </View>
      )}

      {/* ── Live Buses CTA ── */}
      {!routesLoading && routes.length > 0 && !showDropdown && (
        <Pressable style={styles.liveBusesCta} onPress={() => handleViewLiveBuses()}>
          <View style={styles.liveBusesCtaLeft}>
            <View style={styles.liveBusesCtaPulse} />
            <Text style={styles.liveBusesCtaText}>See Live Buses at Stop</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Theme.accentBlue} />
        </Pressable>
      )}

      {/* ── Route Results ── */}
      <ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
      >
        {routesLoading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator color={Theme.accent} size="small" />
            <Text style={styles.statusText}>Finding routes...</Text>
          </View>
        )}

        {!routesLoading &&
          routes.length === 0 &&
          toText.length > 0 &&
          fromText.length > 0 &&
          !showDropdown && (
            <View style={styles.statusContainer}>
              <Ionicons name="navigate-outline" size={36} color={Theme.textMuted} />
              <Text style={styles.statusTitle}>
                {showNearbyFallback
                  ? 'No direct connection found'
                  : 'No direct routes found'}
              </Text>
              <Text style={styles.statusText}>
                {showNearbyFallback
                  ? 'Showing nearby live buses instead'
                  : 'Try different stops or check nearby locations'}
              </Text>
            </View>
          )}

        {/* ── Nearby Buses Fallback ── */}
        {!routesLoading &&
          routes.length === 0 &&
          showNearbyFallback &&
          nearbyBuses.length > 0 &&
          !showDropdown && (
            <View style={styles.nearbySection}>
              {nearbyBuses.map((bus: any, idx: number) => (
                <Animated.View
                  key={bus.id ?? `nb-${idx}`}
                  entering={FadeInDown.delay(idx * 50).duration(250)}
                >
                  <View style={styles.nearbyBusCard}>
                    <View style={styles.nearbyBusLeft}>
                      <View style={styles.nearbyRouteBadge}>
                        <Ionicons name="bus" size={12} color={Theme.text} />
                        <Text style={styles.nearbyRouteNum}>
                          {bus.routeNumber ?? '---'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nearbyBusName} numberOfLines={1}>
                          {bus.routeName ?? 'Unknown Route'}
                        </Text>
                        {bus.eta?.formattedETA && (
                          <Text style={{ color: Theme.accentGreen, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                            {bus.eta.formattedETA}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.nearbyBusRight}>
                      {bus.distanceMeters != null && (
                        <Text style={styles.nearbyDistance}>
                          {bus.distanceMeters < 1000
                            ? `${bus.distanceMeters}m`
                            : `${(bus.distanceMeters / 1000).toFixed(1)}km`}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.nearbyOccupancy,
                          {
                            backgroundColor:
                              bus.occupancy?.level === 'HIGH'
                                ? '#ef4444'
                                : bus.occupancy?.level === 'MEDIUM'
                                ? '#f59e0b'
                                : '#22c55e',
                          },
                        ]}
                      >
                        <Text style={styles.nearbyOccText}>
                          {bus.occupancy?.level ?? 'LOW'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

        {!routesLoading &&
          routes.length === 0 &&
          (toText.length === 0 || showDropdown) && (
            <View style={styles.statusContainer}>
              <Ionicons name="bus-outline" size={32} color={Theme.textMuted} />
              <Text style={styles.statusText}>
                Enter your destination to see available routes
              </Text>
            </View>
          )}

        {sortedRoutes.map((route: any, rIdx: number) =>
          routeStrategy === 'direct' ? (
            <DirectBusCard
              key={`dbus-${rIdx}`}
              route={route}
              index={rIdx}
              isSelected={selectedRouteIdx === rIdx}
              onPress={() => handleRouteSelect(route, rIdx)}
              onStartJourney={() => handleStartJourney(route)}
            />
          ) : (
            <RouteCard
              key={`route-${rIdx}`}
              route={route}
              index={rIdx}
              isSelected={selectedRouteIdx === rIdx}
              onPress={() => handleRouteSelect(route, rIdx)}
              onSeeLiveBuses={() => handleViewLiveBuses(route)}
            />
          ),
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sort Pill ──

function SortPill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sortPill, active && styles.sortPillActive]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={active ? Theme.text : Theme.textMuted}
      />
      <Text
        style={[styles.sortPillText, active && styles.sortPillTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Direct Bus Card ── (stop-based results: shows bus list with ETA, stops, live status)

function DirectBusCard({
  route,
  index,
  isSelected,
  onPress,
  onStartJourney,
}: {
  route: any;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  onStartJourney: () => void;
}) {
  const etaMinutes = route.etaMinutes ?? 0;
  const stopsCount = route.stopsCount ?? 0;
  const reliability = route.reliability ?? 50;
  const confidence = route.confidence ?? 0.7;
  const isLive = route.isLive ?? false;
  const walkMeters = route.walkToStopMeters ?? 0;
  const intermediateStops: string[] = route.intermediateStops ?? [];
  const [expanded, setExpanded] = useState(false);

  const reliabilityLabel =
    reliability >= 80 ? 'HIGH' : reliability >= 50 ? 'MEDIUM' : 'LOW';
  const reliabilityColor = RELIABILITY_COLORS[reliabilityLabel];

  const confidenceLabel =
    confidence >= 0.8 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        onPress={onPress}
        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
      >
        {/* ── Top row: Route badge + ETA + Stops ── */}
        <View style={styles.routeCardTop}>
          {/* Large route number badge */}
          <View style={[styles.directRouteBadge]}>
            <Ionicons name="bus" size={14} color={Theme.text} />
            <Text style={styles.directRouteNum}>{route.routeNumber ?? '---'}</Text>
          </View>

          {/* ETA */}
          <View style={styles.routeTimeBadge}>
            <Ionicons name="time-outline" size={14} color={Theme.text} />
            <Text style={styles.routeTimeText}>{etaMinutes} min</Text>
          </View>

          {/* Stops count */}
          <View style={styles.transferBadge}>
            <Ionicons name="ellipsis-horizontal" size={11} color={Theme.textTertiary} />
            <Text style={styles.transferText}>
              {stopsCount} stop{stopsCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* LIVE badge */}
          {isLive && (
            <View style={styles.directLiveBadge}>
              <View style={styles.livePulse} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* ── Route name ── */}
        <Text style={styles.directRouteName} numberOfLines={1}>
          {route.routeName ?? `${route.fromStop?.name ?? '?'} → ${route.toStop?.name ?? '?'}`}
        </Text>

        {/* ── Intelligence row ── */}
        <View style={styles.intelRow}>
          {/* Reliability dot */}
          <View style={styles.reliabilityMini}>
            <View style={[styles.reliabilityDot, { backgroundColor: reliabilityColor }]} />
            <Text style={[styles.reliabilityText, { color: reliabilityColor }]}>
              {reliabilityLabel}
            </Text>
          </View>

          {/* Confidence */}
          <ConfidenceDot confidence={confidence} showLabel />

          {/* Walking distance to stop */}
          {walkMeters > 0 && (
            <View style={styles.walkBadge}>
              <Ionicons name="walk-outline" size={11} color={Theme.textTertiary} />
              <Text style={styles.walkText}>
                {walkMeters < 1000 ? `${Math.round(walkMeters)}m` : `${(walkMeters / 1000).toFixed(1)}km`}
              </Text>
            </View>
          )}

          {/* Distance */}
          {route.distanceKm != null && route.distanceKm > 0 && (
            <View style={styles.walkBadge}>
              <Ionicons name="navigate-outline" size={11} color={Theme.textTertiary} />
              <Text style={styles.walkText}>{route.distanceKm.toFixed(1)} km</Text>
            </View>
          )}

          {/* Next bus ETA */}
          {route.nextBusETA != null && (
            <View style={styles.firstBusBadge}>
              <Ionicons name="bus" size={10} color={Theme.accentGreen} />
              <Text style={styles.firstBusText}>Bus in {route.nextBusETA}m</Text>
            </View>
          )}
        </View>

        {/* ── From → To text ── */}
        <View style={styles.directFromTo}>
          <Ionicons name="location" size={12} color={Theme.accentGreen} />
          <Text style={styles.directFromToText} numberOfLines={1}>
            {route.fromStop?.name ?? '?'}
          </Text>
          <Ionicons name="arrow-forward" size={10} color={Theme.textMuted} />
          <Ionicons name="flag" size={12} color={Theme.accentRed} />
          <Text style={styles.directFromToText} numberOfLines={1}>
            {route.toStop?.name ?? '?'}
          </Text>
        </View>

        {/* ── Expandable intermediate stops ── */}
        {intermediateStops.length > 0 && (
          <Pressable
            onPress={() => setExpanded(!expanded)}
            style={styles.directExpandBtn}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Theme.textMuted}
            />
            <Text style={styles.directExpandText}>
              {expanded ? 'Hide' : 'Show'} {intermediateStops.length} intermediate stops
            </Text>
          </Pressable>
        )}

        {expanded && intermediateStops.length > 0 && (
          <View style={styles.directStopsList}>
            {intermediateStops.map((stop: string, sIdx: number) => (
              <View key={`stop-${sIdx}`} style={styles.directStopRow}>
                <View style={styles.directStopDot} />
                <Text style={styles.directStopName} numberOfLines={1}>
                  {stop}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Bottom: arrival time + fare ── */}
        <View style={styles.routeCardBottom}>
          <View style={styles.arrivalRow}>
            <Ionicons name="flag-outline" size={12} color={Theme.textMuted} />
            <Text style={styles.arrivalText}>
              Arrive by{' '}
              {route.arrivalTime
                ? new Date(route.arrivalTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : `~${etaMinutes}m`}
            </Text>
          </View>
          <View style={styles.fareRow}>
            <Ionicons name="cash-outline" size={11} color={Theme.textDim} />
            <Text style={styles.fareText}>Fare TBD</Text>
          </View>
        </View>

        {/* ── Start Journey button (shown when card is expanded) ── */}
        {isSelected && (
          <Pressable style={styles.trackBusBtn} onPress={onStartJourney}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={styles.trackBusBtnText}>Start Journey</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Route Card ──

function RouteCard({
  route,
  index,
  isSelected,
  onPress,
  onSeeLiveBuses,
}: {
  route: any;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  onSeeLiveBuses: () => void;
}) {
  const transfers = route.transfers ?? 0;
  const reliabilityScore = route.reliabilityScore ?? 50;
  const confidence = route.confidence ?? 0.7;
  const totalETA = route.totalETA ?? route.etaMinutes ?? 0;
  const legs = route.legs ?? [];

  // Calculate walking distance
  const walkMeters = legs
    .filter((l: any) => l.type === 'WALK')
    .reduce((sum: number, l: any) => sum + Math.round((l.distance ?? 0) * 1000), 0);

  // Route number badges
  const busLegs = legs.filter((l: any) => l.type === 'BUS');
  const routeNumbers = busLegs.map((l: any) => l.routeNumber ?? '---');

  const reliabilityLabel =
    reliabilityScore >= 80 ? 'HIGH' : reliabilityScore >= 50 ? 'MEDIUM' : 'LOW';
  const reliabilityColor = RELIABILITY_COLORS[reliabilityLabel];

  const confidenceLabel =
    confidence >= 0.8 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW';
  const confColor = CONFIDENCE_COLORS[confidenceLabel];

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        onPress={onPress}
        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
      >
        {/* ── Top row: Total time + Transfers + Intelligence ── */}
        <View style={styles.routeCardTop}>
          {/* Total time */}
          <View style={styles.routeTimeBadge}>
            <Ionicons name="time-outline" size={14} color={Theme.text} />
            <Text style={styles.routeTimeText}>{totalETA} min</Text>
          </View>

          {/* Transfer count */}
          {transfers > 0 && (
            <View style={styles.transferBadge}>
              <Ionicons
                name="swap-horizontal"
                size={11}
                color={Theme.textTertiary}
              />
              <Text style={styles.transferText}>
                {transfers} transfer{transfers > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Route number badges */}
          <View style={styles.routeBadgesRow}>
            {routeNumbers.map((num: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Ionicons
                    name="arrow-forward"
                    size={8}
                    color={Theme.textDim}
                  />
                )}
                <View style={styles.routeNumberBadge}>
                  <Text style={styles.routeNumberText}>{num}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Intelligence row ── */}
        <View style={styles.intelRow}>
          {/* Reliability dot */}
          <View style={styles.reliabilityMini}>
            <View
              style={[styles.reliabilityDot, { backgroundColor: reliabilityColor }]}
            />
            <Text
              style={[styles.reliabilityText, { color: reliabilityColor }]}
            >
              {reliabilityLabel}
            </Text>
          </View>

          {/* Confidence */}
          <ConfidenceDot confidence={confidence} showLabel />

          {/* Walking distance */}
          {walkMeters > 0 && (
            <View style={styles.walkBadge}>
              <Ionicons
                name="walk-outline"
                size={11}
                color={Theme.textTertiary}
              />
              <Text style={styles.walkText}>
                {walkMeters < 1000
                  ? `${walkMeters}m`
                  : `${(walkMeters / 1000).toFixed(1)}km`}
              </Text>
            </View>
          )}

          {/* First bus ETA */}
          {busLegs.length > 0 && busLegs[0].firstBusEta != null && (
            <View style={styles.firstBusBadge}>
              <Ionicons name="bus" size={10} color={Theme.accentGreen} />
              <Text style={styles.firstBusText}>
                Bus in {busLegs[0].firstBusEta}m
              </Text>
            </View>
          )}
        </View>

        {/* ── Legs Timeline ── */}
        <View style={styles.legsTimeline}>
          {legs.map((leg: any, lIdx: number) => (
            <View key={`leg-${lIdx}`} style={styles.legRow}>
              {/* Timeline connector */}
              <View style={styles.legConnector}>
                <View
                  style={[
                    styles.legDot,
                    leg.type === 'WALK' ? styles.legDotWalk : styles.legDotBus,
                  ]}
                />
                {lIdx < legs.length - 1 && (
                  <View
                    style={[
                      styles.legLine,
                      leg.type === 'WALK' && styles.legLineDashed,
                    ]}
                  />
                )}
              </View>

              {/* Leg content */}
              <View style={styles.legContent}>
                {leg.type === 'WALK' ? (
                  <View style={styles.legWalk}>
                    <Ionicons
                      name="walk-outline"
                      size={14}
                      color={Theme.textMuted}
                    />
                    <Text style={styles.legWalkText}>
                      Walk {leg.eta} min · {Math.round((leg.distance ?? 0) * 1000)}m
                    </Text>
                  </View>
                ) : (
                  <View style={styles.legBus}>
                    <View style={styles.legBusHeader}>
                      <View style={styles.legBusBadge}>
                        <Ionicons name="bus" size={12} color={Theme.text} />
                        <Text style={styles.legBusNumber}>
                          {leg.routeNumber ?? '---'}
                        </Text>
                      </View>
                      <Text style={styles.legBusEta}>{leg.eta} min</Text>
                    </View>
                    <Text style={styles.legBusInfo} numberOfLines={1}>
                      {leg.departureStop} → {leg.arrivalStop}
                    </Text>
                    <View style={styles.legBusMeta}>
                      <Text style={styles.metaText}>{leg.stops} stops</Text>
                      {leg.trafficLevel && (
                        <TrafficIndicator level={leg.trafficLevel} compact />
                      )}
                      {leg.liveTrackingAvailable && (
                        <View style={styles.liveBadge}>
                          <View style={styles.livePulse} />
                          <Text style={styles.liveText}>LIVE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* ── Bottom: arrival + fare ── */}
        <View style={styles.routeCardBottom}>
          <View style={styles.arrivalRow}>
            <Ionicons name="flag-outline" size={12} color={Theme.textMuted} />
            <Text style={styles.arrivalText}>
              Arrive by{' '}
              {route.arrivalTime
                ? new Date(route.arrivalTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : `${totalETA}m`}
            </Text>
          </View>
          <View style={styles.fareRow}>
            <Ionicons name="cash-outline" size={11} color={Theme.textDim} />
            <Text style={styles.fareText}>Fare TBD</Text>
          </View>
        </View>

        {/* ── See Live Buses button (shown when card is expanded) ── */}
        {isSelected && (
          <Pressable style={styles.trackBusBtn} onPress={onSeeLiveBuses}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={styles.trackBusBtnText}>See Live Buses for This Route</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Theme.font.xl,
    fontWeight: '700',
    color: Theme.text,
  },

  // ── From/To card ──
  inputCard: {
    marginHorizontal: 16,
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
  },
  inputCardOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  fieldsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  timeline: {
    width: 14,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: { backgroundColor: Theme.accentGreen },
  dotRed: { backgroundColor: Theme.accentRed },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Theme.textMuted + '40',
    marginVertical: 4,
  },
  fieldsColumn: {
    flex: 1,
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgInput,
    borderRadius: Theme.radiusSm,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldRowActive: {
    borderColor: Theme.accent + '30',
    backgroundColor: Theme.bgElevated,
  },
  fieldInput: {
    flex: 1,
    color: Theme.text,
    fontSize: Theme.font.md,
    height: 38,
    padding: 0,
    margin: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  clearBtn: { padding: 4 },
  swapBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Dropdown ──
  dropdown: {
    marginHorizontal: 16,
    backgroundColor: Theme.bgCard,
    borderBottomLeftRadius: Theme.radius,
    borderBottomRightRadius: Theme.radius,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Theme.border,
    overflow: 'hidden',
    ...Theme.shadow,
  } as any,
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.border,
  },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: Theme.accent + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: {
    flex: 1,
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '500',
  },

  // ── Sort controls ──
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 8,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.radiusFull,
    backgroundColor: Theme.bgCard,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  sortPillActive: {
    backgroundColor: Theme.text + '12',
    borderColor: Theme.text + '30',
  },
  sortPillText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
  sortPillTextActive: {
    color: Theme.text,
  },

  // ── Results ──
  resultsContainer: { flex: 1, marginTop: 14 },
  resultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  statusTitle: {
    color: Theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    color: Theme.textMuted,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── Route Card ──
  routeCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
    gap: 10,
  },
  routeCardSelected: {
    borderColor: Theme.accentBlue + '40',
    backgroundColor: Theme.accentBlue + '08',
  },

  // ── Direct Bus Card extras ──
  directRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.accentBlue + '20',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  directRouteNum: {
    color: Theme.accentBlue,
    fontSize: Theme.font.xl,
    fontWeight: '800',
  },
  directRouteName: {
    color: Theme.textSecondary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  directLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accentGreen + '15',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  directFromTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  directFromToText: {
    color: Theme.text,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  directExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  directExpandText: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  directStopsList: {
    paddingLeft: 8,
    gap: 4,
  },
  directStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directStopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.accent + '60',
  },
  directStopName: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },

  // ── Live Buses CTA ──
  liveBusesCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Theme.accentBlue + '10',
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.accentBlue + '25',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  liveBusesCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBusesCtaPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.accentGreen,
  },
  liveBusesCtaText: {
    fontSize: Theme.font.sm,
    fontWeight: '700',
    color: Theme.accentBlue,
  },

  trackBusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.accentBlue,
    borderRadius: Theme.radiusSm,
    paddingVertical: 12,
    marginTop: 10,
  },
  trackBusBtnText: {
    color: '#fff',
    fontSize: Theme.font.sm,
    fontWeight: '700',
  },

  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  routeTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accent + '12',
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routeTimeText: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '700',
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  transferText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  routeBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  routeNumberBadge: {
    backgroundColor: Theme.accentBlue + '18',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  routeNumberText: {
    color: Theme.accentBlue,
    fontSize: Theme.font.sm,
    fontWeight: '700',
  },

  // ── Intelligence row ──
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  reliabilityMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reliabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  reliabilityText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  walkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  walkText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  firstBusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.accentGreen + '12',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  firstBusText: {
    color: Theme.accentGreen,
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },

  // ── Legs Timeline ──
  legsTimeline: { gap: 0, paddingLeft: 2 },
  legRow: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 36,
  },
  legConnector: {
    width: 16,
    alignItems: 'center',
  },
  legDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  legDotWalk: {
    backgroundColor: Theme.textMuted,
    borderWidth: 2,
    borderColor: Theme.bgCard,
  },
  legDotBus: { backgroundColor: Theme.accent },
  legLine: {
    flex: 1,
    width: 2,
    backgroundColor: Theme.accent + '40',
    marginVertical: 2,
    minHeight: 8,
  },
  legLineDashed: { backgroundColor: Theme.textMuted + '30' },
  legContent: { flex: 1, paddingBottom: 8 },
  legWalk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legWalkText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  legBus: { gap: 3 },
  legBusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legBusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  legBusNumber: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  legBusEta: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
  legBusInfo: {
    color: Theme.textSecondary,
    fontSize: Theme.font.sm,
  },
  legBusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  livePulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Theme.accentGreen,
  },
  liveText: {
    color: Theme.accentGreen,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Bottom row ──
  routeCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.border,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrivalText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fareText: {
    color: Theme.textDim,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // ── Nearby Buses Fallback ──
  nearbySection: {
    gap: 8,
    paddingTop: 4,
  },
  nearbyBusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusMd,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
  },
  nearbyBusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  nearbyRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accentBlue + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nearbyRouteNum: {
    color: Theme.accentBlue,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  nearbyBusName: {
    color: Theme.textSecondary,
    fontSize: Theme.font.sm,
    flex: 1,
  },
  nearbyBusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyDistance: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
  nearbyOccupancy: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nearbyOccText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
