// ── Route Breakdown ─────────────────────────────────────────────────────────
// Expandable timeline view for a multi-leg transit route.
// Shows WALK segments, BUS segments, transfer markers, total time.
// Used in Bottom Sheet suggestion cards and Directions 2.0.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, TRAFFIC_COLORS } from '../../constants/theme';
import type { TrafficLevel } from '../types';

// ── Types ──

export interface RouteLeg {
  type: 'WALK' | 'BUS';
  routeNumber?: string;
  routeName?: string;
  fromStop: string;
  toStop: string;
  durationMinutes: number;
  distanceMeters: number;
  stops?: number;
  trafficLevel?: TrafficLevel;
}

interface RouteBreakdownProps {
  legs: RouteLeg[];
  totalMinutes: number;
  arrivalTime?: string;
  defaultExpanded?: boolean;
}

export function RouteBreakdown({
  legs,
  totalMinutes,
  arrivalTime,
  defaultExpanded = false,
}: RouteBreakdownProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const height = useSharedValue(defaultExpanded ? 1 : 0);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    height.value = withTiming(next ? 1 : 0, {
      duration: Theme.anim.normal,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded]);

  const contentStyle = useAnimatedStyle(() => ({
    maxHeight: height.value * 600,
    opacity: height.value,
    overflow: 'hidden' as const,
  }));

  // Build compact summary
  const busCounts = legs.filter((l) => l.type === 'BUS').length;
  const walkLegs = legs.filter((l) => l.type === 'WALK');
  const totalWalkMeters = walkLegs.reduce((s, l) => s + l.distanceMeters, 0);

  return (
    <View style={styles.container}>
      {/* Toggle header */}
      <Pressable onPress={toggle} style={styles.toggleRow}>
        <View style={styles.summaryRow}>
          {legs.map((leg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.legDivider} />}
              <View
                style={[
                  styles.legPill,
                  {
                    backgroundColor:
                      leg.type === 'WALK' ? Theme.bgElevated : Theme.accentBlue + '18',
                  },
                ]}
              >
                <Ionicons
                  name={leg.type === 'WALK' ? 'walk-outline' : 'bus'}
                  size={11}
                  color={leg.type === 'WALK' ? Theme.textTertiary : Theme.accentBlue}
                />
                <Text
                  style={[
                    styles.legPillText,
                    {
                      color:
                        leg.type === 'WALK' ? Theme.textTertiary : Theme.accentBlue,
                    },
                  ]}
                >
                  {leg.type === 'WALK'
                    ? `${Math.round(leg.durationMinutes)}m`
                    : leg.routeNumber ?? 'Bus'}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Theme.textMuted}
        />
      </Pressable>

      {/* Expanded timeline */}
      <Animated.View style={contentStyle}>
        <View style={styles.timeline}>
          {legs.map((leg, i) => (
            <TimelineLeg key={i} leg={leg} isLast={i === legs.length - 1} />
          ))}

          {/* Total row */}
          <View style={styles.totalRow}>
            <View style={styles.totalDot}>
              <Ionicons name="flag" size={10} color={Theme.accentGreen} />
            </View>
            <View style={styles.totalContent}>
              <Text style={styles.totalLabel}>Total journey</Text>
              <View style={styles.totalStats}>
                <Text style={styles.totalTime}>{totalMinutes} min</Text>
                {totalWalkMeters > 0 && (
                  <Text style={styles.totalWalk}>
                    {totalWalkMeters < 1000
                      ? `${totalWalkMeters}m walk`
                      : `${(totalWalkMeters / 1000).toFixed(1)}km walk`}
                  </Text>
                )}
                {arrivalTime && (
                  <Text style={styles.arrivalTime}>Arrive {arrivalTime}</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Timeline Leg ──

function TimelineLeg({ leg, isLast }: { leg: RouteLeg; isLast: boolean }) {
  const isWalk = leg.type === 'WALK';
  const lineColor = isWalk ? Theme.textDim : Theme.accentBlue;
  const trafficColor = leg.trafficLevel ? TRAFFIC_COLORS[leg.trafficLevel] : undefined;

  return (
    <View style={styles.legRow}>
      {/* Timeline column */}
      <View style={styles.timelineCol}>
        <View style={[styles.timelineDot, { borderColor: lineColor }]}>
          <Ionicons
            name={isWalk ? 'walk' : 'bus'}
            size={10}
            color={lineColor}
          />
        </View>
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: lineColor + '40' }]} />}
      </View>

      {/* Content */}
      <View style={styles.legContent}>
        <View style={styles.legHeader}>
          {isWalk ? (
            <Text style={styles.legTitle}>Walk</Text>
          ) : (
            <View style={styles.busTag}>
              <Text style={styles.busTagNumber}>{leg.routeNumber}</Text>
            </View>
          )}
          <Text style={styles.legDuration}>{Math.round(leg.durationMinutes)} min</Text>
        </View>

        <Text style={styles.legRoute} numberOfLines={1}>
          {leg.fromStop} → {leg.toStop}
        </Text>

        <View style={styles.legMeta}>
          {leg.distanceMeters > 0 && (
            <Text style={styles.metaText}>
              {leg.distanceMeters < 1000
                ? `${leg.distanceMeters}m`
                : `${(leg.distanceMeters / 1000).toFixed(1)}km`}
            </Text>
          )}
          {leg.stops != null && leg.stops > 0 && (
            <Text style={styles.metaText}>{leg.stops} stops</Text>
          )}
          {trafficColor && (
            <View style={styles.trafficMini}>
              <View style={[styles.trafficMiniDot, { backgroundColor: trafficColor }]} />
              <Text style={[styles.metaText, { color: trafficColor }]}>
                {leg.trafficLevel === 'LOW'
                  ? 'Smooth'
                  : leg.trafficLevel === 'MODERATE'
                    ? 'Moderate'
                    : 'Heavy'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexWrap: 'wrap',
  },
  legDivider: {
    width: 8,
    height: 1,
    backgroundColor: Theme.textDim,
  },
  legPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  legPillText: {
    fontSize: Theme.font.xs,
    fontWeight: '700',
  },
  timeline: {
    paddingLeft: 4,
    paddingTop: 8,
    gap: 2,
  },
  legRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
  },
  timelineCol: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.bg,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  legContent: {
    flex: 1,
    paddingBottom: 16,
    gap: 4,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legTitle: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    fontWeight: '600',
  },
  busTag: {
    backgroundColor: Theme.accentBlue + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  busTagNumber: {
    color: Theme.accentBlue,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  legDuration: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
  legRoute: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
  },
  legMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  metaText: {
    color: Theme.textDim,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  trafficMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trafficMiniDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  totalRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
  },
  totalDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Theme.accentGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalContent: {
    flex: 1,
    gap: 4,
  },
  totalLabel: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  totalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalTime: {
    color: Theme.accentGreen,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  totalWalk: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
  },
  arrivalTime: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
});
