// ── Route Card ──────────────────────────────────────────────────────────────
// Card for the Directions screen showing a route option.
// Shows: route number, transfer info, duration, walking distance,
// reliability badge, traffic level, confidence indicator.

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, CONFIDENCE_COLORS, TRAFFIC_COLORS } from '../../constants/theme';
import { ReliabilityBadge } from './ReliabilityBadge';
import { TrafficIndicator } from './TrafficIndicator';
import type { DirectionsRoute } from '../types';

interface RouteCardProps {
  route: DirectionsRoute;
  onPress: () => void;
  isSelected?: boolean;
}

function RouteCardInner({ route, onPress, isSelected }: RouteCardProps) {
  const confColor = CONFIDENCE_COLORS[
    route.confidence >= 0.8 ? 'HIGH' : route.confidence >= 0.6 ? 'MEDIUM' : 'LOW'
  ];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      {/* Top row: route number + duration */}
      <View style={styles.topRow}>
        <View style={styles.routeBadge}>
          <Ionicons name="bus" size={14} color={Theme.text} />
          <Text style={styles.routeNumber}>{route.routeNumber}</Text>
        </View>

        {route.transfers.length > 0 && (
          <View style={styles.transferBadge}>
            <Ionicons name="swap-horizontal" size={12} color={Theme.textTertiary} />
            <Text style={styles.transferText}>
              {route.transfers.length} transfer{route.transfers.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <View style={styles.durationBadge}>
          <Text style={styles.durationValue}>{route.totalDurationMinutes}</Text>
          <Text style={styles.durationUnit}>min</Text>
        </View>
      </View>

      {/* Route name */}
      <Text style={styles.routeName} numberOfLines={1}>{route.routeName}</Text>

      {/* Badges row: reliability + traffic + confidence + walking */}
      <View style={styles.badgesRow}>
        <ReliabilityBadge label={route.reliability.label} compact />
        <TrafficIndicator level={route.trafficLevel} compact />
        <View style={styles.confidenceBadge}>
          <View style={[styles.confDot, { backgroundColor: confColor }]} />
          <Text style={[styles.confText, { color: confColor }]}>
            {Math.round(route.confidence * 100)}%
          </Text>
        </View>
      </View>

      {/* Bottom row: walking + first bus ETA */}
      <View style={styles.bottomRow}>
        {route.walkingDistanceMeters > 0 && (
          <View style={styles.walkRow}>
            <Ionicons name="walk-outline" size={12} color={Theme.textMuted} />
            <Text style={styles.walkText}>
              {route.walkingDistanceMeters < 1000
                ? `${Math.round(route.walkingDistanceMeters)}m`
                : `${(route.walkingDistanceMeters / 1000).toFixed(1)}km`} walk
            </Text>
          </View>
        )}
        {route.firstBusEta != null && (
          <View style={styles.firstBus}>
            <Ionicons name="time-outline" size={12} color={Theme.textTertiary} />
            <Text style={styles.firstBusText}>
              First bus in {route.firstBusEta} min
            </Text>
          </View>
        )}
      </View>

      {/* Transfer details */}
      {route.transfers.length > 0 && (
        <View style={styles.transferDetails}>
          {route.transfers.map((t, i) => (
            <View key={i} style={styles.transferRow}>
              <Ionicons name="git-branch-outline" size={12} color={Theme.textDim} />
              <Text style={styles.transferDetail}>
                {t.fromRoute} → {t.toRoute} at {t.atStop}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export const RouteCard = memo(RouteCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cardSelected: {
    borderColor: Theme.text,
    borderWidth: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  routeNumber: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Theme.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  transferText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.xs,
    fontWeight: '500',
  },
  durationBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  durationValue: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  durationUnit: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  routeName: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  confDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  confText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walkText: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  firstBus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  firstBusText: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  transferDetails: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transferDetail: {
    color: Theme.textDim,
    fontSize: Theme.font.sm,
  },
});
