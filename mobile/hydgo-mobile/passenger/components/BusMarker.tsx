// ── Bus Marker Component ────────────────────────────────────────────────────
// Renders a single bus marker on the map (React Native fallback).
// DOM markers are used on web (in MapViewLayer). This is for native only.

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Theme, OCCUPANCY_COLORS } from '../../constants/theme';
import type { BusState } from '../types';

interface BusMarkerProps {
  bus: BusState;
  isSelected: boolean;
  onPress: (busId: string) => void;
}

function BusMarkerInner({ bus, isSelected, onPress }: BusMarkerProps) {
  const color = OCCUPANCY_COLORS[bus.occupancy.level];

  return (
    <Pressable onPress={() => onPress(bus.id)} style={styles.container}>
      <View
        style={[
          styles.marker,
          isSelected && styles.markerSelected,
          { borderColor: color },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.route} numberOfLines={1}>
          {bus.routeNumber ?? '---'}
        </Text>
      </View>
      {bus.eta && (
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{bus.eta.formattedETA}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const BusMarker = memo(BusMarkerInner, (prev, next) => {
  return (
    prev.bus.id === next.bus.id &&
    prev.bus.latitude === next.bus.latitude &&
    prev.bus.longitude === next.bus.longitude &&
    prev.bus.occupancy.level === next.bus.occupancy.level &&
    prev.bus.eta?.formattedETA === next.bus.eta?.formattedETA &&
    prev.isSelected === next.isSelected
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  markerSelected: {
    backgroundColor: Theme.bgElevated,
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
    boxShadow: '0px 2px 8px rgba(255, 255, 255, 0.12)',
    elevation: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  route: {
    color: Theme.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  etaBadge: {
    backgroundColor: Theme.bg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  etaText: {
    color: Theme.text,
    fontSize: 9,
    fontWeight: '600',
  },
});
