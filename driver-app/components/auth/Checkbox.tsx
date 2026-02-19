/**
 * HydGo Driver — Checkbox
 * Mirrors passenger app's auth/Checkbox.tsx
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export function Checkbox({ checked, onToggle, label }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderWidth: 1.5,
          borderColor: checked ? Colors.textPrimary : '#444',
          borderRadius: 4,
          backgroundColor: checked ? Colors.textPrimary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Ionicons name="checkmark" size={13} color={Colors.ctaPrimaryText} />
        )}
      </View>
      <Text style={{ color: '#999', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
