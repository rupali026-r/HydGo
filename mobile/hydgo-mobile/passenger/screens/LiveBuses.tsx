// ── Live Buses Screen (Phase 9) ─────────────────────────────────────────────
// Shows real-time list of individual buses arriving at origin stop.
// Tap a bus → navigate back to map in single-bus tracking mode.
//
// Layout:
//   TOP: Origin + Destination stop names
//   MAIN: FlatList of LiveBusCard items (sorted by ETA)
//   Each card: route badge, "Arriving in X min", distance, occupancy bar,
//              reliability dot, LIVE badge

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Theme, OCCUPANCY_COLORS, RELIABILITY_COLORS, CONFIDENCE_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { api } from '../../lib/api';
import { AppHeader } from '../components/AppHeader';

interface LiveBus {
  busId: string;
  registrationNo: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeType: string;
  distanceMeters: number;
  etaMinutes: number;
  occupancyLevel: string;
  occupancyPercent: number;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  reliability: number;
  confidence: number;
  isLive: boolean;
  isSimulated: boolean;
  passengerCount: number;
  capacity: number;
}

const POLL_INTERVAL = 8000; // 8s auto refresh

export default function LiveBuses() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    originStop?: string;
    originLat?: string;
    originLng?: string;
    destStop?: string;
    destLat?: string;
    destLng?: string;
    routeId?: string;
    routeNumber?: string;
  }>();

  const startTracking = usePassengerStore((s) => s.startTracking);

  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const originName = params.originStop || 'Unknown Stop';
  const destName = params.destStop || '';
  const routeId = params.routeId || '';
  const routeNumber = params.routeNumber || '';
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNavigatingRef = useRef(false);

  // ── Fetch live buses ──────────────────────────────────────────────────
  const fetchBuses = useCallback(async () => {
    try {
      const res = await api.get('/live-buses', {
        params: {
          // Pass routeId for precise filtering when coming from a specific route card
          ...(routeId ? { routeId } : {}),
          originStop: params.originStop,
          originLat: params.originLat,
          originLng: params.originLng,
          destStop: params.destStop || undefined,
        },
      });
      const data = res.data;
      if (data?.buses) {
        setBuses(data.buses);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.warn('[LiveBuses] fetch error', err);
    }
    setLoading(false);
  }, [routeId, params.originStop, params.originLat, params.originLng, params.destStop]);

  // ── Initial load + polling ────────────────────────────────────────────
  useEffect(() => {
    fetchBuses();
    pollRef.current = setInterval(fetchBuses, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchBuses]);

  // ── Handle bus tap → tracking mode ────────────────────────────────────
  const handleBusTap = useCallback(
    (bus: LiveBus) => {
      if (isNavigatingRef.current) return;          // ← guard
      isNavigatingRef.current = true;

      const originStop = {
        id: '',
        name: originName,
        latitude: parseFloat(params.originLat || '0'),
        longitude: parseFloat(params.originLng || '0'),
        routeId: bus.routeId,
        stopOrder: 0,
      };
      const destStop = destName
        ? {
            id: '',
            name: destName,
            latitude: parseFloat(params.destLat || '0'),
            longitude: parseFloat(params.destLng || '0'),
            routeId: bus.routeId,
            stopOrder: 0,
          }
        : null;

      startTracking(bus.busId, originStop, destStop ?? undefined);
      router.push('/(app)/passenger/tracking' as any);
      setTimeout(() => { isNavigatingRef.current = false; }, 1500);
    },
    [originName, destName, params, startTracking, router],
  );

  // ── Render bus card ───────────────────────────────────────────────────
  const renderBusCard = useCallback(
    ({ item, index }: { item: LiveBus; index: number }) => (
      <LiveBusCard bus={item} index={index} onPress={() => handleBusTap(item)} />
    ),
    [handleBusTap],
  );

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <AppHeader
        title={routeNumber ? `Route ${routeNumber}` : 'Live Buses'}
        subtitle={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : routeId ? 'Filtered by route' : undefined}
        rightIcon="refresh"
        onRightPress={fetchBuses}
      />

      {/* ── Stop Bar ── */}
      <View style={styles.stopBar}>
        <View style={styles.stopRow}>
          <View style={[styles.stopDot, { backgroundColor: Theme.accentGreen }]} />
          <View style={styles.stopTextCol}>
            <Text style={styles.stopLabel}>FROM</Text>
            <Text style={styles.stopName} numberOfLines={1}>{originName}</Text>
          </View>
        </View>
        {destName.length > 0 && (
          <>
            <View style={styles.stopDivider} />
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: Theme.accentRed }]} />
              <View style={styles.stopTextCol}>
                <Text style={styles.stopLabel}>TO</Text>
                <Text style={styles.stopName} numberOfLines={1}>{destName}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Bus count badge ── */}
      {!loading && buses.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {buses.length} bus{buses.length !== 1 ? 'es' : ''} {routeId ? 'on this route' : 'approaching'}
          </Text>
          <View style={styles.liveDotRow}>
            <View style={styles.livePulse} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
      )}

      {/* ── Loading ── */}
      {loading && (
        <View style={styles.statusContainer}>
          <ActivityIndicator color={Theme.accent} size="small" />
          <Text style={styles.statusText}>
            {routeId
              ? `Loading buses for route ${routeNumber || routeId}...`
              : `Finding buses near ${originName}...`}
          </Text>
        </View>
      )}

      {/* ── Empty state ── */}
      {!loading && buses.length === 0 && (
        <View style={styles.statusContainer}>
          <Ionicons name="bus-outline" size={42} color={Theme.textMuted} />
          <Text style={styles.statusTitle}>
            {routeId ? `No active buses on route ${routeNumber || routeId}` : 'No buses approaching'}
          </Text>
          <Text style={styles.statusText}>
            {routeId
              ? `No active buses currently running on this route`
              : `No active buses found near ${originName}`}
          </Text>
          <Pressable onPress={fetchBuses} style={styles.retryBtn}>
            <Ionicons name="refresh" size={16} color={Theme.accentBlue} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── Bus list ── */}
      <FlatList
        data={buses}
        keyExtractor={(item) => item.busId}
        renderItem={renderBusCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

// ── Live Bus Card ───────────────────────────────────────────────────────────

function LiveBusCard({
  bus,
  index,
  onPress,
}: {
  bus: LiveBus;
  index: number;
  onPress: () => void;
}) {
  const etaColor =
    bus.etaMinutes <= 5 ? Theme.accentGreen : bus.etaMinutes <= 12 ? '#F59E0B' : Theme.accentRed;
  const occupancyColor = OCCUPANCY_COLORS[bus.occupancyLevel as keyof typeof OCCUPANCY_COLORS] ?? Theme.accentGreen;
  const reliabilityLabel: 'HIGH' | 'MEDIUM' | 'LOW' =
    bus.reliability >= 80 ? 'HIGH' : bus.reliability >= 50 ? 'MEDIUM' : 'LOW';
  const reliabilityColor = RELIABILITY_COLORS[reliabilityLabel];
  const confidencePct = Math.round(bus.confidence * 100);
  const distanceStr = bus.distanceMeters < 1000
    ? `${bus.distanceMeters}m away`
    : `${(bus.distanceMeters / 1000).toFixed(1)} km away`;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
      <Pressable onPress={onPress} style={styles.busCard}>
        {/* ── Left: Route badge ── */}
        <View style={styles.busCardLeft}>
          <View style={[styles.routeBadge, { borderColor: occupancyColor }]}>
            <Ionicons name="bus" size={16} color={Theme.text} />
            <Text style={styles.routeNumber}>{bus.routeNumber}</Text>
          </View>
          {!bus.isSimulated ? (
            <View style={styles.liveTagBadge}>
              <View style={styles.liveTagDot} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          ) : (
            <View style={[styles.liveTagBadge, { backgroundColor: Theme.bgElevated }]}>
              <Text style={[styles.liveTagText, { color: Theme.textMuted }]}>SIM</Text>
            </View>
          )}
        </View>

        {/* ── Center: bus info ── */}
        <View style={styles.busCardCenter}>
          {/* Arriving in X min */}
          <View style={styles.etaRow}>
            <Text style={[styles.etaLabel, { color: etaColor }]}>
              Arriving in {bus.etaMinutes} min
            </Text>
          </View>

          {/* Distance */}
          <Text style={styles.distanceText}>{distanceStr}</Text>

          {/* Occupancy + Confidence row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <View style={styles.occupancyBarBg}>
                <View
                  style={[
                    styles.occupancyBarFill,
                    {
                      width: `${Math.min(100, bus.occupancyPercent)}%`,
                      backgroundColor: occupancyColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.metricLabel, { color: occupancyColor }]}>
                {bus.occupancyPercent}%
              </Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.reliDot, { backgroundColor: reliabilityColor }]} />
              <Text style={[styles.metricLabel, { color: reliabilityColor }]}>
                {reliabilityLabel}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Ionicons name="analytics" size={11} color={Theme.textMuted} />
              <Text style={styles.metricLabel}>{confidencePct}%</Text>
            </View>
          </View>
        </View>

        {/* ── Right: chevron ── */}
        <View style={styles.busCardRight}>
          <Ionicons name="chevron-forward" size={20} color={Theme.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Theme.font.xl,
    fontWeight: '700',
    color: Theme.text,
  },
  headerSub: {
    fontSize: Theme.font.xs,
    color: Theme.textMuted,
    marginTop: 1,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Stop bar ──
  stopBar: {
    marginHorizontal: 16,
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopTextCol: {
    flex: 1,
  },
  stopLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Theme.textMuted,
    letterSpacing: 0.8,
  },
  stopName: {
    fontSize: Theme.font.md,
    fontWeight: '600',
    color: Theme.text,
    marginTop: 1,
  },
  stopDivider: {
    height: 1,
    backgroundColor: Theme.border,
    marginLeft: 20,
  },

  // ── Count row ──
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  countText: {
    fontSize: Theme.font.sm,
    fontWeight: '600',
    color: Theme.textSecondary,
  },
  liveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Theme.accentGreen,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.accentGreen,
    letterSpacing: 0.5,
  },

  // ── Status ──
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 60,
  },
  statusTitle: {
    fontSize: Theme.font.lg,
    fontWeight: '700',
    color: Theme.textSecondary,
  },
  statusText: {
    fontSize: Theme.font.sm,
    color: Theme.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    borderWidth: 1,
    borderColor: Theme.accentBlue + '30',
    marginTop: 8,
  },
  retryText: {
    color: Theme.accentBlue,
    fontSize: Theme.font.sm,
    fontWeight: '600',
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // ── Bus card ──
  busCard: {
    flexDirection: 'row',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  busCardLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  routeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: Theme.bgElevated,
    borderRadius: 14,
    borderWidth: 2,
    width: 62,
    height: 56,
  },
  routeNumber: {
    fontSize: Theme.font.lg,
    fontWeight: '800',
    color: Theme.text,
    letterSpacing: 0.5,
  },
  liveTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.accentGreen + '15',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveTagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Theme.accentGreen,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Theme.accentGreen,
    letterSpacing: 0.5,
  },
  busCardCenter: {
    flex: 1,
    gap: 4,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  distanceText: {
    fontSize: Theme.font.sm,
    fontWeight: '600',
    color: Theme.textMuted,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.textMuted,
    letterSpacing: 0.3,
  },
  occupancyBarBg: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.bgElevated,
    overflow: 'hidden',
  },
  occupancyBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  reliDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  busCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
