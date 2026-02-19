// ── Nearest Stop Card ───────────────────────────────────────────────────────
// Premium card showing auto-detected nearest stop with reliability + traffic.
// Tapping zooms map to the stop. Smooth fade-in animation.

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { ReliabilityBadge } from './ReliabilityBadge';
import { TrafficIndicator } from './TrafficIndicator';
import { SkeletonStopCard } from './SkeletonLoader';
import { formatDistance } from '../utils/geo';

interface NearestStopCardProps {
  onPress?: () => void;
}

export function NearestStopCard({ onPress }: NearestStopCardProps) {
  const nearestStop = usePassengerStore((s) => s.nearestStop);
  const nearestStopDistance = usePassengerStore((s) => s.nearestStopDistance);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (nearestStop) {
      opacity.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
      translateY.value = withDelay(200, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
    }
  }, [nearestStop?.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!nearestStop) {
    return <SkeletonStopCard />;
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={18} color={Theme.text} />
        </View>

        <View style={styles.info}>
          <Text style={styles.label}>Nearest stop</Text>
          <Text style={styles.stopName} numberOfLines={1}>
            {nearestStop.name}
          </Text>
          {nearestStopDistance != null && (
            <Text style={styles.distance}>
              {formatDistance(nearestStopDistance)} away
            </Text>
          )}
        </View>

        <View style={styles.badges}>
          <ReliabilityBadge label="HIGH" compact />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadowSubtle,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopName: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '600',
    marginTop: 1,
  },
  distance: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    marginTop: 1,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
