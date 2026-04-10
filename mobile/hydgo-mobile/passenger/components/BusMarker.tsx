// ── Bus Marker Component ────────────────────────────────────────────────────
// Renders a single bus marker on the map (React Native fallback).
// DOM markers are used on web (in MapViewLayer). This is for native only.
// Green border = live driver. Gray border = scheduled (simulated).

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';
import type { BusState } from '../types';

// Live driver = green, scheduled = gray
const LIVE_COLOR = '#22c55e';
const SIM_COLOR = '#4B5563';

interface BusMarkerProps {
  bus: BusState;
  isSelected: boolean;
  onPress: (busId: string) => void;
}

function BusMarkerInner({ bus, isSelected, onPress }: BusMarkerProps) {
  const isLive = bus.isLiveDriver === true || bus.isSimulated === false;
  const borderColor = isLive ? LIVE_COLOR : SIM_COLOR;
  const containerScale = isLive ? 1.0 : 0.85; // Simulated markers are smaller

  return (
    <Pressable onPress={() => onPress(bus.id)} style={styles.container}>
      <View
        style={[
          styles.marker,
          isSelected && styles.markerSelected,
          { borderColor, transform: [{ scale: containerScale }] },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: borderColor }]} />
        <Text style={[styles.route, !isLive && styles.routeMuted]} numberOfLines={1}>
          {bus.routeNumber ?? '---'}
        </Text>
        
        {/* LIVE Badge */}
        {isLive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
      </View>
      {bus.eta && (
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{bus.eta.formattedETA}</Text>
        </View>
      )}
      {/* Near stop indicator */}
      {bus.nearStop?.arriving && (
        <View style={styles.arrivingBadge}>
          <Text style={styles.arrivingText}>Arriving</Text>
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
    prev.bus.isSimulated === next.bus.isSimulated &&
    prev.bus.isLiveDriver === next.bus.isLiveDriver &&
    prev.bus.nearStop?.arriving === next.bus.nearStop?.arriving &&
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
    // Note: overriding transform here if selected
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
  routeMuted: {
    color: '#9CA3AF',
  },
  liveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  liveBadgeText: {
    color: '#22c55e',
    fontSize: 8,
    fontWeight: '800',
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
  arrivingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  arrivingText: {
    color: '#f59e0b',
    fontSize: 8,
    fontWeight: '700',
  },
});
