/**
 * HydGo Driver — Status Toggle
 * Full-width GO ONLINE / GO OFFLINE button with animated state.
 * Black + white minimal design.
 */

import React from 'react';
import { Text, Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Font } from '../constants/theme';
import type { DriverStatus } from '../lib/types';

interface StatusToggleProps {
  status: DriverStatus;
  onGoOnline: () => void;
  onGoOffline: () => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  DriverStatus,
  { label: string; badge: string; badgeColor: string }
> = {
  PENDING_APPROVAL: { label: 'PENDING', badge: 'PENDING APPROVAL', badgeColor: Colors.warning },
  NO_BUS_ASSIGNED: { label: 'NO BUS', badge: 'NO BUS', badgeColor: Colors.info },
  OFFLINE: { label: 'GO ONLINE', badge: 'OFFLINE', badgeColor: Colors.textMuted },
  ONLINE: { label: 'GO OFFLINE', badge: 'ONLINE', badgeColor: Colors.success },
  ON_TRIP: { label: 'ON TRIP', badge: 'ON TRIP', badgeColor: Colors.info },
  IDLE: { label: 'GO OFFLINE', badge: 'IDLE', badgeColor: Colors.warning },
  DISCONNECTED: { label: 'RECONNECT', badge: 'DISCONNECTED', badgeColor: Colors.error },
};

export function StatusToggle({
  status,
  onGoOnline,
  onGoOffline,
  disabled = false,
}: StatusToggleProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const config = STATUS_CONFIG[status];
  const isOnline = status === 'ONLINE' || status === 'ON_TRIP' || status === 'IDLE';
  const isTripLocked = status === 'ON_TRIP';
  const isLifecycleState = status === 'PENDING_APPROVAL' || status === 'NO_BUS_ASSIGNED';

  const handlePress = () => {
    if (isTripLocked || disabled || isLifecycleState) return;
    if (isOnline) {
      onGoOffline();
    } else {
      onGoOnline();
    }
  };

  return (
    <View style={styles.container}>
      {/* Status badge */}
      <View style={styles.badgeRow}>
        <View
          style={[styles.dot, { backgroundColor: config.badgeColor }]}
        />
        <Text style={[styles.badgeText, { color: config.badgeColor }]}>
          {config.badge}
        </Text>
      </View>

      {/* Toggle button */}
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => {
            scale.value = withTiming(0.96, { duration: 80 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15 });
          }}
          onPress={handlePress}
          disabled={isTripLocked || disabled || isLifecycleState}
          style={[
            styles.button,
            {
              backgroundColor: isOnline ? Colors.bg : Colors.ctaPrimaryBg,
              borderColor: isOnline ? Colors.textPrimary : 'transparent',
              opacity: isTripLocked || disabled || isLifecycleState ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: isOnline ? Colors.textPrimary : Colors.ctaPrimaryText },
            ]}
          >
            {config.label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: Font.md,
    fontWeight: '700',
    letterSpacing: 1,
  },
  button: {
    paddingVertical: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: Font.xl,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
