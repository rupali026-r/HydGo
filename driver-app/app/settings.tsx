/**
 * HydGo Driver — Settings Screen
 * Driver info, bus info, app version, logout, force offline.
 * Logout: POST /api/auth/logout → clear tokens → disconnect socket.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { useDriverStore } from '../store/driverStore';
import { useDriverState } from '../hooks/useDriverState';
import { Colors, Font, Radius } from '../constants/theme';

function SettingsRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, driver, logout } = useAuth();
  const { status, goOffline } = useDriverState();
  const registrationNo = useDriverStore((s) => s.registrationNo);
  const routeNumber = useDriverStore((s) => s.routeNumber);
  const routeName = useDriverStore((s) => s.routeName);
  const capacity = useDriverStore((s) => s.capacity);
  const reset = useDriverStore((s) => s.reset);

  const handleLogout = async () => {
    // Force offline first if online
    if (status !== 'OFFLINE') {
      goOffline();
    }
    reset();
    await logout();
  };

  const handleForceOffline = () => {
    if (status === 'OFFLINE') return;
    goOffline();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* ── Driver Info ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DRIVER INFO</Text>
          <SettingsRow label="Name" value={user?.name} />
          <SettingsRow label="Email" value={user?.email} />
          <SettingsRow label="Role" value={user?.role} />
          <SettingsRow label="Status" value={user?.status} />
          <SettingsRow
            label="License"
            value={driver?.licenseNumber}
          />
          <SettingsRow
            label="Approved"
            value={driver?.approved ? 'Yes' : 'No'}
          />
        </View>

        {/* ── Bus Info ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUS INFO</Text>
          <SettingsRow label="Registration" value={registrationNo} />
          <SettingsRow label="Route" value={routeNumber ? `${routeNumber} — ${routeName}` : null} />
          <SettingsRow label="Capacity" value={capacity?.toString()} />
        </View>

        {/* ── Actions ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>

          {/* Force Offline */}
          <Pressable
            onPress={handleForceOffline}
            disabled={status === 'OFFLINE'}
            style={[
              styles.actionBtn,
              { opacity: status === 'OFFLINE' ? 0.3 : 1 },
            ]}
          >
            <Ionicons name="power" size={18} color={Colors.warning} />
            <Text style={[styles.actionText, { color: Colors.warning }]}>
              Force Offline
            </Text>
          </Pressable>

          {/* Logout */}
          <Pressable onPress={handleLogout} style={styles.actionBtn}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>
              Sign Out
            </Text>
          </Pressable>
        </View>

        {/* ── App Info ──────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>HydGo Driver v1.0.0</Text>
          <Text style={styles.footerText}>TSRTC Live Tracking System</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    padding: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Font.lg,
    fontWeight: '700',
  },
  section: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.textDim,
    fontSize: Font.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: {
    color: Colors.textMuted,
    fontSize: Font.md,
    fontWeight: '500',
  },
  rowValue: {
    color: Colors.textPrimary,
    fontSize: Font.md,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionText: {
    fontSize: Font.base,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  footerText: {
    color: Colors.textDim,
    fontSize: Font.sm,
    marginBottom: 4,
  },
});
