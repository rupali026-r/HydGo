// ── Intelligence Tooltip Modal ──────────────────────────────────────────────
// Explains backend intelligence metrics to users.
// "What does confidence mean?" tap-to-open modal.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

interface TooltipEntry {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  example: string;
  color: string;
}

const ENTRIES: TooltipEntry[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Confidence',
    description:
      'How certain we are about this bus\'s reported position and ETA. Higher confidence means more GPS data points and recent updates.',
    example: '90% = GPS updated < 30s ago',
    color: Theme.confidenceHigh,
  },
  {
    icon: 'timer-outline',
    title: 'Reliability',
    description:
      'Historical on-time performance of this route. Based on hundreds of past trips and deviation from scheduled times.',
    example: 'HIGH = arrives within 2min of scheduled time',
    color: Theme.reliabilityHigh,
  },
  {
    icon: 'car-outline',
    title: 'Traffic Level',
    description:
      'Real-time road congestion affecting bus speed. Derived from actual bus speed vs expected speed on this segment.',
    example: 'Smooth = bus running at expected speed',
    color: Theme.trafficLow,
  },
  {
    icon: 'people-outline',
    title: 'Occupancy',
    description:
      'Current passenger load percentage. GREEN means plenty of seats, RED means standing room only or full.',
    example: 'LOW = under 40% capacity',
    color: Theme.occupancyLow,
  },
];

interface IntelligenceTooltipProps {
  trigger?: React.ReactNode;
}

export function IntelligenceTooltip({ trigger }: IntelligenceTooltipProps) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <>
      <Pressable onPress={open} hitSlop={8}>
        {trigger ?? (
          <View style={styles.triggerButton}>
            <Ionicons name="information-circle-outline" size={16} color={Theme.textTertiary} />
          </View>
        )}
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Intelligence Metrics</Text>
              <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Theme.textTertiary} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              HydGo uses real-time data to give you the smartest transit recommendations.
            </Text>

            {/* Entries */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.entries}
            >
              {ENTRIES.map((entry, i) => (
                <View key={entry.title} style={styles.entry}>
                  <View style={[styles.iconCircle, { backgroundColor: entry.color + '18' }]}>
                    <Ionicons name={entry.icon} size={20} color={entry.color} />
                  </View>
                  <View style={styles.entryContent}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryDesc}>{entry.description}</Text>
                    <View style={styles.exampleRow}>
                      <Text style={styles.exampleLabel}>Example: </Text>
                      <Text style={styles.exampleValue}>{entry.example}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.footer}>
              Data updates in real time via live tracking.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Inline Confidence Dot ──────────────────────────────────────────────────
// Solid dot for high confidence, faded for low. Tap opens tooltip.

interface ConfidenceDotProps {
  confidence: number;
  size?: number;
  showLabel?: boolean;
}

export function ConfidenceDot({ confidence, size = 8, showLabel = false }: ConfidenceDotProps) {
  const label = confidence >= 0.8 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW';
  const color =
    label === 'HIGH'
      ? Theme.confidenceHigh
      : label === 'MEDIUM'
        ? Theme.confidenceMedium
        : Theme.confidenceLow;
  const opacity = confidence >= 0.7 ? 1 : confidence >= 0.5 ? 0.6 : 0.3;

  return (
    <View style={dotStyles.row}>
      <View
        style={[
          dotStyles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity,
          },
        ]}
      />
      {showLabel && (
        <Text style={[dotStyles.label, { color }]}>{Math.round(confidence * 100)}%</Text>
      )}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: {},
  label: { fontSize: Theme.font.xs, fontWeight: '700' },
});

const styles = StyleSheet.create({
  triggerButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: Theme.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
    ...Theme.shadowHeavy,
  } as any,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    color: Theme.text,
    fontSize: Theme.font.xl,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: Theme.textTertiary,
    fontSize: Theme.font.md,
    lineHeight: 18,
    marginBottom: 20,
  },
  entries: {
    gap: 16,
  },
  entry: {
    flexDirection: 'row',
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryContent: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '700',
  },
  entryDesc: {
    color: Theme.textSecondary,
    fontSize: Theme.font.md,
    lineHeight: 18,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  exampleLabel: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    fontWeight: '500',
  },
  exampleValue: {
    color: Theme.textTertiary,
    fontSize: Theme.font.sm,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  footer: {
    color: Theme.textDim,
    fontSize: Theme.font.sm,
    textAlign: 'center',
    marginTop: 20,
  },
});
