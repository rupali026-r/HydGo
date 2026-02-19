/**
 * HydGo Driver — Login Screen
 * Mirrors passenger app's driver/login.tsx design.
 * Zod validation, react-hook-form, Reanimated transitions.
 * Black + white minimal theme. No RoleToggle (driver-only app).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { InputField, AuthButton, Checkbox } from '../components/auth';
import { Colors, Font } from '../constants/theme';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/\d/, 'Must contain a number'),
});
type Form = z.infer<typeof schema>;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [apiError, setApiError] = useState('');

  const { control, handleSubmit, formState } = useForm<Form>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = async (v: Form) => {
    setApiError('');
    try {
      await login(v.email, v.password);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Check your credentials.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 28,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeIn.duration(400)}>
            {/* ── Logo ───────────────────────────────────────────── */}
            <Image
              source={require('../assets/images/hydgo-logo.png')}
              resizeMode="contain"
              style={{ width: 160, height: 80, marginBottom: 16, alignSelf: 'center' }}
            />

            {/* ── Header ──────────────────────────────────────────── */}
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: Font.hero,
                fontWeight: '800',
                letterSpacing: -1,
                marginBottom: 6,
              }}
            >
              Driver Login
            </Text>
            <Text
              style={{
                color: Colors.textMuted,
                fontSize: Font.base,
                marginBottom: 32,
              }}
            >
              Sign in to manage your bus operations.
            </Text>

            {/* ── Email ───────────────────────────────────────────── */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Email"
                  error={formState.errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="driver@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {/* ── Password ────────────────────────────────────────── */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Password"
                  error={formState.errors.password?.message}
                  placeholder="••••••••"
                  secureTextEntry={!showPw}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  right={
                    <Pressable onPress={() => setShowPw(!showPw)} hitSlop={12}>
                      <Ionicons
                        name={showPw ? 'eye-off' : 'eye'}
                        size={20}
                        color="#666"
                      />
                    </Pressable>
                  }
                />
              )}
            />

            {/* ── Remember ────────────────────────────────────────── */}
            <View style={{ marginBottom: 24 }}>
              <Checkbox
                checked={remember}
                onToggle={() => setRemember(!remember)}
                label="Remember me"
              />
            </View>

            {/* ── Error ───────────────────────────────────────────── */}
            {apiError ? (
              <Text
                style={{
                  color: Colors.error,
                  fontSize: Font.md,
                  marginBottom: 12,
                  textAlign: 'center',
                }}
              >
                {apiError}
              </Text>
            ) : null}

            {/* ── Login Button ────────────────────────────────────── */}
            <AuthButton
              label="Sign In"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 24 }}
            />

            {/* ── Register Link ───────────────────────────────────── */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14, marginBottom: 6 }}>
                Not registered as driver?
              </Text>
              <Link href="/register" asChild>
                <Pressable>
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    Apply to Drive
                  </Text>
                </Pressable>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
