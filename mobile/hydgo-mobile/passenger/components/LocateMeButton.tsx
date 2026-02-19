// ── Locate Me Button ────────────────────────────────────────────────────────
// Floating button that flies the map camera to the user's live location.

import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';

export function LocateMeButton() {
  const userLocation = usePassengerStore((s) => s.userLocation);

  const handlePress = useCallback(() => {
    if (!userLocation) return;

    // Dispatch a custom event the MapViewLayer listens for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hydgo:flyToUser', {
          detail: { lat: userLocation.latitude, lng: userLocation.longitude },
        }),
      );
    }
  }, [userLocation]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel="Go to my location"
    >
      <Ionicons name="navigate" size={20} color={Theme.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    elevation: 6,
  } as any,
});
