// ── Bus Card Component ──────────────────────────────────────────────────────
// Premium compact card for bottom sheet bus list.
// Shows route, ETA, confidence, occupancy, traffic, reliability.

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, OCCUPANCY_COLORS, TRAFFIC_COLORS, CONFIDENCE_COLORS } from '../../constants/theme';
import { OccupancyBar } from './OccupancyBar';
import { ReliabilityBadge } from './ReliabilityBadge';
import type { BusState, OccupancyLevel, TrafficLevel } from '../types';
import { formatDistance } from '../utils/geo';

const OCCUPANCY_LABELS: Record<OccupancyLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'Busy',
  FULL: 'Full',
};

const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  LOW: 'Smooth',
  MODERATE: 'Moderate',
  HIGH: 'Heavy',
};

interface BusCardProps {
  bus: BusState;
  onPress: (busId: string) => void;
  compact?: boolean;
}

function BusCardInner({ bus, onPress, compact }: BusCardProps) {
  const occColor = OCCUPANCY_COLORS[bus.occupancy.level];
  const trafficColor = bus.trafficLevel ? TRAFFIC_COLORS[bus.trafficLevel] : undefined;
  const confVal = bus.confidence ?? 0.7;
  const confLabel = confVal >= 0.8 ? 'HIGH' : confVal >= 0.6 ? 'MEDIUM' : 'LOW';
  const confColor = CONFIDENCE_COLORS[confLabel];

  return (
    <Pressable onPress={() => onPress(bus.id)} style={[styles.card, compact && styles.cardCompact]}>
      {/* Route badge */}
      <View style={styles.routeBadge}>
        <Ionicons name="bus" size={14} color={Theme.text} />
        <Text style={styles.routeNumber}>{bus.routeNumber ?? '---'}</Text>
      </View>

      {/* Info section */}
      <View style={styles.info}>
        <Text style={styles.routeName} numberOfLines={1}>
          {bus.routeName ?? 'Unknown Route'}
        </Text>
        <View style={styles.metaRow}>
          {bus.distanceMeters != null && (
            <Text style={styles.distance}>{formatDistance(bus.distanceMeters)}</Text>
          )}
          {bus.trafficLevel && bus.trafficLevel !== 'LOW' && trafficColor && (
            <View style={styles.trafficRow}>
              <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
              <Text style={[styles.trafficText, { color: trafficColor }]}>
                {TRAFFIC_LABELS[bus.trafficLevel]}
              </Text>
            </View>
          )}
          {bus.reliability && (
            <ReliabilityBadge label={bus.reliability.label} compact />
          )}
        </View>
      </View>

      {/* Badges column */}
      <View style={styles.badges}>
        {bus.eta && (
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>{bus.eta.formattedETA}</Text>
            <View style={[styles.confidenceDot, { backgroundColor: confColor }]} />
          </View>
        )}
        <View style={[styles.occBadge, { backgroundColor: occColor + '18', borderColor: occColor + '40' }]}>
          <View style={[styles.occDot, { backgroundColor: occColor }]} />
          <Text style={[styles.occText, { color: occColor }]}>
            {OCCUPANCY_LABELS[bus.occupancy.level]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const BusCard = memo(BusCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: Theme.space.md,
    gap: 10,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cardCompact: {
    padding: Theme.space.sm,
    borderRadius: Theme.radiusSm,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  routeNumber: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  routeName: {
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  distance: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trafficDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  trafficText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  etaBadge: {
    backgroundColor: Theme.text,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    color: Theme.bg,
    fontSize: Theme.font.md,
    fontWeight: '700',
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  occBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  occDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  occText: {
    fontSize: Theme.font.xs,
    fontWeight: '600',
  },
});
