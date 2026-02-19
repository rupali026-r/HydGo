import React from 'react';
import { View, Text } from 'react-native';

export function Divider({ text = 'or' }: { text?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: '#1A1A1A' }} />
      <Text
        style={{ color: '#555', fontSize: 12, marginHorizontal: 12 }}
      >
        {text}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#1A1A1A' }} />
    </View>
  );
}
