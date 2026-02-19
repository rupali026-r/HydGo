// ── Journey Panel ───────────────────────────────────────────────────────────
// Live journey tracking panel. Shows when user taps "Start Journey".
// Includes: ETA countdown, bus distance, next stop, destination ETA,
// occupancy trend, traffic level, cancel button.
// Slide-in from bottom with spring animation.

import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, TRAFFIC_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { AnimatedETA } from './AnimatedETA';
import { TrafficIndicator } from './TrafficIndicator';
import { formatDistance } from '../utils/geo';

const SPRING_CONFIG = { damping: 18, stiffness: 160, mass: 0.8 };

interface JourneyPanelProps {
  onCancel: () => void;
}

export function JourneyPanel({ onCancel }: JourneyPanelProps) {
  const activeJourney = usePassengerStore((s) => s.activeJourney);

  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (activeJourney) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(400, SPRING_CONFIG);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [!!activeJourney]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!activeJourney) return null;

  const statusLabel =
    activeJourney.status === 'waiting'
      ? 'Waiting for bus'
      : activeJourney.status === 'boarding'
        ? 'Bus arriving!'
        : activeJourney.status === 'onboard'
          ? 'On board'
          : 'Tracking';

  const statusColor =
    activeJourney.status === 'boarding'
      ? Theme.trafficLow
      : activeJourney.status === 'onboard'
        ? Theme.accentBlue
        : Theme.text;

  const trendIcon =
    activeJourney.occupancyTrend === 'rising'
      ? 'trending-up'
      : activeJourney.occupancyTrend === 'falling'
        ? 'trending-down'
        : 'remove';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.panel}>
        {/* Status header */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.routeChip}>{activeJourney.routeNumber}</Text>
        </View>

        {/* ETA + Distance */}
        <View style={styles.mainRow}>
          <View style={styles.etaBlock}>
            <AnimatedETA minutes={activeJourney.etaMinutes} />
            <Text style={styles.etaLabel}>Bus ETA</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.distBlock}>
            <Text style={styles.distValue}>
              {formatDistance(activeJourney.busDistanceMeters)}
            </Text>
            <Text style={styles.distLabel}>Distance</Text>
          </View>

          {activeJourney.destinationEtaMinutes != null && (
            <>
              <View style={styles.divider} />
              <View style={styles.destBlock}>
                <Text style={styles.destValue}>
                  {activeJourney.destinationEtaMinutes} min
                </Text>
                <Text style={styles.destLabel}>To dest.</Text>
              </View>
            </>
          )}
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          {activeJourney.nextStopName && (
            <View style={styles.nextStop}>
              <Ionicons name="flag-outline" size={12} color={Theme.textTertiary} />
              <Text style={styles.nextStopText}>Next: {activeJourney.nextStopName}</Text>
            </View>
          )}

          {activeJourney.trafficLevel && (
            <TrafficIndicator level={activeJourney.trafficLevel} compact />
          )}

          {activeJourney.occupancyTrend && (
            <View style={styles.trendBadge}>
              <Ionicons name={trendIcon as any} size={12} color={Theme.textTertiary} />
              <Text style={styles.trendText}>
                {activeJourney.occupancyTrend === 'rising'
                  ? 'Filling up'
                  : activeJourney.occupancyTrend === 'falling'
                    ? 'Emptying'
                    : 'Stable'}
              </Text>
            </View>
          )}
        </View>

        {/* From → To */}
        <View style={styles.routeRow}>
          <View style={styles.stopDot} />
          <Text style={styles.fromText} numberOfLines={1}>
            {activeJourney.fromStop.name}
          </Text>
          {activeJourney.toStop && (
            <>
              <Ionicons name="arrow-forward" size={14} color={Theme.textMuted} />
              <Text style={styles.toText} numberOfLines={1}>
                {activeJourney.toStop.name}
              </Text>
            </>
          )}
        </View>

        {/* Cancel button */}
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Ionicons name="close-circle-outline" size={18} color={Theme.trafficHigh} />
          <Text style={styles.cancelText}>Cancel Journey</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 250,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center' as any,
        width: '100%',
      },
    }),
  },
  panel: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadow,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: Theme.font.md,
    fontWeight: '600',
    flex: 1,
  },
  routeChip: {
    color: Theme.text,
    fontSize: Theme.font.sm,
    fontWeight: '700',
    backgroundColor: Theme.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  etaBlock: {
    flex: 1,
    alignItems: 'center',
  },
  etaLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Theme.border,
  },
  distBlock: {
    flex: 1,
    alignItems: 'center',
  },
  distValue: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  distLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  destBlock: {
    flex: 1,
    alignItems: 'center',
  },
  destValue: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  destLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  nextStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextStopText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    padding: 10,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.accentBlue,
  },
  fromText: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '500',
    flex: 1,
  },
  toText: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    fontWeight: '500',
    flex: 1,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.radiusSm,
    borderWidth: 1,
    borderColor: Theme.trafficHigh + '40',
    backgroundColor: Theme.trafficHigh + '10',
    minHeight: Theme.touchMin,
  },
  cancelText: {
    color: Theme.trafficHigh,
    fontSize: Theme.font.md,
    fontWeight: '600',
  },
});
