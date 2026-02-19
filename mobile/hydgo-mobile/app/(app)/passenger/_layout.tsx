// ── Passenger Tab Layout ────────────────────────────────────────────────────
// Premium bottom tab navigation with glass effect.
// Tabs: Home (Map) | Routes | Wallet | Support | Profile
// The map stays mounted across tab switches — no re-render.

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../../constants/theme';

const TAB_ICON: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  home:    { active: 'map',          inactive: 'map-outline' },
  routes:  { active: 'bus',          inactive: 'bus-outline' },
  wallet:  { active: 'wallet',       inactive: 'wallet-outline' },
  support: { active: 'chatbubbles',  inactive: 'chatbubbles-outline' },
  profile: { active: 'person',       inactive: 'person-outline' },
};

export default function PassengerTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#666666',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICON.home.active : TAB_ICON.home.inactive}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Routes',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? TAB_ICON.routes.active : TAB_ICON.routes.inactive}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? TAB_ICON.wallet.active : TAB_ICON.wallet.inactive}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? TAB_ICON.support.active : TAB_ICON.support.inactive}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? TAB_ICON.profile.active : TAB_ICON.profile.inactive}
              size={22}
              color={color}
            />
          ),
        }}
      />
      {/* Hidden screens accessible via navigation but not shown in tabs */}
      <Tabs.Screen name="directions" options={{ href: null }} />
      <Tabs.Screen name="journeys" options={{ href: null }} />
      <Tabs.Screen name="livebuses" options={{ href: null }} />
      <Tabs.Screen name="tracking" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(17,17,17,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    height: Platform.OS === 'web' ? 76 : 80,
    paddingBottom: Platform.OS === 'web' ? 10 : 24,
    paddingTop: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 20,
    boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
    overflow: 'visible',
  } as any,
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
    marginBottom: 0,
  },
  tabItem: {
    paddingTop: 4,
    paddingBottom: 2,
  },
});
