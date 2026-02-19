// ── Notification Bell ────────────────────────────────────────────────────────
// Floating notification bell button with unread badge.
// Toggles open a notification panel dropdown.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Pressable, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import type { PassengerNotification, NotificationType } from '../types';

const ICON_MAP: Record<NotificationType, React.ComponentProps<typeof Ionicons>['name']> = {
  bus_arriving: 'bus',
  bus_delayed: 'time',
  journey_started: 'play-circle',
  journey_completed: 'checkmark-circle',
};

const COLOR_MAP: Record<NotificationType, string> = {
  bus_arriving: '#10B981',
  bus_delayed: '#F59E0B',
  journey_started: '#6366F1',
  journey_completed: '#10B981',
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = usePassengerStore((s) => s.notifications);
  const markNotificationRead = usePassengerStore((s) => s.markNotificationRead);
  const clearNotifications = usePassengerStore((s) => s.clearNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handlePress = useCallback(
    (n: PassengerNotification) => {
      if (!n.read) markNotificationRead(n.id);
    },
    [markNotificationRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: PassengerNotification }) => (
      <Pressable
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: COLOR_MAP[item.type] + '18' }]}>
          <Ionicons name={ICON_MAP[item.type]} size={16} color={COLOR_MAP[item.type]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.notifTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.notifTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    ),
    [handlePress],
  );

  return (
    <View style={styles.container}>
      {/* Bell button */}
      <TouchableOpacity
        style={styles.bellBtn}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Ionicons name={open ? 'notifications' : 'notifications-outline'} size={20} color={Theme.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Panel */}
      {open && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearNotifications}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={28} color={Theme.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubText}>
                You'll see alerts about bus arrivals, delays, and journey updates here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications.slice(0, 20)}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 500,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  panel: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: 320,
    backgroundColor: Theme.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.border,
    overflow: 'hidden',
    ...Theme.shadow,
  } as any,
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.text,
  },
  clearText: {
    color: Theme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border + '40',
  },
  notifUnread: {
    backgroundColor: Theme.accent + '08',
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifTitle: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  notifBody: {
    color: Theme.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    color: Theme.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.accent,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    color: Theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubText: {
    color: Theme.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
