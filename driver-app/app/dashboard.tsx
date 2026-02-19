/**
 * HydGo Driver — Dashboard Screen
 * Main operational screen. Production-grade layout.
 *
 * Layout:
 *   Top:    Bus ID, Route Name, Status Badge, Battery
 *   Middle: GO ONLINE/OFFLINE toggle, Passenger Counter
 *   Bottom: Trip Controls, Connection Banner
 *
 * Black background. White typography. Zero gradients. Minimal.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../store/driverStore';
import { useDriverState } from '../hooks/useDriverState';
import { useAuth } from '../lib/auth-context';
import { StatusToggle } from '../components/StatusToggle';
import { PassengerCounter } from '../components/PassengerCounter';
import { TripControls } from '../components/TripControls';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { DriverHealthOverlay } from '../components/DriverHealthOverlay';
import { Colors, Font, Radius } from '../constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { status, goOnline, goOffline, startTrip, endTrip } = useDriverState();
  const { needsAutoResume, clearAutoResume, refreshProfile } = useAuth();
  const autoResumedRef = useRef(false);

  // Refresh profile on mount to get latest bus assignment
  useEffect(() => {
    refreshProfile().catch(() => {});
  }, [refreshProfile]);

  // Auto-resume after crash: if sessionRestore detected driver was ONLINE/ON_TRIP
  useEffect(() => {
    if (needsAutoResume && !autoResumedRef.current && status === 'OFFLINE') {
      autoResumedRef.current = true;
      clearAutoResume();
      goOnline();
    }
  }, [needsAutoResume, status, goOnline, clearAutoResume]);

  const registrationNo = useDriverStore((s) => s.registrationNo);
  const routeNumber = useDriverStore((s) => s.routeNumber);
  const routeName = useDriverStore((s) => s.routeName);
  const passengerCount = useDriverStore((s) => s.passengerCount);
  const capacity = useDriverStore((s) => s.capacity);
  const socketConnected = useDriverStore((s) => s.socketConnected);
  const gpsActive = useDriverStore((s) => s.gpsActive);
  const lastError = useDriverStore((s) => s.lastError);
  const activeTripId = useDriverStore((s) => s.activeTripId);
  const lastOccupancy = useDriverStore((s) => s.lastOccupancy);
  const incrementPassengers = useDriverStore((s) => s.incrementPassengers);
  const decrementPassengers = useDriverStore((s) => s.decrementPassengers);

  // ── Lifecycle State: PENDING_APPROVAL ──────────────────────
  if (status === 'PENDING_APPROVAL') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lifecycleContainer}>
          <View style={styles.header}>
            <Text style={styles.appTitle}>HydGo Driver</Text>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
          
          <View style={styles.lifecycleContent}>
            <View style={styles.lifecycleIconCircle}>
              <Ionicons name="time-outline" size={64} color={Colors.warning} />
            </View>
            <Text style={styles.lifecycleTitle}>Pending Admin Approval</Text>
            <Text style={styles.lifecycleMessage}>
              Your driver application has been submitted successfully.{'\n\n'}
              An admin will review your account shortly. You will be notified once approved.
            </Text>
            <View style={styles.lifecycleInfoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
              <Text style={styles.lifecycleInfoText}>
                This usually takes 1-2 business days. Check back soon!
              </Text>
            </View>
          </View>
        </View>
        <DriverHealthOverlay />
      </SafeAreaView>
    );
  }

  // ── Lifecycle State: NO_BUS_ASSIGNED ───────────────────────
  if (status === 'NO_BUS_ASSIGNED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lifecycleContainer}>
          <View style={styles.header}>
            <Text style={styles.appTitle}>HydGo Driver</Text>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
          
          <View style={styles.lifecycleContent}>
            <View style={styles.lifecycleIconCircle}>
              <Ionicons name="bus-outline" size={64} color={Colors.info} />
            </View>
            <Text style={styles.lifecycleTitle}>No Bus Assigned Yet</Text>
            <Text style={styles.lifecycleMessage}>
              Your account has been approved! 🎉{'\n\n'}
              However, you don't have a bus assigned yet. Contact your admin to have a bus assigned to you.
            </Text>
            <View style={styles.lifecycleInfoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
              <Text style={styles.lifecycleInfoText}>
                Once a bus is assigned, you'll be able to GO ONLINE immediately without re-logging in.
              </Text>
            </View>
          </View>
        </View>
        <DriverHealthOverlay />
      </SafeAreaView>
    );
  }

  // ── Operational Dashboard (OFFLINE, ONLINE, ON_TRIP, etc.) ──
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appTitle}>HydGo Driver</Text>
            {registrationNo ? (
              <Text style={styles.busLabel}>
                Bus: {registrationNo}
              </Text>
            ) : (
              <Text style={styles.busLabel}>No bus assigned</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <BatteryIndicator />
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* ── Route Info ────────────────────────────────────────── */}
        {routeNumber && (
          <View style={styles.routeCard}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{routeNumber}</Text>
            </View>
            <Text style={styles.routeName} numberOfLines={1}>
              {routeName || 'Unknown Route'}
            </Text>
          </View>
        )}

        {/* ── Connection Banner ─────────────────────────────────── */}
        <ConnectionBanner
          socketConnected={socketConnected}
          gpsActive={gpsActive}
          error={lastError}
          status={status}
        />

        {/* ── Status Toggle ─────────────────────────────────────── */}
        <StatusToggle
          status={status}
          onGoOnline={goOnline}
          onGoOffline={goOffline}
        />

        {/* ── Active Trip Banner ────────────────────────────────── */}
        {activeTripId && (
          <Pressable
            onPress={() => router.push('/trip')}
            style={styles.tripBanner}
          >
            <View style={styles.tripDot} />
            <Text style={styles.tripBannerText}>
              Active trip in progress
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textPrimary}
            />
          </Pressable>
        )}

        {/* ── Passenger Counter ─────────────────────────────────── */}
        {status !== 'OFFLINE' && status !== 'DISCONNECTED' && (
          <PassengerCounter
            count={passengerCount}
            capacity={capacity}
            onIncrement={incrementPassengers}
            onDecrement={decrementPassengers}
          />
        )}

        {/* ── Trip Controls ─────────────────────────────────────── */}
        <TripControls
          status={status}
          onStartTrip={startTrip}
          onEndTrip={endTrip}
        />

        {/* ── Info strip ────────────────────────────────────────── */}
        {status !== 'OFFLINE' && (
          <View style={styles.infoStrip}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>GPS</Text>
              <View
                style={[
                  styles.infoDot,
                  {
                    backgroundColor: gpsActive
                      ? Colors.success
                      : Colors.textMuted,
                  },
                ]}
              />
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>SOCKET</Text>
              <View
                style={[
                  styles.infoDot,
                  {
                    backgroundColor: socketConnected
                      ? Colors.success
                      : Colors.error,
                  },
                ]}
              />
            </View>
            {lastOccupancy && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>OCCUPANCY</Text>
                <Text style={styles.infoValue}>{lastOccupancy}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <DriverHealthOverlay />
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
    marginBottom: 20,
  },
  appTitle: {
    color: Colors.textPrimary,
    fontSize: Font.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  busLabel: {
    color: Colors.textMuted,
    fontSize: Font.md,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  routeBadge: {
    backgroundColor: Colors.ctaPrimaryBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routeBadgeText: {
    color: Colors.ctaPrimaryText,
    fontSize: Font.md,
    fontWeight: '800',
  },
  routeName: {
    color: Colors.textPrimary,
    fontSize: Font.base,
    fontWeight: '500',
    flex: 1,
  },
  tripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  tripDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.info,
  },
  tripBannerText: {
    color: Colors.textPrimary,
    fontSize: Font.base,
    fontWeight: '600',
    flex: 1,
  },
  infoStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    marginTop: 8,
  },
  infoItem: {
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    color: Colors.textDim,
    fontSize: Font.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoValue: {
    color: Colors.textSecondary,
    fontSize: Font.sm,
    fontWeight: '600',
  },
  // ── Lifecycle State Styles ────────────────────────────────
  lifecycleContainer: {
    flex: 1,
    padding: 20,
  },
  lifecycleContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lifecycleIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  lifecycleTitle: {
    color: Colors.textPrimary,
    fontSize: Font.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  lifecycleMessage: {
    color: Colors.textSecondary,
    fontSize: Font.base,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  lifecycleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: Radius.md,
    padding: 14,
    gap: 10,
    maxWidth: 400,
  },
  lifecycleInfoText: {
    color: Colors.textSecondary,
    fontSize: Font.sm,
    flex: 1,
    lineHeight: 20,
  },
});
