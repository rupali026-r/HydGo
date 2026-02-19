import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function HeaderBar({ title, subtitle, left, right }: HeaderBarProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
        backgroundColor: '#000',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        {left}
        <View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: '#666', fontSize: 11, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {right ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {right}
        </View>
      ) : null}
    </View>
  );
}

interface NotificationBellProps {
  count: number;
  onPress: () => void;
}

export function NotificationBell({ count, onPress }: NotificationBellProps) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ position: 'relative' }}>
      <Ionicons name="notifications-outline" size={22} color="#fff" />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            backgroundColor: '#ff4444',
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface StatusIndicatorProps {
  label: string;
  active: boolean;
}

export function StatusIndicator({ label, active }: StatusIndicatorProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: active ? '#4CAF50' : '#ff4444',
        }}
      />
      <Text style={{ color: '#888', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
