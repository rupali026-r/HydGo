/**
 * HydGo Driver — Root Layout
 * Mirrors passenger app's _layout.tsx pattern.
 * ThemeProvider (dark) → AuthProvider → Stack navigator.
 * Session restore + protected route guard handled by AuthProvider.
 */

import React from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth-context';
import { DARK_THEME } from '../constants/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={DARK_THEME}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#000' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="pending" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="trip" />
          <Stack.Screen name="settings" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
