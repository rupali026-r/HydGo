/**
 * HydGo Driver — Root index
 * Shows loading spinner while AuthProvider restores session
 * and useProtectedRoute handles navigation.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';

export default function IndexScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={Colors.textMuted} size="large" />
    </View>
  );
}
