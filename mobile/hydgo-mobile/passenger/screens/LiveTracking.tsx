// ── Live Tracking Screen ────────────────────────────────────────────────────
// Full-screen tracking of a single bus with road-following polyline.
// Shows: map, ETA, distance, stops left, cancel button.
// Reads trackingBusId from store, subscribes to live bus updates.
// If trackingBusId becomes null → navigates back.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Theme, OCCUPANCY_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { usePassengerSocket } from '../hooks/usePassengerSocket';
import { getRoadRoute, clearRouteCache } from '../../lib/directions.api';
import { goBack } from '../../lib/navigation';
import { PremiumMapView } from '../components/PremiumMapView';

export default function LiveTracking() {
  const router = useRouter();
  const { sendLocation } = usePassengerSocket();

  const trackingBusId = usePassengerStore((s) => s.trackingBusId);
  const trackingMode = usePassengerStore((s) => s.trackingMode);
  const trackingOriginStop = usePassengerStore((s) => s.trackingOriginStop);
  const trackingDestStop = usePassengerStore((s) => s.trackingDestStop);
  const trackingDistanceMeters = usePassengerStore((s) => s.trackingDistanceMeters);
  const trackingEtaMinutes = usePassengerStore((s) => s.trackingEtaMinutes);
  const stopTracking = usePassengerStore((s) => s.stopTracking);
  const bus = usePassengerStore((s) => (s.trackingBusId ? s.buses.get(s.trackingBusId) : undefined));
  const userLocation = usePassengerStore((s) => s.userLocation);

  const isNavigatingRef = useRef(false);

  // ── If no tracking bus, redirect back ─────────────────────────────────
  useEffect(() => {
    if (!trackingBusId && !isNavigatingRef.current) {
      isNavigatingRef.current = true;
      goBack(router);
    }
  }, [trackingBusId, router]);

  // ── Send location to backend while tracking ──────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    sendLocation(userLocation.latitude, userLocation.longitude);
  }, [userLocation?.latitude, userLocation?.longitude, sendLocation]);

  // ── Cancel tracking ───────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    clearRouteCache();
    stopTracking();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/passenger/home' as any);
    }
  }, [stopTracking, router]);

  // ── No-op bus press (single bus visible in tracking mode) ─────────────
  const handleBusPress = useCallback(() => {}, []);

  // ── Computed values ───────────────────────────────────────────────────
  const distStr =
    trackingDistanceMeters < 1000
      ? `${trackingDistanceMeters}m`
      : `${(trackingDistanceMeters / 1000).toFixed(1)} km`;

  const etaColor =
    trackingEtaMinutes <= 3
      ? Theme.accentGreen
      : trackingEtaMinutes <= 8
        ? '#F59E0B'
        : Theme.text;

  const occupancyColor = bus
    ? OCCUPANCY_COLORS[bus.occupancy?.level ?? 'LOW']
    : Theme.accentGreen;

  const occupancyPercent = bus
    ? bus.capacity && bus.capacity > 0
      ? Math.round(((bus.passengerCount ?? 0) / bus.capacity) * 100)
      : 0
    : 0;

  if (!trackingBusId) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Theme.accent} size="small" />
        <Text style={styles.loadingText}>Returning to map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Full-screen map (tracking mode auto-hides other buses) ── */}
      <PremiumMapView onBusPress={handleBusPress} />

      {/* ── Top Bar ── */}
      <Animated.View style={styles.topBar} entering={FadeIn.duration(300)}>
        <Pressable
          style={styles.topBackBtn}
          onPress={() => goBack(router)}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={Theme.text} />
        </Pressable>
        <View style={styles.topTitleArea}>
          <Text style={styles.topTitle}>Tracking Bus</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* ── Bottom Tracking Panel ── */}
      <Animated.View style={styles.panel} entering={SlideInDown.duration(400)}>
        {/* Bus badge row */}
        <View style={styles.panelHeader}>
          <View style={[styles.busBadge, { borderColor: occupancyColor }]}>
            <Ionicons name="bus" size={18} color={Theme.text} />
            <Text style={styles.busNumber}>{bus?.routeNumber ?? '---'}</Text>
          </View>
          <View style={styles.panelHeaderRight}>
            <Text style={[styles.etaLarge, { color: etaColor }]}>
              {trackingEtaMinutes} min
            </Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
        </View>

        {/* Route name */}
        {bus?.routeName && (
          <Text style={styles.routeName} numberOfLines={1}>
            {bus.routeName}
          </Text>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="navigate-outline" size={16} color={Theme.textMuted} />
            <Text style={styles.statValue}>{distStr}</Text>
            <Text style={styles.statLabel}>away</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="speedometer-outline" size={16} color={Theme.textMuted} />
            <Text style={styles.statValue}>{bus?.speed ? `${Math.round(bus.speed)}` : '--'}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={16} color={occupancyColor} />
            <Text style={[styles.statValue, { color: occupancyColor }]}>{occupancyPercent}%</Text>
            <Text style={styles.statLabel}>full</Text>
          </View>
        </View>

        {/* Origin + Dest stops */}
        <View style={styles.stopsRow}>
          {trackingOriginStop && (
            <View style={styles.stopItem}>
              <View style={[styles.stopDot, { backgroundColor: Theme.accentGreen }]} />
              <Text style={styles.stopText} numberOfLines={1}>
                {trackingOriginStop.name}
              </Text>
            </View>
          )}
          {trackingDestStop && (
            <View style={styles.stopItem}>
              <View style={[styles.stopDot, { backgroundColor: Theme.accentRed }]} />
              <Text style={styles.stopText} numberOfLines={1}>
                {trackingDestStop.name}
              </Text>
            </View>
          )}
        </View>

        {/* Cancel button */}
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
          <Ionicons name="close-circle" size={18} color={Theme.accentRed} />
          <Text style={styles.cancelText}>Cancel Tracking</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
    gap: 10,
    zIndex: 200,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(17,17,17,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  } as any,
  topTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  topTitle: {
    fontSize: Theme.font.lg,
    fontWeight: '700',
    color: Theme.text,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accentGreen + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.accentGreen,
  },
  liveLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Theme.accentGreen,
    letterSpacing: 0.5,
  },

  // ── Bottom panel ──
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'web' ? 100 : 110,
    gap: 14,
    zIndex: 200,
    backdropFilter: 'blur(16px)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  } as any,

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.bgElevated,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  busNumber: {
    fontSize: Theme.font.xl,
    fontWeight: '800',
    color: Theme.text,
    letterSpacing: 0.5,
  },
  panelHeaderRight: {
    alignItems: 'flex-end',
  },
  etaLarge: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  etaLabel: {
    fontSize: Theme.font.xs,
    color: Theme.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: -2,
  },

  routeName: {
    fontSize: Theme.font.sm,
    color: Theme.textSecondary,
    fontWeight: '500',
  },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 14,
    gap: 0,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: Theme.font.md,
    fontWeight: '700',
    color: Theme.text,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Theme.textMuted,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Theme.border,
  },

  // ── Stops row ──
  stopsRow: {
    gap: 8,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stopText: {
    fontSize: Theme.font.sm,
    color: Theme.textSecondary,
    fontWeight: '500',
    flex: 1,
  },

  // ── Cancel ──
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Theme.radius,
    backgroundColor: Theme.accentRed + '12',
    borderWidth: 1,
    borderColor: Theme.accentRed + '30',
  },
  cancelText: {
    fontSize: Theme.font.md,
    fontWeight: '700',
    color: Theme.accentRed,
  },
});
