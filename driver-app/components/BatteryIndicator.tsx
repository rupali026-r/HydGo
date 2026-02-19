/**
 * HydGo Driver — Battery Indicator
 * Displays battery level with icon.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Font } from '../constants/theme';

export function BatteryIndicator() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const Battery = await import('expo-battery');
        const l = await Battery.getBatteryLevelAsync();
        if (mounted && l >= 0) setLevel(Math.round(l * 100));
      } catch {
        // Battery API not available (web or simulator)
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (level === null) return null;

  const color =
    level <= 20
      ? Colors.error
      : level <= 50
        ? Colors.warning
        : Colors.success;

  return (
    <View style={styles.container}>
      {/* Battery shell */}
      <View style={styles.shell}>
        <View
          style={[
            styles.fill,
            { width: `${level}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.text, { color }]}>{level}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shell: {
    width: 28,
    height: 14,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  text: {
    fontSize: Font.xs,
    fontWeight: '700',
  },
});
