// ── Premium Bottom Sheet 2.0 ────────────────────────────────────────────────
// Zepto-style bottom sheet with spring physics.
// Collapsed: next arriving bus, live ETA countdown, reliability badge.
// Expanded (70%): stop info, smart suggestions, all buses feed.
// Uses Reanimated + GestureDetector. No lag transitions.

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS, CONFIDENCE_COLORS, RELIABILITY_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { sortBySuggestion, getSmartSuggestions } from '../utils/sort';
import { formatDistance } from '../utils/geo';
import { BusCard } from './BusCard';
import { OccupancyBar } from './OccupancyBar';
import { ReliabilityBadge } from './ReliabilityBadge';
import { TrafficIndicator } from './TrafficIndicator';
import { ConfidenceDot, IntelligenceTooltip } from './IntelligenceTooltip';
import { SkeletonSuggestionRow } from './SkeletonLoader';
import type { BusState, SuggestionInfo } from '../types';

const COLLAPSED_HEIGHT = 230;
const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.7 };

interface PremiumBottomSheetProps {
  onBusPress: (busId: string) => void;
  onStopPress?: () => void;
}

export function PremiumBottomSheet({ onBusPress, onStopPress }: PremiumBottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const EXPANDED_HEIGHT = screenHeight * 0.72;

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const sheetExpanded = usePassengerStore((s) => s.sheetExpanded);
  const setSheetExpanded = usePassengerStore((s) => s.setSheetExpanded);
  const buses = usePassengerStore((s) => s.buses);
  const activeJourney = usePassengerStore((s) => s.activeJourney);
  const nearestStop = usePassengerStore((s) => s.nearestStop);
  const nearestStopDistance = usePassengerStore((s) => s.nearestStopDistance);
  const nearestStopReliability = usePassengerStore((s) => s.nearestStopReliability);
  const serverSuggestions = usePassengerStore((s) => s.suggestions);
  const isInitialLoad = usePassengerStore((s) => s.isInitialLoad);
  const userLocation = usePassengerStore((s) => s.userLocation);

  // ── Sorted buses ──
  const allBuses = useMemo(() => {
    const arr = Array.from(buses.values());
    return sortBySuggestion(arr);
  }, [buses]);

  // ── Smart suggestions (server-first, client fallback) ──
  const suggestions = useMemo(() => {
    if (serverSuggestions.length > 0) {
      return serverSuggestions
        .map((s) => ({ suggestion: s, bus: buses.get(s.busId) }))
        .filter((x) => x.bus != null) as { suggestion: SuggestionInfo; bus: BusState }[];
    }
    const smart = getSmartSuggestions(Array.from(buses.values()), 3);
    return smart.map((bus) => ({
      suggestion: {
        busId: bus.id,
        score: 0,
        rank: 0,
        reason:
          bus.occupancy.level === 'LOW'
            ? 'Low occupancy'
            : bus.reliability?.label === 'HIGH'
              ? 'High reliability'
              : 'Shortest ETA',
        routeNumber: bus.routeNumber,
        routeName: bus.routeName,
        etaMinutes: bus.eta?.estimatedMinutes ?? 0,
        distanceMeters: bus.distanceMeters ?? 0,
        occupancyPercent: bus.occupancy.percent,
        confidence: bus.confidence ?? 0.7,
      } as SuggestionInfo,
      bus,
    }));
  }, [buses, serverSuggestions]);

  // ── Next arriving bus for collapsed view ──
  const nextBus = useMemo(() => {
    if (suggestions.length > 0) return suggestions[0];
    if (allBuses.length > 0) {
      const bus = allBuses[0];
      return {
        suggestion: {
          busId: bus.id,
          score: 0,
          rank: 0,
          reason: 'Nearest',
          etaMinutes: bus.eta?.estimatedMinutes ?? 0,
          routeNumber: bus.routeNumber,
          confidence: bus.confidence ?? 0.7,
          occupancyPercent: bus.occupancy.percent,
          distanceMeters: bus.distanceMeters ?? 0,
        } as SuggestionInfo,
        bus,
      };
    }
    return null;
  }, [suggestions, allBuses]);

  // ── Live ETA countdown ──
  const [etaSeconds, setEtaSeconds] = useState(0);
  useEffect(() => {
    const eta = nextBus?.bus.eta?.estimatedMinutes;
    if (eta == null) return;
    setEtaSeconds(Math.round(eta * 60));
    const interval = setInterval(() => {
      setEtaSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextBus?.bus.eta?.estimatedMinutes]);

  const etaMinDisplay = Math.floor(etaSeconds / 60);
  const etaSecDisplay = etaSeconds % 60;

  // ── Gesture handling ──
  const expand = useCallback(() => setSheetExpanded(true), [setSheetExpanded]);
  const collapse = useCallback(() => setSheetExpanded(false), [setSheetExpanded]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((e) => {
      const newY = context.value.y + e.translationY;
      const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      translateY.value = Math.max(-diff, Math.min(0, newY));
    })
    .onEnd((e) => {
      const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      const threshold = diff * 0.3;
      if (e.velocityY < -500 || translateY.value < -threshold) {
        translateY.value = withSpring(-diff, SPRING_CONFIG);
        runOnJS(expand)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(collapse)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: EXPANDED_HEIGHT,
  }));

  // ── Expand indicator animation ──
  const indicatorStyle = useAnimatedStyle(() => {
    const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
    const rotation = interpolate(
      translateY.value,
      [0, -diff],
      [0, 180],
      Extrapolation.CLAMP,
    );
    return { transform: [{ rotateZ: `${rotation}deg` }] };
  });

  const handleToggle = useCallback(() => {
    const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
    if (sheetExpanded) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      setSheetExpanded(false);
    } else {
      translateY.value = withSpring(-diff, SPRING_CONFIG);
      setSheetExpanded(true);
    }
  }, [sheetExpanded, EXPANDED_HEIGHT, setSheetExpanded]);

  // Hide during journey
  if (activeJourney) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.sheet,
          animatedStyle,
          { bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) },
        ]}
      >
        {/* ── Drag handle ── */}
        <Pressable onPress={handleToggle} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>

        {/* ── Collapsed: Next arriving bus ── */}
        <View style={styles.collapsedContent}>
          {/* Nearest stop info */}
          {nearestStop ? (
            <Pressable onPress={onStopPress} style={styles.stopRow}>
              <View style={styles.stopIcon}>
                <Ionicons name="location" size={14} color={Theme.accentBlue} />
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopName} numberOfLines={1}>
                  {nearestStop.name}
                </Text>
                {nearestStopDistance != null && (
                  <Text style={styles.stopDistance}>
                    {formatDistance(nearestStopDistance)}
                  </Text>
                )}
              </View>
              {nearestStopReliability && (
                <ReliabilityBadge
                  label={nearestStopReliability as any}
                  compact
                />
              )}
            </Pressable>
          ) : (
            <View style={styles.stopSkeleton}>
              <View style={styles.skeletonBar} />
            </View>
          )}

          {/* Next bus card */}
          {nextBus ? (
            <Pressable
              onPress={() => onBusPress(nextBus.bus.id)}
              style={styles.nextBusCard}
            >
              <View style={styles.nextBusLeft}>
                <View style={styles.routeBadge}>
                  <Ionicons name="bus" size={14} color={Theme.text} />
                  <Text style={styles.routeBadgeText}>
                    {nextBus.suggestion.routeNumber ?? '---'}
                  </Text>
                </View>
                <Text style={styles.nextBusRoute} numberOfLines={1}>
                  {nextBus.bus.routeName ?? 'Loading...'}
                </Text>
              </View>

              {/* Live ETA countdown */}
              <View style={styles.etaCountdown}>
                <Text style={styles.etaValue}>
                  {etaSeconds <= 60 ? 'Now' : `${etaMinDisplay}:${etaSecDisplay.toString().padStart(2, '0')}`}
                </Text>
                <Text style={styles.etaUnit}>
                  {etaSeconds <= 60 ? 'Arriving' : 'min'}
                </Text>
              </View>
            </Pressable>
          ) : isInitialLoad ? (
            <SkeletonSuggestionRow />
          ) : (
            <View style={styles.emptyCollapsed}>
              <Ionicons name="bus-outline" size={18} color={Theme.textDim} />
              <Text style={styles.emptyText}>No buses nearby</Text>
            </View>
          )}

          {/* Expand indicator */}
          <Pressable onPress={handleToggle} style={styles.expandIndicator}>
            <Animated.View style={indicatorStyle}>
              <Ionicons name="chevron-up" size={18} color={Theme.textMuted} />
            </Animated.View>
            <Text style={styles.expandHint}>
              {allBuses.length > 0
                ? `${allBuses.length} buses nearby`
                : 'Pull up for more'}
            </Text>
          </Pressable>
        </View>

        {/* ── Expanded content ── */}
        {sheetExpanded && (
          <ScrollView
            style={styles.expandedScroll}
            contentContainerStyle={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Stop header */}
            {nearestStop && (
              <View style={styles.expandedStopHeader}>
                <View>
                  <Text style={styles.expandedStopName}>{nearestStop.name}</Text>
                  {nearestStopDistance != null && (
                    <Text style={styles.expandedStopDistance}>
                      {formatDistance(nearestStopDistance)} from you
                    </Text>
                  )}
                </View>
                <Text style={styles.busSummary}>
                  {suggestions.length > 0
                    ? `${suggestions.length} buses arriving in next 10 min`
                    : `${allBuses.length} buses tracked`}
                </Text>
              </View>
            )}

            {/* Smart suggestions (top 3 ranked) */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles-outline" size={14} color={Theme.accentAmber} />
                  <Text style={styles.sectionTitle}>Smart suggestions</Text>
                  <IntelligenceTooltip />
                </View>

                {suggestions.map(({ suggestion, bus }, i) => (
                  <SuggestionCard
                    key={suggestion.busId}
                    suggestion={suggestion}
                    bus={bus}
                    rank={i + 1}
                    onPress={() => onBusPress(suggestion.busId)}
                  />
                ))}
              </View>
            )}

            {/* All buses feed */}
            <View style={styles.sectionHeader}>
              <Ionicons name="bus-outline" size={14} color={Theme.textTertiary} />
              <Text style={styles.sectionTitle}>
                All nearby buses ({allBuses.length})
              </Text>
            </View>

            {allBuses.map((bus) => (
              <BusCard key={bus.id} bus={bus} onPress={onBusPress} />
            ))}

            {allBuses.length === 0 && (
              <View style={styles.emptyExpanded}>
                <Ionicons name="search-outline" size={32} color={Theme.textDim} />
                <Text style={styles.emptyTitle}>No buses in range</Text>
                <Text style={styles.emptySubtext}>
                  Buses will appear when they enter your area
                </Text>
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ── Suggestion Card ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: SuggestionInfo;
  bus: BusState;
  rank: number;
  onPress: () => void;
}

function SuggestionCard({ suggestion, bus, rank, onPress }: SuggestionCardProps) {
  const occColor = OCCUPANCY_COLORS[bus.occupancy.level];
  const confLabel =
    suggestion.confidence >= 0.8
      ? 'HIGH'
      : suggestion.confidence >= 0.6
        ? 'MEDIUM'
        : 'LOW';
  const confColor = CONFIDENCE_COLORS[confLabel];
  const trafficColor = bus.trafficLevel
    ? (bus.trafficLevel === 'LOW' ? Theme.trafficLow : bus.trafficLevel === 'MODERATE' ? Theme.trafficModerate : Theme.trafficHigh)
    : Theme.trafficLow;

  return (
    <Pressable onPress={onPress} style={styles.suggCard}>
      <View style={styles.suggCardTop}>
        {/* Route badge */}
        <View style={styles.suggRouteBadge}>
          <Ionicons name="bus" size={12} color={Theme.text} />
          <Text style={styles.suggRouteNumber}>
            {suggestion.routeNumber ?? '---'}
          </Text>
        </View>

        {/* Best choice tag */}
        {rank === 1 && (
          <View style={styles.bestChoiceTag}>
            <Text style={styles.bestChoiceText}>Best Choice</Text>
          </View>
        )}

        {/* ETA */}
        <Text style={styles.suggEta}>
          {suggestion.etaMinutes < 1
            ? 'Now'
            : `${Math.round(suggestion.etaMinutes)} min`}
        </Text>
      </View>

      {/* Intelligence row */}
      <View style={styles.suggIntelRow}>
        <ConfidenceDot confidence={suggestion.confidence} showLabel />

        <View style={styles.suggOccBadge}>
          <View
            style={[styles.suggOccDot, { backgroundColor: occColor }]}
          />
          <Text style={[styles.suggOccText, { color: occColor }]}>
            {suggestion.occupancyPercent}%
          </Text>
        </View>

        {bus.trafficLevel && (
          <View style={styles.suggTrafficBadge}>
            <View
              style={[styles.suggTrafficDot, { backgroundColor: trafficColor }]}
            />
            <Text style={[styles.suggTrafficText, { color: trafficColor }]}>
              {bus.trafficLevel === 'LOW'
                ? 'Smooth'
                : bus.trafficLevel === 'MODERATE'
                  ? 'Moderate'
                  : 'Heavy'}
            </Text>
          </View>
        )}

        {bus.reliability && (
          <ReliabilityBadge label={bus.reliability.label} compact />
        )}
      </View>

      {/* Reason */}
      <Text style={styles.suggReason}>{suggestion.reason}</Text>
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Theme.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: Theme.borderGlass,
    zIndex: 100,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center' as any,
        width: '100%',
      },
    }),
  } as any,
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.borderSubtle,
  },

  // ── Collapsed ──
  collapsedContent: {
    paddingHorizontal: Theme.space.lg,
    gap: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.accentBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '700',
  },
  stopDistance: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
  },
  stopSkeleton: {
    height: 28,
    justifyContent: 'center',
  },
  skeletonBar: {
    height: 14,
    width: 160,
    borderRadius: 4,
    backgroundColor: Theme.bgElevated,
  },

  // ── Next bus card ──
  nextBusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.border,
    gap: 12,
  },
  nextBusLeft: {
    flex: 1,
    gap: 4,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  routeBadgeText: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  nextBusRoute: {
    color: Theme.textSecondary,
    fontSize: Theme.font.sm,
  },
  etaCountdown: {
    alignItems: 'center',
    minWidth: 56,
  },
  etaValue: {
    color: Theme.text,
    fontSize: Theme.font.xxl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  etaUnit: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // ── Expand indicator ──
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  expandHint: {
    color: Theme.textDim,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },

  // ── Expanded ──
  expandedScroll: {
    flex: 1,
  },
  expandedContent: {
    paddingHorizontal: Theme.space.lg,
    paddingTop: Theme.space.md,
    gap: Theme.space.md,
  },
  expandedStopHeader: {
    gap: 6,
    paddingBottom: 4,
  },
  expandedStopName: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  expandedStopDistance: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
  },
  busSummary: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── Suggestions section ──
  suggestionsSection: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },

  // ── Suggestion card ──
  suggCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  suggCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  suggRouteNumber: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  bestChoiceTag: {
    backgroundColor: Theme.accentGreen + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestChoiceText: {
    color: Theme.accentGreen,
    fontSize: Theme.font.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  suggEta: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  suggIntelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  suggOccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggOccDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  suggOccText: {
    fontSize: Theme.font.xs,
    fontWeight: '700',
  },
  suggTrafficBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggTrafficDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  suggTrafficText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  suggReason: {
    color: Theme.textDim,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // ── Empty states ──
  emptyCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    color: Theme.textDim,
    fontSize: Theme.font.md,
  },
  emptyExpanded: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    color: Theme.textMuted,
    fontSize: Theme.font.lg,
    fontWeight: '500',
  },
  emptySubtext: {
    color: Theme.textDim,
    fontSize: Theme.font.md,
  },
});
