/**
 * HydGo Driver — Trip Controls
 * Start Trip / End Trip buttons.
 * End Trip is destructive (red).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Font } from '../constants/theme';
import type { DriverStatus } from '../lib/types';

interface TripControlsProps {
  status: DriverStatus;
  onStartTrip: () => void;
  onEndTrip: () => void;
}

export function TripControls({
  status,
  onStartTrip,
  onEndTrip,
}: TripControlsProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const canStart = status === 'ONLINE';
  const canEnd = status === 'ON_TRIP';

  if (status === 'OFFLINE' || status === 'DISCONNECTED') return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      {canStart && (
        <Pressable
          onPressIn={() => {
            scale.value = withTiming(0.97, { duration: 80 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15 });
          }}
          onPress={onStartTrip}
          style={styles.startBtn}
        >
          <Text style={styles.startText}>START TRIP</Text>
        </Pressable>
      )}
      {canEnd && (
        <Pressable
          onPressIn={() => {
            scale.value = withTiming(0.97, { duration: 80 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15 });
          }}
          onPress={onEndTrip}
          style={styles.endBtn}
        >
          <Text style={styles.endText}>END TRIP</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  startBtn: {
    backgroundColor: Colors.ctaPrimaryBg,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startText: {
    color: Colors.ctaPrimaryText,
    fontSize: Font.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
  endBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endText: {
    color: Colors.textPrimary,
    fontSize: Font.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
