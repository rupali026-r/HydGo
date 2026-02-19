/**
 * HydGo Driver — System Health Overlay (DEV only)
 *
 * Floating overlay that shows real-time system health:
 *   - Socket connection state
 *   - GPS tracking active
 *   - Background tracking active
 *   - Offline buffer size
 *   - Last heartbeat age
 *   - Network online state
 *   - Driver status
 *
 * Only renders in __DEV__ mode. No-op in production builds.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDriverStore } from '../store/driverStore';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface HealthItem {
  label: string;
  value: string;
  ok: boolean;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function DriverHealthOverlay() {
  // No-op in production
  if (!__DEV__) return null;

  return <HealthOverlayInner />;
}

function HealthOverlayInner() {
  const [collapsed, setCollapsed] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Store subscriptions
  const status = useDriverStore((s) => s.status);
  const socketConnected = useDriverStore((s) => s.socketConnected);
  const gpsActive = useDriverStore((s) => s.gpsActive);
  const backgroundTrackingActive = useDriverStore((s) => s.backgroundTrackingActive);
  const bufferSize = useDriverStore((s) => s.bufferSize);
  const lastHeartbeatAt = useDriverStore((s) => s.lastHeartbeatAt);
  const networkOnline = useDriverStore((s) => s.networkOnline);
  const lastError = useDriverStore((s) => s.lastError);

  // Tick every 2s for heartbeat age display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const heartbeatAge = lastHeartbeatAt ? Math.round((now - lastHeartbeatAt) / 1000) : null;

  const items: HealthItem[] = [
    { label: 'Status', value: status, ok: status !== 'OFFLINE' && status !== 'DISCONNECTED' },
    { label: 'Socket', value: socketConnected ? 'Connected' : 'Disconnected', ok: socketConnected },
    { label: 'GPS', value: gpsActive ? 'Active' : 'Inactive', ok: gpsActive },
    { label: 'BG Track', value: backgroundTrackingActive ? 'Active' : 'Off', ok: backgroundTrackingActive },
    { label: 'Network', value: networkOnline ? 'Online' : 'Offline', ok: networkOnline },
    { label: 'Buffer', value: String(bufferSize), ok: bufferSize === 0 },
    { label: 'Heartbeat', value: heartbeatAge !== null ? `${heartbeatAge}s ago` : 'N/A', ok: heartbeatAge !== null && heartbeatAge < 45 },
  ];

  if (collapsed) {
    const allOk = items.every((i) => i.ok);
    return (
      <TouchableOpacity
        style={[styles.badge, allOk ? styles.badgeOk : styles.badgeWarn]}
        onPress={() => setCollapsed(false)}
        activeOpacity={0.7}
      >
        <Text style={styles.badgeText}>{allOk ? '●' : '!'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <TouchableOpacity onPress={() => setCollapsed(true)}>
        <Text style={styles.title}>Driver Health</Text>
      </TouchableOpacity>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.value, item.ok ? styles.ok : styles.warn]}>
            {item.value}
          </Text>
        </View>
      ))}
      {lastError && (
        <Text style={styles.error} numberOfLines={2}>
          {lastError}
        </Text>
      )}
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 50,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  badgeOk: {
    backgroundColor: '#22c55e',
  },
  badgeWarn: {
    backgroundColor: '#ef4444',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 10,
    minWidth: 180,
    zIndex: 9999,
    elevation: 10,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  label: {
    color: '#aaa',
    fontSize: 11,
  },
  value: {
    fontSize: 11,
    fontWeight: '600',
  },
  ok: {
    color: '#22c55e',
  },
  warn: {
    color: '#ef4444',
  },
  error: {
    color: '#fbbf24',
    fontSize: 10,
    marginTop: 4,
  },
});
