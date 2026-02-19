import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth-context';

export default function DriverPendingScreen() {
  const { logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 28,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: '#1A1A1A',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Ionicons name="time-outline" size={36} color="#888" />
        </View>

        <Text
          style={{
            color: '#fff',
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Awaiting Approval
        </Text>

        <Text
          style={{
            color: '#888',
            fontSize: 15,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 40,
            maxWidth: 300,
          }}
        >
          Your driver application is under review.{'\n'}
          You'll be notified once your account is activated.
        </Text>

        <Pressable
          onPress={logout}
          style={{
            borderWidth: 1,
            borderColor: '#333',
            borderRadius: 10,
            paddingVertical: 14,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
            Sign Out
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
