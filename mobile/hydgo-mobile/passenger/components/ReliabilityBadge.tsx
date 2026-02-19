// ── Reliability Badge ───────────────────────────────────────────────────────
// Compact badge showing route/bus reliability level.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme, RELIABILITY_COLORS } from '../../constants/theme';
import type { ReliabilityLabel } from '../types';

interface ReliabilityBadgeProps {
  label: ReliabilityLabel;
  score?: number;
  compact?: boolean;
}

const LABELS: Record<ReliabilityLabel, string> = {
  HIGH: 'Reliable',
  MEDIUM: 'Moderate',
  LOW: 'Unreliable',
};

function ReliabilityBadgeInner({ label, score, compact }: ReliabilityBadgeProps) {
  const color = RELIABILITY_COLORS[label];

  return (
    <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '40' }, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, compact && styles.textCompact]}>
        {LABELS[label]}
      </Text>
      {score != null && !compact && (
        <Text style={[styles.score, { color: color + 'CC' }]}>
          {Math.round(score * 100)}%
        </Text>
      )}
    </View>
  );
}

export const ReliabilityBadge = memo(ReliabilityBadgeInner);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 8,
  },
  score: {
    fontSize: 8,
    fontWeight: '500',
  },
});
