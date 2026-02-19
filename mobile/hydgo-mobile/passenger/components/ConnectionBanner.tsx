// ── Connection Banner ───────────────────────────────────────────────────────
// Shows a premium-styled banner when the socket is disconnected or reconnecting.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import type { ConnectionStatus } from '../types';

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: any } | null> = {
  connected: null,
  connecting: { label: 'Connecting...', color: '#EAB308', icon: 'sync-outline' },
  disconnected: { label: 'Reconnecting...', color: '#F97316', icon: 'cloud-offline-outline' },
  error: { label: 'Connection error', color: '#EF4444', icon: 'warning-outline' },
};

export function ConnectionBanner() {
  const status = usePassengerStore((s) => s.connectionStatus);
  const config = STATUS_CONFIG[status];

  if (!config) return null;

  return (
    <View style={[styles.banner, { backgroundColor: config.color + '15', borderColor: config.color + '40' }]}>
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    gap: 8,
    backdropFilter: 'blur(12px)' as any,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
