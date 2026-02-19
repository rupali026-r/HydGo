// ── Smart Suggestions Row ───────────────────────────────────────────────────
// Horizontal snap-scrolling row of top 3 bus suggestions.
// Each card shows: bus number, ETA, confidence %, occupancy bar, traffic, reason.

import React, { useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS, CONFIDENCE_COLORS, TRAFFIC_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { getSmartSuggestions } from '../utils/sort';
import { OccupancyBar } from './OccupancyBar';
import { SkeletonSuggestionRow } from './SkeletonLoader';
import type { BusState, SuggestionInfo } from '../types';

interface SmartSuggestionsRowProps {
  onBusPress: (busId: string) => void;
}

export function SmartSuggestionsRow({ onBusPress }: SmartSuggestionsRowProps) {
  const buses = usePassengerStore((s) => s.buses);
  const serverSuggestions = usePassengerStore((s) => s.suggestions);
  const isInitialLoad = usePassengerStore((s) => s.isInitialLoad);

  const suggestions = useMemo(() => {
    if (serverSuggestions.length > 0) {
      return serverSuggestions.map((s) => ({
        suggestion: s,
        bus: buses.get(s.busId),
      })).filter((x) => x.bus != null) as { suggestion: SuggestionInfo; bus: BusState }[];
    }

    const busArray = Array.from(buses.values());
    const smart = getSmartSuggestions(busArray, 3);
    return smart.map((bus) => ({
      suggestion: {
        busId: bus.id,
        score: 0,
        rank: 0,
        reason: bus.occupancy.level === 'LOW' ? 'Less crowded' : 'Nearest',
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

  if (isInitialLoad || (suggestions.length === 0 && buses.size === 0)) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.title}>Smart suggestions</Text>
        <SkeletonSuggestionRow />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bus-outline" size={20} color={Theme.textDim} />
        <Text style={styles.emptyText}>No buses nearby</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>
        {serverSuggestions.length > 0 ? 'Recommended for you' : 'Smart suggestions'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={156}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map(({ suggestion, bus }, index) => (
          <SuggestionCard
            key={suggestion.busId}
            suggestion={suggestion}
            bus={bus}
            index={index}
            onPress={() => onBusPress(suggestion.busId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Suggestion Card ──

interface SuggestionCardProps {
  suggestion: SuggestionInfo;
  bus: BusState;
  index: number;
  onPress: () => void;
}

function SuggestionCard({ suggestion, bus, index, onPress }: SuggestionCardProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(20);

  useEffect(() => {
    const delay = index * 80;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const confidenceColor = suggestion.confidence >= 0.8
    ? CONFIDENCE_COLORS.HIGH
    : suggestion.confidence >= 0.6
      ? CONFIDENCE_COLORS.MEDIUM
      : CONFIDENCE_COLORS.LOW;

  const trafficColor = bus.trafficLevel
    ? TRAFFIC_COLORS[bus.trafficLevel]
    : Theme.trafficLow;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} style={styles.card}>
        {/* Header: route number + confidence */}
        <View style={styles.cardHeader}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeNumber}>{suggestion.routeNumber ?? '—'}</Text>
          </View>
          <Text style={[styles.confidence, { color: confidenceColor }]}>
            {Math.round(suggestion.confidence * 100)}%
          </Text>
        </View>

        {/* ETA large */}
        <Text style={styles.etaLarge}>
          {suggestion.etaMinutes < 1 ? 'Now' : `${Math.round(suggestion.etaMinutes)} min`}
        </Text>

        {/* Traffic indicator */}
        {bus.trafficLevel && (
          <View style={styles.trafficRow}>
            <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
            <Text style={[styles.trafficLabel, { color: trafficColor }]}>
              {bus.trafficLevel === 'LOW' ? 'Smooth' : bus.trafficLevel === 'MODERATE' ? 'Moderate' : 'Heavy'}
            </Text>
          </View>
        )}

        {/* Occupancy bar */}
        <OccupancyBar
          level={bus.occupancy.level}
          percent={bus.occupancy.percent}
          showLabel={false}
          height={3}
        />

        {/* Reason tag */}
        <View style={styles.reasonTag}>
          <Text style={styles.reasonText}>{suggestion.reason}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  title: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingRight: 16,
    gap: 10,
  },
  card: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 14,
    width: 148,
    gap: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadowSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeBadge: {
    backgroundColor: Theme.bgElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeNumber: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  confidence: {
    fontSize: Theme.font.sm,
    fontWeight: '700',
  },
  etaLarge: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trafficDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  trafficLabel: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  reasonTag: {
    backgroundColor: Theme.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  reasonText: {
    color: Theme.textTertiary,
    fontSize: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    color: Theme.textDim,
    fontSize: Theme.font.md,
  },
});
