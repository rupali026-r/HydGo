// ── Premium Bottom Sheet ────────────────────────────────────────────────────
// Spring-based draggable bottom sheet using Reanimated v3.
// Collapsed: nearest stop card + horizontal smart suggestions
// Expanded: full bus list with sorting

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { sortBySuggestion } from '../utils/sort';
import { NearestStopCard } from './NearestStopHeader';
import { SmartSuggestionsRow } from './SmartSuggestions';
import { BusCard } from './BusCard';
import type { BusState } from '../types';

const COLLAPSED_HEIGHT = 220;
const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.7 };

interface BottomSheetProps {
  onBusPress: (busId: string) => void;
  onStopPress?: () => void;
}

export function BottomSheet({ onBusPress, onStopPress }: BottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const EXPANDED_HEIGHT = screenHeight * 0.72;

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const sheetExpanded = usePassengerStore((s) => s.sheetExpanded);
  const setSheetExpanded = usePassengerStore((s) => s.setSheetExpanded);
  const buses = usePassengerStore((s) => s.buses);
  const activeJourney = usePassengerStore((s) => s.activeJourney);

  const allBuses = useMemo(() => {
    const arr = Array.from(buses.values());
    return sortBySuggestion(arr);
  }, [buses]);

  const expand = useCallback(() => setSheetExpanded(true), [setSheetExpanded]);
  const collapse = useCallback(() => setSheetExpanded(false), [setSheetExpanded]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((e) => {
      const newY = context.value.y + e.translationY;
      const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      translateY.value = Math.max(-diff, Math.min(0, newY));
    })
    .onEnd((e) => {
      const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      const threshold = diff * 0.3;

      if (e.velocityY < -500 || translateY.value < -threshold) {
        translateY.value = withSpring(-diff, SPRING_CONFIG);
        runOnJS(expand)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(collapse)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: EXPANDED_HEIGHT,
  }));

  const handleToggle = useCallback(() => {
    const diff = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
    if (sheetExpanded) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      setSheetExpanded(false);
    } else {
      translateY.value = withSpring(-diff, SPRING_CONFIG);
      setSheetExpanded(true);
    }
  }, [sheetExpanded, EXPANDED_HEIGHT, setSheetExpanded]);

  // Hide bottom sheet during active journey
  if (activeJourney) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.sheet, animatedStyle, { bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) }]}>
        {/* Drag handle */}
        <Pressable onPress={handleToggle} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>

        {/* Collapsed content */}
        <View style={styles.collapsedContent}>
          <NearestStopCard onPress={onStopPress} />
          <SmartSuggestionsRow onBusPress={onBusPress} />
        </View>

        {/* Expanded content */}
        {sheetExpanded && (
          <ScrollView
            style={styles.expandedScroll}
            contentContainerStyle={styles.expandedContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="bus-outline" size={14} color={Theme.textTertiary} />
              <Text style={styles.sectionTitle}>All nearby buses ({allBuses.length})</Text>
            </View>
            {allBuses.map((bus) => (
              <BusCard key={bus.id} bus={bus} onPress={onBusPress} />
            ))}
            {allBuses.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={32} color={Theme.textDim} />
                <Text style={styles.emptyText}>No buses in range</Text>
                <Text style={styles.emptySubtext}>Buses will appear when nearby</Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Theme.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Theme.border,
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center' as any,
        width: '100%',
      },
    }),
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.borderSubtle,
  },
  collapsedContent: {
    paddingHorizontal: Theme.space.lg,
    gap: Theme.space.md,
  },
  expandedScroll: {
    flex: 1,
  },
  expandedContent: {
    paddingHorizontal: Theme.space.lg,
    paddingTop: Theme.space.md,
    gap: Theme.space.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: Theme.textMuted,
    fontSize: Theme.font.lg,
    fontWeight: '500',
  },
  emptySubtext: {
    color: Theme.textDim,
    fontSize: Theme.font.md,
  },
});
