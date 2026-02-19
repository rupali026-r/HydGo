// ── Profile Screen ──────────────────────────────────────────────────────────
// User profile with saved stops, favorite routes, settings, logout.
// Tab-native layout — no back button.

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { usePassengerStore } from '../store/passengerStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  icon: IoniconsName;
  label: string;
  sub: string;
  color: string;
  onPress: () => void;
}

export default function Profile() {
  const router = useRouter();
  const { logout } = useAuth();

  const savedStops = usePassengerStore((s) => s.savedStops);
  const favoriteRoutes = usePassengerStore((s) => s.favoriteRoutes);
  const removeSavedStop = usePassengerStore((s) => s.removeSavedStop);
  const removeFavoriteRoute = usePassengerStore((s) => s.removeFavoriteRoute);
  const journeyHistory = usePassengerStore((s) => s.journeyHistory);

  const totalJourneys = journeyHistory.length;
  const avgWait =
    totalJourneys > 0
      ? Math.round(
          journeyHistory.reduce((sum, j) => sum + j.waitTimeMinutes, 0) / totalJourneys,
        )
      : 0;

  const menuItems: MenuItem[] = [
    {
      icon: 'time-outline',
      label: 'My Journeys',
      sub: `${totalJourneys} trips completed`,
      color: Theme.accent,
      onPress: () => router.push('/(app)/passenger/journeys' as any),
    },
    {
      icon: 'location-outline',
      label: 'Saved Locations',
      sub: `${savedStops.length} places saved`,
      color: '#10B981',
      onPress: () => {},
    },
    {
      icon: 'heart-outline',
      label: 'Favorite Routes',
      sub: `${favoriteRoutes.length} routes saved`,
      color: '#EF4444',
      onPress: () => {},
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      sub: 'Alerts & preferences',
      color: '#F59E0B',
      onPress: () => {},
    },
    {
      icon: 'settings-outline',
      label: 'Settings',
      sub: 'Map, data, privacy',
      color: '#6366F1',
      onPress: () => {},
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={styles.headerTitle}>Profile</Text>

      {/* Avatar & Name Card */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={36} color={Theme.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>Passenger</Text>
          <Text style={styles.userSub}>
            {totalJourneys} journeys · {avgWait} min avg wait
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn}>
          <Ionicons name="create-outline" size={18} color={Theme.accent} />
        </TouchableOpacity>
      </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalJourneys}</Text>
            <Text style={styles.statLabel}>Journeys</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{savedStops.length}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{favoriteRoutes.length}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
      </View>

      {/* Menu Items */}
      {menuItems.map((item, i) => (
        <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
          <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuSub}>{item.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Theme.textMuted} />
        </TouchableOpacity>
      ))}

      {/* Saved Stops (inline preview) */}
      {savedStops.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Saved Stops</Text>
          {savedStops.slice(0, 3).map((stop) => (
            <View key={stop.id} style={styles.savedItem}>
              <Ionicons name="location" size={16} color={Theme.accent} />
              <Text style={styles.savedName} numberOfLines={1}>{stop.name}</Text>
              <TouchableOpacity onPress={() => removeSavedStop(stop.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        activeOpacity={0.7}
        onPress={() => {
          if (Platform.OS === 'web') {
            // window.confirm works reliably on web; Alert.alert callbacks do not
            if (window.confirm('Are you sure you want to log out?')) logout();
          } else {
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: logout },
            ]);
          }
        }}
      >
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>HydGo v2.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  content: {
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: Theme.font.xxl,
    fontWeight: '700',
    color: Theme.text,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 20,
    marginBottom: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.border,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.text,
  },
  userSub: {
    fontSize: 12,
    color: Theme.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.text,
  },
  statLabel: {
    fontSize: 10,
    color: Theme.textMuted,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.text,
  },
  menuSub: {
    fontSize: 11,
    color: Theme.textMuted,
    marginTop: 2,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    padding: 12,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  savedName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Theme.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: Theme.radiusSm,
    backgroundColor: '#EF444410',
    borderWidth: 1,
    borderColor: '#EF444425',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    color: Theme.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
});
