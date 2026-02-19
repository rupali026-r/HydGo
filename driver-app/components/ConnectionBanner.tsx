/**
 * HydGo Driver — Connection Banner
 * Shows colored banner for connection status.
 * Green = connected, Amber = reconnecting, Red = disconnected
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Font } from '../constants/theme';

interface ConnectionBannerProps {
  socketConnected: boolean;
  gpsActive: boolean;
  error: string | null;
  status: string;
}

export function ConnectionBanner({
  socketConnected,
  gpsActive,
  error,
  status,
}: ConnectionBannerProps) {
  // Don't show when offline and no error
  if (status === 'OFFLINE' && !error) return null;

  // Error state
  if (error) {
    return (
      <View style={[styles.banner, { backgroundColor: Colors.error }]}>
        <Text style={styles.text}>{error}</Text>
      </View>
    );
  }

  // Disconnected state
  if (status === 'DISCONNECTED' || (!socketConnected && status !== 'OFFLINE')) {
    return (
      <View style={[styles.banner, { backgroundColor: Colors.warning }]}>
        <Text style={[styles.text, { color: '#000' }]}>
          Reconnecting...
        </Text>
      </View>
    );
  }

  // GPS inactive but should be tracking
  if (
    !gpsActive &&
    (status === 'ONLINE' || status === 'ON_TRIP')
  ) {
    return (
      <View style={[styles.banner, { backgroundColor: Colors.warning }]}>
        <Text style={[styles.text, { color: '#000' }]}>
          GPS inactive
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: Font.md,
    fontWeight: '600',
    textAlign: 'center',
  },
});
