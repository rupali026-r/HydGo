// ── Traffic Indicator ───────────────────────────────────────────────────────
// Shows traffic level with color-coded dot + label.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme, TRAFFIC_COLORS } from '../../constants/theme';
import type { TrafficLevel } from '../types';

const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  LOW: 'Smooth',
  MODERATE: 'Moderate',
  HIGH: 'Heavy',
};

interface TrafficIndicatorProps {
  level: TrafficLevel;
  compact?: boolean;
}

function TrafficIndicatorInner({ level, compact }: TrafficIndicatorProps) {
  const color = TRAFFIC_COLORS[level];

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, compact && styles.textCompact]}>
        {TRAFFIC_LABELS[level]}
      </Text>
    </View>
  );
}

export const TrafficIndicator = memo(TrafficIndicatorInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compact: {
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: Theme.font.xs,
  },
});
