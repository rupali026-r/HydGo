// ── Push Notifications Hook ─────────────────────────────────────────────────
// Manages Expo Push Notification setup and local notification triggers.
// Only triggers when confidence >= 0.6.

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { usePassengerStore } from '../store/passengerStore';

const CONFIDENCE_THRESHOLD = 0.6;

// Try to import expo-notifications (may not be installed)
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // Not available
}

export function useNotifications() {
  const permissionRef = useRef(false);
  const addNotification = usePassengerStore((s) => s.addNotification);

  // Request permissions on mount
  useEffect(() => {
    if (!Notifications) return;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Web notifications
          if ('Notification' in window) {
            const result = await window.Notification.requestPermission();
            permissionRef.current = result === 'granted';
          }
        } else {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          permissionRef.current = finalStatus === 'granted';

          // Configure notification channel (Android)
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('hydgo-transit', {
              name: 'Transit Updates',
              importance: Notifications.AndroidImportance?.HIGH ?? 4,
              vibrationPattern: [0, 250, 250, 250],
            });
          }
        }
      } catch {
        // Permissions not available
      }
    })();
  }, []);

  const sendLocalNotification = useCallback(
    async (title: string, body: string, confidence?: number) => {
      // Only trigger if confidence meets threshold (or not provided)
      if (confidence != null && confidence < CONFIDENCE_THRESHOLD) return;

      // Store in-app notification
      addNotification({
        id: `notif-${Date.now()}`,
        type: 'bus_arriving',
        title,
        body,
        timestamp: Date.now(),
        read: false,
      });

      if (!Notifications || !permissionRef.current) return;

      try {
        if (Platform.OS === 'web' && 'Notification' in window) {
          new window.Notification(title, { body, icon: '/favicon.png' });
        } else {
          await Notifications.scheduleNotificationAsync({
            content: { title, body, sound: 'default' },
            trigger: null, // Immediate
          });
        }
      } catch {
        // Notification failed
      }
    },
    [addNotification],
  );

  const notifyBusArriving = useCallback(
    (routeNumber: string, minutes: number, confidence?: number) => {
      sendLocalNotification(
        'Bus Arriving',
        `${routeNumber} arriving in ${minutes} minutes.`,
        confidence,
      );
    },
    [sendLocalNotification],
  );

  const notifyBusDelayed = useCallback(
    (routeNumber: string, delayMinutes: number, confidence?: number) => {
      sendLocalNotification(
        'Bus Delayed',
        `${routeNumber} delayed by ${delayMinutes} minutes.`,
        confidence,
      );
    },
    [sendLocalNotification],
  );

  return {
    sendLocalNotification,
    notifyBusArriving,
    notifyBusDelayed,
  };
}
