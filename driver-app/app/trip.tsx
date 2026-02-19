/**
 * HydGo Driver — Trip Screen
 * Shows active trip details: route, next stop, passenger count,
 * trip duration timer, and End Trip button.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../store/driverStore';
import { useDriverState } from '../hooks/useDriverState';
import { api } from '../lib/api';
import { Colors, Font, Radius } from '../constants/theme';
import type { TripInfo, RouteInfo, StopInfo } from '../lib/types';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function TripScreen() {
  const router = useRouter();
  const { status, endTrip } = useDriverState();

  const activeTripId = useDriverStore((s) => s.activeTripId);
  const tripStartTime = useDriverStore((s) => s.tripStartTime);
  const routeNumber = useDriverStore((s) => s.routeNumber);
  const routeName = useDriverStore((s) => s.routeName);
  const passengerCount = useDriverStore((s) => s.passengerCount);
  const capacity = useDriverStore((s) => s.capacity);

  const [tripData, setTripData] = useState<TripInfo | null>(null);
  const [stops, setStops] = useState<StopInfo[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch trip data from backend
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/drivers/trip');
        const trip: TripInfo = data.data ?? data;
        setTripData(trip);
        if (trip.bus?.route?.stops) {
          setStops(
            [...trip.bus.route.stops].sort(
              (a: StopInfo, b: StopInfo) => a.stopOrder - b.stopOrder,
            ),
          );
        }
      } catch {
        // No active trip data
      }
      setLoading(false);
    })();
  }, []);

  // Trip duration timer
  useEffect(() => {
    if (!tripStartTime) return;

    const updateElapsed = () => {
      const start = new Date(tripStartTime).getTime();
      setElapsed(Date.now() - start);
    };
    updateElapsed();

    timerRef.current = setInterval(updateElapsed, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tripStartTime]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.textMuted} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Trip Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* ── Trip Timer ────────────────────────────────────────── */}
        {status === 'ON_TRIP' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>TRIP DURATION</Text>
            <Text style={styles.timerValue}>{formatDuration(elapsed)}</Text>
          </View>
        )}

        {/* ── Route Info ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ROUTE</Text>
          <View style={styles.routeRow}>
            {routeNumber && (
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{routeNumber}</Text>
              </View>
            )}
            <Text style={styles.cardValue}>
              {routeName || 'Unknown Route'}
            </Text>
          </View>
        </View>

        {/* ── Passengers ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PASSENGERS</Text>
          <Text style={styles.cardValue}>
            {passengerCount} / {capacity}
          </Text>
        </View>

        {/* ── Stops ─────────────────────────────────────────────── */}
        {stops.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>STOPS</Text>
            {stops.map((stop, i) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.stopDot} />
                <Text style={styles.stopName}>
                  {i + 1}. {stop.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── End Trip ──────────────────────────────────────────── */}
        {status === 'ON_TRIP' && (
          <Pressable onPress={endTrip} style={styles.endBtn}>
            <Text style={styles.endBtnText}>END TRIP</Text>
          </Pressable>
        )}

        {/* ── No Active Trip ────────────────────────────────────── */}
        {status !== 'ON_TRIP' && !activeTripId && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active trip</Text>
            <Pressable
              onPress={() => router.replace('/dashboard')}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        )}
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
    marginBottom: 24,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Font.lg,
    fontWeight: '700',
  },
  timerCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 24,
    marginBottom: 16,
  },
  timerLabel: {
    color: Colors.textDim,
    fontSize: Font.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  timerValue: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    color: Colors.textDim,
    fontSize: Font.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cardValue: {
    color: Colors.textPrimary,
    fontSize: Font.base,
    fontWeight: '600',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  stopName: {
    color: Colors.textSecondary,
    fontSize: Font.md,
  },
  endBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  endBtnText: {
    color: Colors.textPrimary,
    fontSize: Font.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Font.base,
    marginBottom: 16,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: Colors.ctaSecondaryBorder,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    color: Colors.textPrimary,
    fontSize: Font.base,
    fontWeight: '600',
  },
});
