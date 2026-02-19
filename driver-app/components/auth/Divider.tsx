/**
 * HydGo Driver — Divider
 * Mirrors passenger app's auth/Divider.tsx
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../constants/theme';

export function Divider({ text = 'or' }: { text?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
      <Text
        style={{ color: Colors.textDim, fontSize: 12, marginHorizontal: 12 }}
      >
        {text}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
    </View>
  );
}
