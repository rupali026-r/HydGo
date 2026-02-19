import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, StatusBar } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '../../../lib/auth-context';
import { Theme } from '../../../constants/theme';
import { usePassengerSocket } from '../../../passenger/hooks/usePassengerSocket';
import { useGeoLocation } from '../../../passenger/hooks/useGeoLocation';
import { PremiumMapView } from '../../../passenger/components/PremiumMapView';
import { ConnectionBanner } from '../../../passenger/components/ConnectionBanner';

export default function GuestMapScreen() {
  const { logout } = useAuth();

  // Connect socket for live bus data (guest mode — read-only)
  usePassengerSocket();
  useGeoLocation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.bg} />

      {/* Full-screen map with live bus markers */}
      <PremiumMapView onBusPress={() => {}} />

      {/* Connection banner */}
      <View style={styles.bannerOverlay}>
        <ConnectionBanner />
      </View>

      {/* Guest overlay banner */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.guestBanner}>
        <Text style={styles.guestText}>Guest Mode — Sign in for full features</Text>
        <Pressable onPress={logout} style={styles.signInBtn}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  bannerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 72 : 112,
    left: 16,
    right: 16,
    zIndex: 300,
  },
  guestBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 32 : 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    zIndex: 200,
  },
  guestText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  signInBtn: {
    backgroundColor: Theme.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginLeft: 12,
  },
  signInText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
