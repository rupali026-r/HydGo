// ── Smart Feed (Zepto-style) ────────────────────────────────────────────────
// "Next buses near you" — real-time feed updated via socket.
// Shows buses within 10 min, sorted by suggestion engine.
// Each item shows reason tags: Low occupancy, High reliability, Shortest ETA.

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS, CONFIDENCE_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { sortBySuggestion } from '../utils/sort';
import { OccupancyBar } from './OccupancyBar';
import { ReliabilityBadge } from './ReliabilityBadge';
import { ConfidenceDot } from './IntelligenceTooltip';
import type { BusState } from '../types';

interface SmartFeedProps {
  onBusPress: (busId: string) => void;
  maxItems?: number;
}

export function SmartFeed({ onBusPress, maxItems = 10 }: SmartFeedProps) {
  const buses = usePassengerStore((s) => s.buses);
  const suggestions = usePassengerStore((s) => s.suggestions);
  const nearestStop = usePassengerStore((s) => s.nearestStop);

  // Filter buses arriving within ~10 min, then sort by suggestion score
  const feedBuses = useMemo(() => {
    const all = Array.from(buses.values());

    // If we have server suggestions, use those first
    if (suggestions.length > 0) {
      const suggested = suggestions
        .map((s) => {
          const bus = buses.get(s.busId);
          if (!bus) return null;
          return { bus, reason: s.reason, score: s.score };
        })
        .filter(Boolean) as { bus: BusState; reason: string; score: number }[];

      // Add remaining buses not in suggestions
      const suggestedIds = new Set(suggestions.map((s) => s.busId));
      const remaining = all
        .filter((b) => !suggestedIds.has(b.id))
        .filter((b) => (b.eta?.estimatedMinutes ?? 99) <= 15);

      const sorted = sortBySuggestion(remaining);
      const rest = sorted.map((bus) => ({
        bus,
        reason: getAutoReason(bus),
        score: 0,
      }));

      return [...suggested, ...rest].slice(0, maxItems);
    }

    // Client-side fallback
    const nearby = all.filter((b) => (b.eta?.estimatedMinutes ?? 99) <= 15);
    const sorted = sortBySuggestion(nearby);
    return sorted.slice(0, maxItems).map((bus) => ({
      bus,
      reason: getAutoReason(bus),
      score: 0,
    }));
  }, [buses, suggestions, maxItems]);

  if (feedBuses.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flash-outline" size={14} color={Theme.accentAmber} />
          <Text style={styles.headerTitle}>Next buses near you</Text>
        </View>
        {nearestStop && (
          <Text style={styles.headerStop} numberOfLines={1}>
            Near {nearestStop.name}
          </Text>
        )}
      </View>

      {feedBuses.map(({ bus, reason }, index) => (
        <FeedCard
          key={bus.id}
          bus={bus}
          reason={reason}
          index={index}
          onPress={() => onBusPress(bus.id)}
        />
      ))}
    </View>
  );
}

// ── Feed Card ──

interface FeedCardProps {
  bus: BusState;
  reason: string;
  index: number;
  onPress: () => void;
}

function FeedCard({ bus, reason, index, onPress }: FeedCardProps) {
  const occColor = OCCUPANCY_COLORS[bus.occupancy.level];
  const trafficColor =
    bus.trafficLevel === 'LOW'
      ? Theme.trafficLow
      : bus.trafficLevel === 'MODERATE'
        ? Theme.trafficModerate
        : bus.trafficLevel === 'HIGH'
          ? Theme.trafficHigh
          : Theme.trafficLow;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable onPress={onPress} style={styles.card}>
        {/* Left: route badge */}
        <View style={styles.cardLeft}>
          <View style={[styles.routeBadge, { borderColor: occColor }]}>
            <Text style={styles.routeNumber}>
              {bus.routeNumber ?? '---'}
            </Text>
          </View>
        </View>

        {/* Middle: info */}
        <View style={styles.cardMiddle}>
          <Text style={styles.routeName} numberOfLines={1}>
            {bus.routeName ?? 'Unknown Route'}
          </Text>

          {/* Intelligence chips */}
          <View style={styles.chipsRow}>
            <ConfidenceDot confidence={bus.confidence ?? 0.7} size={6} />

            <View style={[styles.chip, { backgroundColor: occColor + '15' }]}>
              <View style={[styles.chipDot, { backgroundColor: occColor }]} />
              <Text style={[styles.chipText, { color: occColor }]}>
                {bus.occupancy.percent}%
              </Text>
            </View>

            {bus.trafficLevel && (
              <View
                style={[styles.chip, { backgroundColor: trafficColor + '15' }]}
              >
                <View
                  style={[styles.chipDot, { backgroundColor: trafficColor }]}
                />
                <Text style={[styles.chipText, { color: trafficColor }]}>
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

          {/* Reason tag */}
          <View style={styles.reasonRow}>
            <Ionicons
              name="sparkles"
              size={9}
              color={Theme.accentAmber}
            />
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        </View>

        {/* Right: ETA */}
        <View style={styles.cardRight}>
          <Text style={styles.etaValue}>
            {(bus.eta?.estimatedMinutes ?? 0) < 1
              ? 'Now'
              : `${Math.round(bus.eta?.estimatedMinutes ?? 0)}`}
          </Text>
          <Text style={styles.etaUnit}>
            {(bus.eta?.estimatedMinutes ?? 0) < 1 ? '' : 'min'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Auto-reason generator ──

function getAutoReason(bus: BusState): string {
  const reasons: string[] = [];

  if (bus.occupancy.level === 'LOW') reasons.push('Low occupancy');
  if (bus.reliability?.label === 'HIGH') reasons.push('High reliability');
  if ((bus.eta?.estimatedMinutes ?? 99) <= 3) reasons.push('Arriving soon');
  if (bus.trafficLevel === 'LOW') reasons.push('Smooth traffic');

  if (reasons.length === 0) reasons.push('Shortest ETA');

  return reasons.slice(0, 2).join(' · ');
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerStop: {
    color: Theme.textDim,
    fontSize: Theme.font.xs,
    flex: 1,
    textAlign: 'right',
  },

  // ── Feed Card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cardLeft: {},
  routeBadge: {
    borderWidth: 2,
    borderRadius: Theme.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  routeNumber: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardMiddle: {
    flex: 1,
    gap: 4,
  },
  routeName: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chipText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reasonText: {
    color: Theme.textDim,
    fontSize: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardRight: {
    alignItems: 'center',
    minWidth: 40,
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
  },
});
