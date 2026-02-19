/**
 * HydGo Driver — Passenger Counter
 * + / - buttons with count display and occupancy bar.
 * Occupancy: 0–30% green, 30–70% yellow, 70–100% red
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Radius, Font } from '../constants/theme';

interface PassengerCounterProps {
  count: number;
  capacity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

function getOccupancyColor(pct: number): string {
  if (pct <= 0.3) return Colors.occupancyLow;
  if (pct <= 0.7) return Colors.occupancyMedium;
  return Colors.occupancyFull;
}

export function PassengerCounter({
  count,
  capacity,
  onIncrement,
  onDecrement,
  disabled = false,
}: PassengerCounterProps) {
  const pct = capacity > 0 ? count / capacity : 0;
  const color = getOccupancyColor(pct);
  const pctDisplay = Math.round(pct * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>PASSENGERS</Text>

      <View style={styles.row}>
        {/* Decrement */}
        <Pressable
          onPress={onDecrement}
          disabled={disabled || count <= 0}
          style={[
            styles.btn,
            { opacity: disabled || count <= 0 ? 0.3 : 1 },
          ]}
        >
          <Text style={styles.btnText}>−</Text>
        </Pressable>

        {/* Count */}
        <View style={styles.countContainer}>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.capacity}>/ {capacity}</Text>
        </View>

        {/* Increment */}
        <Pressable
          onPress={onIncrement}
          disabled={disabled || count >= capacity}
          style={[
            styles.btn,
            { opacity: disabled || count >= capacity ? 0.3 : 1 },
          ]}
        >
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>

      {/* Occupancy bar */}
      <View style={styles.barOuter}>
        <View
          style={[
            styles.barInner,
            {
              width: `${Math.min(pctDisplay, 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <Text style={[styles.pctText, { color }]}>{pctDisplay}% occupied</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: Font.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  btnText: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  count: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: '800',
  },
  capacity: {
    color: Colors.textMuted,
    fontSize: Font.base,
    fontWeight: '500',
  },
  barOuter: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barInner: {
    height: '100%',
    borderRadius: 3,
  },
  pctText: {
    fontSize: Font.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
