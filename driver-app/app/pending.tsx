/**
 * HydGo Driver — Pending Approval Screen
 * Connects to socket for real-time approval events.
 * Auto-polls GET /api/drivers/profile every 10s as fallback.
 * When approved=true → redirects to /dashboard via auth-context.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '../lib/auth-context';
import { useDriverSocket } from '../hooks/useDriverSocket';
import { Colors, Font, Radius } from '../constants/theme';

export default function PendingScreen() {
  const { logout, refreshProfile, driver } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socket = useDriverSocket();

  // Connect socket for real-time approval notification
  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-poll every 10s as fallback
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refreshProfile();
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshProfile]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        {/* Clock icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⏳</Text>
        </View>

        <Text style={styles.title}>Awaiting Approval</Text>
        <Text style={styles.subtitle}>
          Your driver application is under review by administration.
        </Text>
        <Text style={styles.subtitle}>
          You will be redirected automatically once approved.
        </Text>

        <ActivityIndicator
          color={Colors.textMuted}
          size="small"
          style={{ marginTop: 24 }}
        />

        <Text style={styles.pollHint}>Checking status...</Text>

        {/* Logout */}
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Font.xxl,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Font.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  pollHint: {
    color: Colors.textDim,
    fontSize: Font.sm,
    marginTop: 8,
  },
  logoutBtn: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: Colors.ctaSecondaryBorder,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: {
    color: Colors.textPrimary,
    fontSize: Font.base,
    fontWeight: '600',
  },
});
