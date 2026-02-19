// ── Journey Mode Engine ─────────────────────────────────────────────────────
// Uber-style trip experience with:
// - Vertical stop progression timeline
// - Highlighted current stop
// - Live bus position indicator
// - Remaining stops count
// - Progress bar along route
// - Push notification triggers (1 stop away, destination reached)
// - Vibrate device on arrival (mobile)
// - Exit journey button
// - Journey state persists even if app minimized

import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme, TRAFFIC_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { AnimatedETA } from './AnimatedETA';
import { TrafficIndicator } from './TrafficIndicator';
import { OccupancyBar } from './OccupancyBar';
import { formatDistance } from '../utils/geo';
import type { StopInfo, ActiveJourney } from '../types';

const SPRING_CONFIG = { damping: 20, stiffness: 180, mass: 0.7 };

interface JourneyModeProps {
  onCancel: () => void;
}

export function JourneyMode({ onCancel }: JourneyModeProps) {
  const activeJourney = usePassengerStore((s) => s.activeJourney);
  const buses = usePassengerStore((s) => s.buses);
  const previewRoute = usePassengerStore((s) => s.previewRoute);
  const userLocation = usePassengerStore((s) => s.userLocation);

  const translateY = useSharedValue(500);
  const opacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const [notifiedOneStop, setNotifiedOneStop] = useState(false);
  const [notifiedArrival, setNotifiedArrival] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Slide in animation ──
  useEffect(() => {
    if (activeJourney) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(500, SPRING_CONFIG);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [!!activeJourney]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // ── Route stops from preview ──
  const routeStops = useMemo(() => {
    return previewRoute?.stops ?? [];
  }, [previewRoute?.stops]);

  // ── Current stop index estimation ──
  const currentStopIndex = useMemo(() => {
    if (!activeJourney || routeStops.length === 0) return 0;

    // Try to match by nextStopName
    if (activeJourney.nextStopName) {
      const idx = routeStops.findIndex(
        (s) => s.name === activeJourney.nextStopName,
      );
      if (idx >= 0) return Math.max(0, idx - 1);
    }

    // Fallback: estimate from ETA ratio
    const totalStops = routeStops.length;
    const fromIdx = routeStops.findIndex(
      (s) => s.id === activeJourney.fromStop.id,
    );
    const toIdx = activeJourney.toStop
      ? routeStops.findIndex((s) => s.id === activeJourney.toStop!.id)
      : totalStops - 1;

    if (fromIdx < 0) return 0;

    const range = Math.max(1, toIdx - fromIdx);
    const elapsed = Date.now() - activeJourney.startedAt;
    const totalEstMs = (activeJourney.destinationEtaMinutes ?? activeJourney.etaMinutes ?? 10) * 60 * 1000;
    const fraction = Math.min(1, elapsed / Math.max(1, totalEstMs));

    return Math.min(toIdx, fromIdx + Math.round(fraction * range));
  }, [activeJourney, routeStops]);

  // ── Remaining stops ──
  const remainingStops = useMemo(() => {
    if (!activeJourney || routeStops.length === 0) return 0;
    const toIdx = activeJourney.toStop
      ? routeStops.findIndex((s) => s.id === activeJourney.toStop!.id)
      : routeStops.length - 1;
    return Math.max(0, toIdx - currentStopIndex);
  }, [activeJourney, routeStops, currentStopIndex]);

  // ── Progress bar animation ──
  useEffect(() => {
    if (routeStops.length <= 1) return;
    const toIdx = activeJourney?.toStop
      ? routeStops.findIndex((s) => s.id === activeJourney.toStop!.id)
      : routeStops.length - 1;
    const fromIdx = routeStops.findIndex(
      (s) => s.id === activeJourney?.fromStop.id,
    );
    const range = Math.max(1, (toIdx < 0 ? routeStops.length - 1 : toIdx) - Math.max(0, fromIdx));
    const progress = Math.min(1, (currentStopIndex - Math.max(0, fromIdx)) / range);
    progressWidth.value = withTiming(progress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStopIndex, routeStops, activeJourney]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));

  // ── Notification triggers ──
  useEffect(() => {
    if (!activeJourney) return;

    // 1 stop away notification
    if (remainingStops === 1 && !notifiedOneStop) {
      setNotifiedOneStop(true);
      triggerNotification('Almost there!', 'Your stop is next.');
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate([0, 200, 100, 200]); } catch {}
      }
    }

    // Destination reached
    if (remainingStops === 0 && !notifiedArrival) {
      setNotifiedArrival(true);
      triggerNotification('You\'ve arrived!', 'You have reached your destination.');
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate([0, 300, 100, 300, 100, 300]); } catch {}
      }
    }
  }, [remainingStops, notifiedOneStop, notifiedArrival, activeJourney]);

  // Reset notification state on new journey
  useEffect(() => {
    if (activeJourney) {
      setNotifiedOneStop(false);
      setNotifiedArrival(false);
    }
  }, [activeJourney?.id]);

  // Auto-scroll timeline to current stop
  useEffect(() => {
    if (scrollRef.current && currentStopIndex > 2) {
      scrollRef.current.scrollTo({
        y: Math.max(0, (currentStopIndex - 1) * 64),
        animated: true,
      });
    }
  }, [currentStopIndex]);

  if (!activeJourney) return null;

  const bus = buses.get(activeJourney.busId);

  const statusLabel =
    activeJourney.status === 'waiting'
      ? 'Waiting for bus'
      : activeJourney.status === 'boarding'
        ? 'Bus arriving!'
        : activeJourney.status === 'onboard'
          ? 'On board'
          : 'Tracking';

  const statusColor =
    activeJourney.status === 'boarding'
      ? Theme.accentGreen
      : activeJourney.status === 'onboard'
        ? Theme.accentBlue
        : Theme.text;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.panel}>
        {/* ── Close / Back button ── */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
          <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Theme.textTertiary} />
          </Pressable>
        </View>

        {/* ── Header: Status + Route ── */}
        <View style={styles.headerRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
          <View style={styles.routeChip}>
            <Ionicons name="bus" size={12} color={Theme.text} />
            <Text style={styles.routeChipText}>
              {activeJourney.routeNumber}
            </Text>
          </View>
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, progressBarStyle]} />
        </View>

        {/* ── Stats row: ETA | Distance | Remaining stops ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <AnimatedETA minutes={activeJourney.etaMinutes} />
            <Text style={styles.statLabel}>Bus ETA</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {formatDistance(activeJourney.busDistanceMeters)}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{remainingStops}</Text>
            <Text style={styles.statLabel}>Stops left</Text>
          </View>

          {activeJourney.destinationEtaMinutes != null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>
                  {activeJourney.destinationEtaMinutes}m
                </Text>
                <Text style={styles.statLabel}>To dest.</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Intelligence row ── */}
        <View style={styles.intelRow}>
          {activeJourney.trafficLevel && (
            <TrafficIndicator level={activeJourney.trafficLevel} compact />
          )}
          {bus && (
            <OccupancyBar
              level={bus.occupancy.level}
              percent={bus.occupancy.percent}
              height={3}
              showLabel
            />
          )}
          {activeJourney.occupancyTrend && (
            <View style={styles.trendBadge}>
              <Ionicons
                name={
                  activeJourney.occupancyTrend === 'rising'
                    ? 'trending-up'
                    : activeJourney.occupancyTrend === 'falling'
                      ? 'trending-down'
                      : ('remove' as any)
                }
                size={12}
                color={Theme.textTertiary}
              />
              <Text style={styles.trendText}>
                {activeJourney.occupancyTrend === 'rising'
                  ? 'Filling up'
                  : activeJourney.occupancyTrend === 'falling'
                    ? 'Emptying'
                    : 'Stable'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stop Progression Timeline ── */}
        {routeStops.length > 0 && (
          <View style={styles.timelineSection}>
            <Text style={styles.timelineHeader}>Stop progression</Text>
            <ScrollView
              ref={scrollRef}
              style={styles.timelineScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {routeStops.map((stop, i) => {
                const isCurrent = i === currentStopIndex;
                const isPassed = i < currentStopIndex;
                const isDestination =
                  activeJourney.toStop?.id === stop.id;

                return (
                  <TimelineStop
                    key={stop.id}
                    stop={stop}
                    isCurrent={isCurrent}
                    isPassed={isPassed}
                    isDestination={isDestination}
                    isLast={i === routeStops.length - 1}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── From → To summary ── */}
        <View style={styles.routeSummary}>
          <View style={styles.routeDot} />
          <Text style={styles.fromText} numberOfLines={1}>
            {activeJourney.fromStop.name}
          </Text>
          {activeJourney.toStop && (
            <>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={Theme.textMuted}
              />
              <Text style={styles.toText} numberOfLines={1}>
                {activeJourney.toStop.name}
              </Text>
            </>
          )}
        </View>

        {/* ── Arrival notification indicator ── */}
        {(notifiedOneStop || notifiedArrival) && (
          <View style={styles.notificationBanner}>
            <Ionicons
              name={notifiedArrival ? 'checkmark-circle' : 'notifications'}
              size={14}
              color={notifiedArrival ? Theme.accentGreen : Theme.accentAmber}
            />
            <Text
              style={[
                styles.notificationText,
                {
                  color: notifiedArrival
                    ? Theme.accentGreen
                    : Theme.accentAmber,
                },
              ]}
            >
              {notifiedArrival
                ? 'You have arrived at your destination'
                : 'Your stop is next — get ready!'}
            </Text>
          </View>
        )}

        {/* ── Exit Journey button ── */}
        <Pressable onPress={onCancel} style={styles.exitBtn}>
          <Ionicons
            name="close-circle-outline"
            size={18}
            color={Theme.accentRed}
          />
          <Text style={styles.exitText}>Exit Journey</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ── Timeline Stop ──

interface TimelineStopProps {
  stop: StopInfo;
  isCurrent: boolean;
  isPassed: boolean;
  isDestination: boolean;
  isLast: boolean;
}

function TimelineStop({
  stop,
  isCurrent,
  isPassed,
  isDestination,
  isLast,
}: TimelineStopProps) {
  const dotColor = isCurrent
    ? Theme.accentBlue
    : isPassed
      ? Theme.accentGreen
      : isDestination
        ? Theme.accentRed
        : Theme.textDim;

  const textColor = isCurrent
    ? Theme.text
    : isPassed
      ? Theme.textTertiary
      : Theme.textMuted;

  return (
    <View style={timelineStyles.row}>
      {/* Dot */}
      <View style={timelineStyles.dotCol}>
        <View
          style={[
            timelineStyles.dot,
            {
              backgroundColor: dotColor,
              width: isCurrent ? 14 : 8,
              height: isCurrent ? 14 : 8,
              borderRadius: isCurrent ? 7 : 4,
              borderWidth: isCurrent ? 3 : 0,
              borderColor: isCurrent ? Theme.accentBlue + '40' : undefined,
            },
          ]}
        >
          {isCurrent && (
            <View style={timelineStyles.busIndicator}>
              <Ionicons name="bus" size={8} color={Theme.text} />
            </View>
          )}
        </View>
        {!isLast && (
          <View
            style={[
              timelineStyles.line,
              {
                backgroundColor: isPassed
                  ? Theme.accentGreen + '40'
                  : Theme.textDim + '30',
              },
            ]}
          />
        )}
      </View>

      {/* Label */}
      <View
        style={[
          timelineStyles.labelContainer,
          isCurrent && timelineStyles.currentLabel,
        ]}
      >
        <Text
          style={[
            timelineStyles.stopName,
            { color: textColor, fontWeight: isCurrent ? '700' : '400' },
          ]}
          numberOfLines={1}
        >
          {stop.name}
        </Text>
        {isDestination && (
          <View style={timelineStyles.destTag}>
            <Text style={timelineStyles.destTagText}>Destination</Text>
          </View>
        )}
        {isPassed && (
          <Ionicons
            name="checkmark"
            size={10}
            color={Theme.accentGreen}
          />
        )}
      </View>
    </View>
  );
}

// ── Notification trigger (web fallback) ──

function triggerNotification(title: string, body: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }
  // On native, useNotifications hook handles push notifications
}

// ── Timeline styles ──

const timelineStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 48,
  },
  dotCol: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    position: 'relative',
  },
  busIndicator: {
    position: 'absolute',
    top: -16,
    left: '50%' as any,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  labelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  currentLabel: {
    backgroundColor: Theme.accentBlue + '10',
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stopName: {
    fontSize: Theme.font.md,
    flex: 1,
  },
  destTag: {
    backgroundColor: Theme.accentRed + '18',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  destTagText: {
    color: Theme.accentRed,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

// ── Main styles ──

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 250,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center' as any,
        width: '100%',
      },
    }),
  } as any,
  panel: {
    backgroundColor: Theme.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: Platform.OS === 'web' ? 90 : 100,
    gap: 14,
    borderTopWidth: 1,
    borderColor: Theme.borderGlass,
    maxHeight: '80%',
    ...Theme.shadowHeavy,
  } as any,

  // ── Close button row ──
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.textDim,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: Theme.font.lg,
    fontWeight: '700',
    flex: 1,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routeChipText: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },

  // ── Progress bar ──
  progressBar: {
    height: 4,
    backgroundColor: Theme.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.accentBlue,
    borderRadius: 2,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Theme.border,
  },

  // ── Intel row ──
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },

  // ── Timeline section ──
  timelineSection: {
    gap: 8,
  },
  timelineHeader: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineScroll: {
    maxHeight: 200,
  },

  // ── Route summary ──
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    padding: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.accentBlue,
  },
  fromText: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '500',
    flex: 1,
  },
  toText: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    fontWeight: '500',
    flex: 1,
  },

  // ── Notification banner ──
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
  },
  notificationText: {
    fontSize: Theme.font.md,
    fontWeight: '600',
    flex: 1,
  },

  // ── Exit button ──
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Theme.radiusSm,
    borderWidth: 1,
    borderColor: Theme.accentRed + '40',
    backgroundColor: Theme.accentRed + '10',
    minHeight: Theme.touchMin,
  },
  exitText: {
    color: Theme.accentRed,
    fontSize: Theme.font.md,
    fontWeight: '600',
  },
});
