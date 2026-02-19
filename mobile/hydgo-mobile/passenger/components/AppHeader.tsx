// ── App Header — Reusable screen header with back button ────────────────────
// Consistent header across all screens with back navigation,
// title, and optional right action.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

interface AppHeaderProps {
  /** Title text displayed in the center */
  title: string;
  /** Whether to show the back button (default: true) */
  showBack?: boolean;
  /** Right icon name from Ionicons */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Callback when right icon is pressed */
  onRightPress?: () => void;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Additional children on the right side */
  children?: React.ReactNode;
}

export function AppHeader({
  title,
  showBack = true,
  rightIcon,
  onRightPress,
  subtitle,
  children,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Left: Back button */}
      {showBack ? (
        <Pressable
          style={styles.iconBtn}
          onPress={() => goBack(router)}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={Theme.text} />
        </Pressable>
      ) : (
        <View style={styles.iconBtnSpacer} />
      )}

      {/* Center: Title + optional subtitle */}
      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Right: icon or children */}
      {rightIcon ? (
        <Pressable
          style={styles.iconBtn}
          onPress={onRightPress}
          hitSlop={12}
        >
          <Ionicons name={rightIcon} size={22} color={Theme.text} />
        </Pressable>
      ) : children ? (
        <View style={styles.rightSlot}>{children}</View>
      ) : (
        <View style={styles.iconBtnSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: Theme.bg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSpacer: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: Theme.font.xl,
    fontWeight: '700',
    color: Theme.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.font.xs,
    color: Theme.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  rightSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
