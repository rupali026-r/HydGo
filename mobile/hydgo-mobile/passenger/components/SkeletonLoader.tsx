// ── Skeleton Loader ─────────────────────────────────────────────────────────
// Premium shimmer skeleton for loading states. No blank screens.

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Theme } from '../../constants/theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = Theme.radiusXs, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Theme.bgElevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Card-shaped skeleton for bus cards */
export function SkeletonCard() {
  return (
    <View style={skStyles.card}>
      <Skeleton width={48} height={36} borderRadius={Theme.radiusXs} />
      <View style={skStyles.cardBody}>
        <Skeleton width={120} height={14} />
        <Skeleton width={80} height={10} style={{ marginTop: 4 }} />
      </View>
      <View style={skStyles.cardBadges}>
        <Skeleton width={52} height={22} borderRadius={6} />
        <Skeleton width={44} height={18} borderRadius={6} />
      </View>
    </View>
  );
}

/** Row of suggestion card skeletons */
export function SkeletonSuggestionRow() {
  return (
    <View style={skStyles.row}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={skStyles.suggCard}>
          <Skeleton width={36} height={20} borderRadius={6} />
          <Skeleton width={60} height={24} style={{ marginTop: 8 }} />
          <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
          <Skeleton width="100%" height={4} borderRadius={2} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Nearest stop skeleton */
export function SkeletonStopCard() {
  return (
    <View style={skStyles.stopCard}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <View style={skStyles.stopBody}>
        <Skeleton width={64} height={10} />
        <Skeleton width={140} height={14} style={{ marginTop: 4 }} />
      </View>
      <Skeleton width={48} height={18} borderRadius={6} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: Theme.space.md,
    gap: Theme.space.sm,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cardBody: { flex: 1 },
  cardBadges: { alignItems: 'flex-end', gap: 4 },
  row: {
    flexDirection: 'row',
    gap: Theme.space.sm,
    paddingRight: Theme.space.lg,
  },
  suggCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: Theme.space.md,
    width: 140,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: Theme.space.md,
    gap: Theme.space.sm,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  stopBody: { flex: 1 },
});
