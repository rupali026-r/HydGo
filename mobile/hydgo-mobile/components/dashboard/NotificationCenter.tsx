import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { api } from '../../lib/api';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
  onCountChange: (count: number) => void;
}

export function NotificationCenter({ visible, onClose, onCountChange }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const response = await api.get('/admin/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
        const unreadCount = response.data.data.filter((n: Notification) => !n.read).length;
        onCountChange(unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      const unreadCount = notifications.filter((n) => !n.read && n.id !== id).length;
      onCountChange(unreadCount);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/admin/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onCountChange(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  if (!visible) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'DRIVER_APPLY': return 'person-add-outline';
      case 'DRIVER_APPROVED': return 'checkmark-circle-outline';
      case 'DRIVER_REJECTED': return 'close-circle-outline';
      case 'DRIVER_DISCONNECT': return 'wifi-outline';
      case 'HIGH_DELAY': return 'time-outline';
      case 'COMPLAINT': return 'warning-outline';
      case 'SYSTEM_ALERT': return 'alert-circle-outline';
      default: return 'notifications-outline';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'DRIVER_APPLY': return '#2196F3';
      case 'DRIVER_APPROVED': return '#4CAF50';
      case 'DRIVER_REJECTED': return '#ff4444';
      case 'DRIVER_DISCONNECT': return '#FF9800';
      case 'HIGH_DELAY': return '#FFC107';
      case 'COMPLAINT': return '#ff4444';
      case 'SYSTEM_ALERT': return '#9C27B0';
      default: return '#666';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const groupNotifications = () => {
    const today: Notification[] = [];
    const earlier: Notification[] = [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    notifications.forEach((n) => {
      const notifDate = new Date(n.createdAt);
      if (notifDate >= todayStart) {
        today.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, earlier };
  };

  const { today, earlier } = groupNotifications();

  return (
    <Animated.View
      entering={FadeInRight.duration(200)}
      exiting={FadeOutRight.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        backgroundColor: '#000',
        borderLeftWidth: 1,
        borderLeftColor: '#1A1A1A',
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#1A1A1A',
        }}
      >
        <View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Notifications</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
            {notifications.filter((n) => !n.read).length} unread
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => fetchNotifications(true)} hitSlop={8}>
            <Ionicons name="refresh" size={20} color="#888" />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#888" />
          </Pressable>
        </View>
      </View>

      {/* Mark all as read */}
      {notifications.some((n) => !n.read) && (
        <Pressable
          onPress={markAllAsRead}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#1A1A1A',
          }}
        >
          <Text style={{ color: '#2196F3', fontSize: 13, fontWeight: '600' }}>
            Mark all as read
          </Text>
        </Pressable>
      )}

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={48} color="#333" />
            <Text style={{ color: '#666', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
              No notifications yet
            </Text>
          </View>
        ) : (
          <>
            {/* Today */}
            {today.length > 0 && (
              <>
                <Text
                  style={{
                    color: '#888',
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  Today
                </Text>
                {today.map((notification) => (
                  <Pressable
                    key={notification.id}
                    onPress={() => !notification.read && markAsRead(notification.id)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: '#0A0A0A',
                      backgroundColor: notification.read ? 'transparent' : '#0A0A0A',
                      flexDirection: 'row',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#111',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={getIcon(notification.type)}
                        size={20}
                        color={getIconColor(notification.type)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: notification.read ? '500' : '700',
                            flex: 1,
                          }}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#2196F3',
                              marginTop: 4,
                              marginLeft: 8,
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          color: '#888',
                          fontSize: 12,
                          lineHeight: 16,
                          marginBottom: 4,
                        }}
                        numberOfLines={2}
                      >
                        {notification.message}
                      </Text>
                      <Text style={{ color: '#555', fontSize: 11 }}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* Earlier */}
            {earlier.length > 0 && (
              <>
                <Text
                  style={{
                    color: '#888',
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  Earlier
                </Text>
                {earlier.map((notification) => (
                  <Pressable
                    key={notification.id}
                    onPress={() => !notification.read && markAsRead(notification.id)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: '#0A0A0A',
                      backgroundColor: notification.read ? 'transparent' : '#0A0A0A',
                      flexDirection: 'row',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#111',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={getIcon(notification.type)}
                        size={20}
                        color={getIconColor(notification.type)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: notification.read ? '500' : '700',
                            flex: 1,
                          }}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#2196F3',
                              marginTop: 4,
                              marginLeft: 8,
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          color: '#888',
                          fontSize: 12,
                          lineHeight: 16,
                          marginBottom: 4,
                        }}
                        numberOfLines={2}
                      >
                        {notification.message}
                      </Text>
                      <Text style={{ color: '#555', fontSize: 11 }}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}
