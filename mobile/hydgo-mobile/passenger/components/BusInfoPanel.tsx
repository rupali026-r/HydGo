// ── Floating Bus Card ───────────────────────────────────────────────────────
// Premium slide-in panel shown when a bus marker is tapped.
// Shows: bus number, route, ETA (large bold), confidence %, occupancy %,
// reliability badge, "View Route" and "Start Journey" buttons.
// Slide-in animation from bottom.

import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS, CONFIDENCE_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { AnimatedETA } from './AnimatedETA';
import { OccupancyBar } from './OccupancyBar';
import { ReliabilityBadge } from './ReliabilityBadge';
import { TrafficIndicator } from './TrafficIndicator';
import type { OccupancyLevel } from '../types';

const SPRING_CONFIG = { damping: 20, stiffness: 180, mass: 0.8 };

interface FloatingBusCardProps {
  onClose?: () => void;
  onViewRoute?: () => void;
  onStartJourney?: () => void;
}

export function FloatingBusCard({ onClose, onViewRoute, onStartJourney }: FloatingBusCardProps) {
  const selectedBusId = usePassengerStore((s) => s.selectedBusId);
  const buses = usePassengerStore((s) => s.buses);

  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (selectedBusId) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(300, SPRING_CONFIG);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [selectedBusId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!selectedBusId) return null;

  const bus = buses.get(selectedBusId);
  if (!bus) return null;

  const occColor = OCCUPANCY_COLORS[bus.occupancy.level];
  const confidenceVal = bus.confidence ?? 0.7;
  const confidenceLabel = confidenceVal >= 0.8 ? 'HIGH' : confidenceVal >= 0.6 ? 'MEDIUM' : 'LOW';
  const confColor = CONFIDENCE_COLORS[confidenceLabel];

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.routeTag}>
            <Ionicons name="bus" size={16} color={Theme.text} />
            <Text style={styles.routeNumber}>{bus.routeNumber ?? '---'}</Text>
          </View>
          {bus.reliability && (
            <ReliabilityBadge label={bus.reliability.label} score={bus.reliability.score} compact />
          )}
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Theme.textTertiary} />
          </Pressable>
        </View>

        {/* Route name */}
        <Text style={styles.routeName} numberOfLines={1}>
          {bus.routeName ?? 'Unknown Route'}
        </Text>

        {/* ETA + Confidence row */}
        <View style={styles.etaRow}>
          <View style={styles.etaBlock}>
            <AnimatedETA minutes={bus.eta?.estimatedMinutes ?? 0} />
            <Text style={styles.statLabel}>ETA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: confColor }]}>
              {Math.round(confidenceVal * 100)}%
            </Text>
            <Text style={styles.statLabel}>Confidence</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: occColor }]}>
              {bus.occupancy.percent}%
            </Text>
            <Text style={styles.statLabel}>Occupancy</Text>
          </View>
        </View>

        {/* Occupancy bar */}
        <OccupancyBar level={bus.occupancy.level} percent={bus.occupancy.percent} height={4} />

        {/* Traffic + Speed row */}
        <View style={styles.infoRow}>
          {bus.trafficLevel && (
            <TrafficIndicator level={bus.trafficLevel} compact />
          )}
          <View style={styles.speedBadge}>
            <Ionicons name="speedometer-outline" size={12} color={Theme.textTertiary} />
            <Text style={styles.speedText}>{Math.round(bus.speed)} km/h</Text>
          </View>
          <View style={styles.seatsBadge}>
            <Ionicons name="people-outline" size={12} color={Theme.textTertiary} />
            <Text style={styles.seatsText}>
              {bus.passengerCount ?? 0}/{bus.capacity ?? 52}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable onPress={onViewRoute} style={styles.btnOutline}>
            <Ionicons name="map-outline" size={16} color={Theme.text} />
            <Text style={styles.btnOutlineText}>View Route</Text>
          </Pressable>
          <Pressable onPress={onStartJourney} style={styles.btnPrimary}>
            <Ionicons name="navigate" size={16} color={Theme.bg} />
            <Text style={styles.btnPrimaryText}>Start Journey</Text>
          </Pressable>
        </View>
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
    zIndex: 200,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center' as any,
        width: '100%',
      },
    }),
  },
  card: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  routeNumber: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeName: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  etaBlock: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Theme.border,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speedText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  seatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seatsText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.radiusSm,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
    minHeight: Theme.touchMin,
  },
  btnOutlineText: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.radiusSm,
    backgroundColor: Theme.text,
    minHeight: Theme.touchMin,
  },
  btnPrimaryText: {
    color: Theme.bg,
    fontSize: Theme.font.md,
    fontWeight: '600',
  },
});
