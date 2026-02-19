// ── Occupancy Bar ───────────────────────────────────────────────────────────
// Horizontal color-coded bar showing bus occupancy percentage.

import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Theme, OCCUPANCY_COLORS } from '../../constants/theme';
import type { OccupancyLevel } from '../types';

interface OccupancyBarProps {
  level: OccupancyLevel;
  percent: number;
  showLabel?: boolean;
  height?: number;
}

const LABELS: Record<OccupancyLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'Busy',
  FULL: 'Full',
};

function OccupancyBarInner({ level, percent, showLabel = true, height = 4 }: OccupancyBarProps) {
  const color = OCCUPANCY_COLORS[level];
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(Math.min(percent, 100), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%` as any,
    backgroundColor: color,
    height,
    borderRadius: height / 2,
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View style={barStyle} />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>
          {LABELS[level]}
        </Text>
      )}
    </View>
  );
}

export const OccupancyBar = memo(OccupancyBarInner);

const styles = StyleSheet.create({
  container: {
    gap: 3,
  },
  track: {
    backgroundColor: Theme.bgElevated,
    width: '100%',
    overflow: 'hidden',
  },
  label: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
});
