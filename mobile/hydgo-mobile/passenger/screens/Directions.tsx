// ── Directions Screen (Moovit-style) ────────────────────────────────────────
// From/To input with route suggestions and inline autocomplete.
// Reads params from TopSearchBar navigation to pre-fill fields.

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
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../lib/navigation';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { api } from '../../lib/api';
import { useAllStops } from '../hooks/useAllStops';
import type { StopInfo } from '../types';

const MAX_SUGGESTIONS = 8;

export default function Directions() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromName?: string; toStopId?: string; toStopName?: string }>();

  const userLocationName = usePassengerStore((s) => s.userLocationName);
  const nearbyStops = usePassengerStore((s) => s.nearbyStops);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const allStops = useAllStops();

  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [didInitialSearch, setDidInitialSearch] = useState(false);

  // ── Initialize from params or live location ─────────────────────────────
  useEffect(() => {
    const from = params.fromName || userLocationName || 'Current Location';
    setFromText(from);

    if (params.toStopName) {
      setToText(params.toStopName);
    }
  }, []);

  // ── Auto-search routes when arriving with both from/to pre-filled ───────
  useEffect(() => {
    if (!didInitialSearch && params.toStopName && fromText.length > 0 && allStops.length > 0) {
      setDidInitialSearch(true);
      findRoutes(fromText, params.toStopName);
    }
  }, [fromText, allStops, didInitialSearch, params.toStopName]);

  // ── Fuzzy search across ALL database stops ──────────────────────────────
  const filtered = useMemo<StopInfo[]>(() => {
    const query = activeField === 'from' ? fromText : toText;
    if (!query || query.trim().length < 1) {
      return allStops.slice(0, MAX_SUGGESTIONS);
    }
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    return allStops
      .filter((s) => words.every((w) => s.name.toLowerCase().includes(w)))
      .slice(0, MAX_SUGGESTIONS);
  }, [fromText, toText, activeField, allStops]);

  const showDropdown = activeField !== null && filtered.length > 0;

  // ── Select a stop from dropdown ─────────────────────────────────────────
  const handleStopSelect = useCallback(
    (stop: StopInfo) => {
      if (activeField === 'from') {
        setFromText(stop.name);
        setActiveField('to');
        setTimeout(() => toRef.current?.focus(), 100);
      } else {
        setToText(stop.name);
        setActiveField(null);
        Keyboard.dismiss();
        // Auto-search routes
        if (fromText.length > 0) {
          findRoutes(fromText, stop.name);
        }
      }
    },
    [activeField, fromText],
  );

  // ── Swap from ↔ to ─────────────────────────────────────────────────────
  const handleSwap = () => {
    const temp = fromText;
    setFromText(toText);
    setToText(temp);
    setActiveField(null);
    if (toText.length > 0 && fromText.length > 0) {
      findRoutes(toText, fromText);
    }
  };

  // ── Find routes via Transit Graph Engine ─────────────────────────────────
  const findRoutes = async (from: string, to: string) => {
    setRoutesLoading(true);
    setActiveField(null);
    try {
      // Look up coordinates for from/to stops
      const fromStop = allStops.find(
        (s) => s.name.toLowerCase() === from.toLowerCase(),
      ) ?? nearbyStops.find(
        (s) => s.name.toLowerCase() === from.toLowerCase(),
      );
      const toStop = allStops.find(
        (s) => s.name.toLowerCase() === to.toLowerCase(),
      ) ?? nearbyStops.find(
        (s) => s.name.toLowerCase() === to.toLowerCase(),
      );

      // Use stop coords, or user location for "from"
      const fromLat = fromStop?.latitude ?? userLocation?.latitude ?? 0;
      const fromLng = fromStop?.longitude ?? userLocation?.longitude ?? 0;
      const toLat = toStop?.latitude ?? 0;
      const toLng = toStop?.longitude ?? 0;

      if (toLat === 0 && toLng === 0) {
        setRoutes([]);
        setRoutesLoading(false);
        return;
      }

      // Call transit engine API
      const res = await api.get('/transit/route-plan', {
        params: { fromLat, fromLng, toLat, toLng },
      });

      const data = res.data;
      if (data?.routes && data.routes.length > 0) {
        setRoutes(data.routes);
      } else {
        setRoutes([]);
      }
    } catch {
      setRoutes([]);
    }
    setRoutesLoading(false);
  };

  // ── Render suggestion row ───────────────────────────────────────────────
  const renderSuggestion = useCallback(
    ({ item }: { item: StopInfo }) => (
      <Pressable
        style={styles.suggestionRow}
        onPress={() => handleStopSelect(item)}
      >
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={Theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Directions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* From/To Card */}
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
              style={[styles.fieldRow, activeField === 'from' && styles.fieldRowActive]}
              onPress={() => { setActiveField('from'); fromRef.current?.focus(); }}
            >
              <TextInput
                ref={fromRef}
                style={styles.fieldInput}
                value={fromText}
                onChangeText={(t) => { setFromText(t); setActiveField('from'); }}
                onFocus={() => setActiveField('from')}
                placeholder="Your location"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => { setActiveField('to'); toRef.current?.focus(); }}
              />
              {fromText.length > 0 && activeField === 'from' && (
                <Pressable onPress={() => setFromText('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
                </Pressable>
              )}
            </Pressable>

            <Pressable
              style={[styles.fieldRow, activeField === 'to' && styles.fieldRowActive]}
              onPress={() => { setActiveField('to'); toRef.current?.focus(); }}
            >
              <TextInput
                ref={toRef}
                style={styles.fieldInput}
                value={toText}
                onChangeText={(t) => { setToText(t); setActiveField('to'); }}
                onFocus={() => setActiveField('to')}
                placeholder="Where to?"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="search"
              />
              {toText.length > 0 && activeField === 'to' && (
                <Pressable onPress={() => setToText('')} hitSlop={8} style={styles.clearBtn}>
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

      {/* Autocomplete Dropdown */}
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

      {/* Route results */}
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

        {!routesLoading && routes.length === 0 && toText.length > 0 && fromText.length > 0 && !showDropdown && (
          <View style={styles.statusContainer}>
            <Ionicons name="navigate-outline" size={36} color={Theme.textMuted} />
            <Text style={styles.statusTitle}>No direct routes found</Text>
            <Text style={styles.statusText}>Try different stops or check nearby locations</Text>
          </View>
        )}

        {!routesLoading && routes.length === 0 && (toText.length === 0 || showDropdown) && (
          <View style={styles.statusContainer}>
            <Ionicons name="bus-outline" size={32} color={Theme.textMuted} />
            <Text style={styles.statusText}>Enter your destination to see available routes</Text>
          </View>
        )}

        {routes.map((route: any, rIdx: number) => (
          <Pressable
            key={`route-${rIdx}`}
            style={styles.routeCard}
            onPress={() => {
              // If there's a BUS leg, preview that route on map
              const busLeg = route.legs?.find((l: any) => l.type === 'BUS');
              if (busLeg?.routeId) {
                const store = usePassengerStore.getState();
                store.setPreviewRoute({
                  id: busLeg.routeId,
                  routeNumber: busLeg.routeNumber ?? '---',
                  name: route.legs.filter((l: any) => l.type === 'BUS').map((l: any) => l.routeNumber).join(' → '),
                  routeType: 'LOCAL',
                  polyline: '',
                  avgSpeed: 25,
                  distance: 0,
                  stops: [],
                });
                goBack(router);
              }
            }}
          >
            {/* Top row: total ETA + transfers + reliability */}
            <View style={styles.routeCardTop}>
              <View style={styles.routeEtaBadge}>
                <Ionicons name="time-outline" size={14} color={Theme.accent} />
                <Text style={styles.routeEtaText}>{route.totalETA} min</Text>
              </View>
              {route.transfers > 0 && (
                <View style={styles.transferBadge}>
                  <Ionicons name="swap-horizontal" size={11} color={Theme.textTertiary} />
                  <Text style={styles.transferBadgeText}>
                    {route.transfers} transfer{route.transfers > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              <View style={[
                styles.reliabilityDot,
                { backgroundColor: route.reliabilityScore >= 80 ? '#22C55E' : route.reliabilityScore >= 50 ? Theme.accent : '#EF4444' },
              ]} />
              <Text style={styles.confidenceText}>
                {Math.round((route.confidence ?? 0.8) * 100)}%
              </Text>
            </View>

            {/* Vertical Timeline Legs */}
            <View style={styles.legsTimeline}>
              {(route.legs ?? []).map((leg: any, lIdx: number) => (
                <View key={`leg-${lIdx}`} style={styles.legRow}>
                  {/* Timeline connector */}
                  <View style={styles.legConnector}>
                    <View style={[
                      styles.legDot,
                      leg.type === 'WALK'
                        ? styles.legDotWalk
                        : styles.legDotBus,
                    ]} />
                    {lIdx < (route.legs?.length ?? 0) - 1 && (
                      <View style={[
                        styles.legLine,
                        leg.type === 'WALK' ? styles.legLineDashed : null,
                      ]} />
                    )}
                  </View>

                  {/* Leg content */}
                  <View style={styles.legContent}>
                    {leg.type === 'WALK' ? (
                      <View style={styles.legWalk}>
                        <Ionicons name="walk-outline" size={14} color={Theme.textMuted} />
                        <Text style={styles.legWalkText}>
                          Walk {leg.eta} min · {Math.round(leg.distance * 1000)}m
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.legBus}>
                        <View style={styles.legBusBadge}>
                          <Ionicons name="bus" size={12} color={Theme.text} />
                          <Text style={styles.legBusNumber}>{leg.routeNumber ?? '---'}</Text>
                        </View>
                        <Text style={styles.legBusInfo} numberOfLines={1}>
                          {leg.departureStop} → {leg.arrivalStop}
                        </Text>
                        <View style={styles.legBusMeta}>
                          <Text style={styles.legBusEta}>{leg.eta} min</Text>
                          <Text style={styles.legBusDot}>·</Text>
                          <Text style={styles.legBusStops}>{leg.stops} stops</Text>
                          {leg.liveTrackingAvailable && (
                            <>
                              <Text style={styles.legBusDot}>·</Text>
                              <View style={styles.liveBadge}>
                                <View style={styles.livePulse} />
                                <Text style={styles.liveText}>LIVE</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Bottom: arrival time */}
            <View style={styles.routeCardBottom}>
              <Ionicons name="flag-outline" size={12} color={Theme.textMuted} />
              <Text style={styles.arrivalText}>
                Arrive by {new Date(route.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    fontSize: 18,
    fontWeight: '700',
    color: Theme.text,
  },

  // ── From/To card ──────────────────────────────────────────────────────
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
  dotGreen: {
    backgroundColor: '#22C55E',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
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
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  clearBtn: {
    padding: 4,
  },
  swapBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Dropdown ──────────────────────────────────────────────────────────
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
  },
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

  // ── Results ───────────────────────────────────────────────────────────
  resultsContainer: {
    flex: 1,
    marginTop: 16,
  },
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

  // ── Route Card (Timeline) ─────────────────────────────────────────────
  routeCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
    gap: 10,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeEtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accent + '15',
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  routeEtaText: {
    color: Theme.accent,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  transferBadgeText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  reliabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 'auto',
  },
  confidenceText: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },

  // ── Legs Timeline ─────────────────────────────────────────────────────
  legsTimeline: {
    gap: 0,
    paddingLeft: 2,
  },
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
  legDotBus: {
    backgroundColor: Theme.accent,
  },
  legLine: {
    flex: 1,
    width: 2,
    backgroundColor: Theme.accent + '40',
    marginVertical: 2,
    minHeight: 8,
  },
  legLineDashed: {
    backgroundColor: Theme.textMuted + '30',
  },
  legContent: {
    flex: 1,
    paddingBottom: 8,
  },
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
  legBus: {
    gap: 3,
  },
  legBusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  legBusNumber: {
    color: Theme.text,
    fontSize: Theme.font.sm,
    fontWeight: '700',
  },
  legBusInfo: {
    color: Theme.textSecondary,
    fontSize: Theme.font.sm,
  },
  legBusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legBusEta: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  legBusDot: {
    color: Theme.textDim,
    fontSize: 8,
  },
  legBusStops: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
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
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.border,
  },
  arrivalText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
});
