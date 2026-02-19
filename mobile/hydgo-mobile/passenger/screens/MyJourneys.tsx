// ── My Journeys Screen ──────────────────────────────────────────────────────
// Journey history list showing route, wait, duration, reliability, traffic.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Theme, RELIABILITY_COLORS, TRAFFIC_COLORS } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { AppHeader } from '../components/AppHeader';
import { goBack } from '../../lib/navigation';
import type { JourneyRecord } from '../types';

export default function MyJourneys() {
  const router = useRouter();
  const journeyHistory = usePassengerStore((s) => s.journeyHistory);

  const renderJourney = ({ item }: { item: JourneyRecord }) => {
    const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const timeStr = new Date(item.date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        {/* Top row: route badge + date */}
        <View style={styles.cardHeader}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.dateText}>{dateStr}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
        </View>

        {/* Route from → to */}
        <View style={styles.routeRow}>
          <View style={styles.dotColumn}>
            <View style={[styles.dot, { backgroundColor: Theme.accent }]} />
            <View style={styles.dotLine} />
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          </View>
          <View style={styles.stopsColumn}>
            <Text style={styles.stopName}>{item.fromStopName}</Text>
            <Text style={styles.stopName}>{item.toStopName ?? 'Unknown'}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={14} color={Theme.textSecondary} />
            <Text style={styles.statText}>
              {item.waitTimeMinutes} min wait
            </Text>
          </View>

          <View style={styles.stat}>
            <Ionicons name="speedometer-outline" size={14} color={Theme.textSecondary} />
            <Text style={styles.statText}>
              {item.travelDurationMinutes} min travel
            </Text>
          </View>

          {item.reliabilityExperienced && (
            <View style={styles.stat}>
              <View
                style={[
                  styles.reliabilityDot,
                  { backgroundColor: RELIABILITY_COLORS[item.reliabilityExperienced] },
                ]}
              />
              <Text style={styles.statText}>
                {item.reliabilityExperienced}
              </Text>
            </View>
          )}

          {item.trafficLevel && (
            <View style={styles.stat}>
              <View
                style={[
                  styles.trafficDot,
                  { backgroundColor: TRAFFIC_COLORS[item.trafficLevel] },
                ]}
              />
              <Text style={styles.statText}>{item.trafficLevel}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader title="My Journeys">
        <Text style={styles.headerCount}>{journeyHistory.length}</Text>
      </AppHeader>

      {journeyHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bus-outline" size={48} color={Theme.textMuted} />
          <Text style={styles.emptyTitle}>No journeys yet</Text>
          <Text style={styles.emptySub}>
            Start tracking a bus to record your first journey
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...journeyHistory].reverse()} // Most recent first
          renderItem={renderJourney}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

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
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.text,
    marginLeft: 12,
    flex: 1,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.textMuted,
    backgroundColor: Theme.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  routeBadge: {
    backgroundColor: Theme.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routeBadgeText: {
    color: Theme.bg,
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  dateText: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  timeText: {
    color: Theme.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  routeRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 12,
  },
  dotColumn: {
    alignItems: 'center',
    width: 12,
    paddingTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLine: {
    width: 2,
    flex: 1,
    backgroundColor: Theme.border,
    marginVertical: 4,
    minHeight: 16,
  },
  stopsColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stopName: {
    color: Theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    paddingTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: Theme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  reliabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trafficDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: Theme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySub: {
    color: Theme.textMuted,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },
});
