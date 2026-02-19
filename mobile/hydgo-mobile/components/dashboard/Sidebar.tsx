import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type SidebarItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
};

interface SidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ items, activeKey, onSelect, header, footer }: SidebarProps) {
  return (
    <View
      style={{
        width: 240,
        backgroundColor: '#000',
        borderRightWidth: 1,
        borderRightColor: '#1A1A1A',
        paddingTop: 20,
      }}
    >
      {header}
      <ScrollView style={{ flex: 1, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 11,
                paddingHorizontal: 20,
                backgroundColor: isActive ? '#111' : 'transparent',
                borderLeftWidth: 2,
                borderLeftColor: isActive ? '#fff' : 'transparent',
                gap: 12,
              }}
            >
              <Ionicons name={item.icon} size={18} color={isActive ? '#fff' : '#666'} />
              <Text
                style={{
                  color: isActive ? '#fff' : '#888',
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                  flex: 1,
                }}
              >
                {item.label}
              </Text>
              {item.badge && item.badge > 0 ? (
                <View
                  style={{
                    backgroundColor: '#ff4444',
                    borderRadius: 8,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {footer}
    </View>
  );
}
