/**
 * HydGo Driver — Register Screen
 * Driver registration with license, phone, bus info.
 * Mirrors passenger app's driver/register.tsx design.
 * On success → redirect to /pending for admin approval.
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

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').min(2, 'Min 2 characters'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z.string().min(1, 'Phone is required').min(10, 'Invalid phone'),
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/\d/, 'Must contain a number'),
    confirm: z.string().min(1, 'Confirm your password'),
    licenseNumber: z.string().min(1, 'License number is required'),
    acceptTerms: z.literal(true, {
      message: 'You must accept the driver terms',
    }),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type Form = z.infer<typeof schema>;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const { register } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [apiError, setApiError] = useState('');

  const { control, handleSubmit, formState, setValue, watch } = useForm<Form>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirm: '',
      licenseNumber: '',
      acceptTerms: false as unknown as true,
    },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const acceptTerms = watch('acceptTerms');

  const onSubmit = async (v: Form) => {
    setApiError('');
    try {
      await register({
        name: v.name,
        email: v.email,
        password: v.password,
        phone: v.phone,
        role: 'DRIVER',
        licenseNumber: v.licenseNumber,
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setApiError(
        err?.response?.data?.message || 'Registration failed. Try again.',
      );
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
              Driver Registration
            </Text>
            <Text
              style={{
                color: Colors.textMuted,
                fontSize: Font.base,
                marginBottom: 32,
              }}
            >
              Join the driver network.
            </Text>

            {/* ── Full Name ───────────────────────────────────────── */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Full Name"
                  error={formState.errors.name?.message}
                  placeholder="John Doe"
                  autoCapitalize="words"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

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

            {/* ── Phone ───────────────────────────────────────────── */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Phone Number"
                  error={formState.errors.phone?.message}
                  keyboardType="phone-pad"
                  placeholder="+91 98765 43210"
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

            {/* ── Confirm Password ────────────────────────────────── */}
            <Controller
              control={control}
              name="confirm"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Confirm Password"
                  error={formState.errors.confirm?.message}
                  placeholder="••••••••"
                  secureTextEntry={!showPw}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {/* ── License Number ──────────────────────────────────── */}
            <Controller
              control={control}
              name="licenseNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="License Number"
                  error={formState.errors.licenseNumber?.message}
                  placeholder="DL-1234567890"
                  autoCapitalize="characters"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {/* ── Accept Terms ────────────────────────────────────── */}
            <View style={{ marginBottom: 24 }}>
              <Checkbox
                checked={!!acceptTerms}
                onToggle={() =>
                  setValue('acceptTerms', !acceptTerms as unknown as true, {
                    shouldValidate: true,
                  })
                }
                label="I accept the Driver Terms & Conditions"
              />
              {formState.errors.acceptTerms ? (
                <Text
                  style={{ color: Colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {formState.errors.acceptTerms.message}
                </Text>
              ) : null}
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

            {/* ── Submit ──────────────────────────────────────────── */}
            <AuthButton
              label="Submit Application"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 16 }}
            />

            {/* ── Review Notice ────────────────────────────────────── */}
            <Text
              style={{
                color: Colors.textDim,
                fontSize: 12,
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 18,
              }}
            >
              Applications are reviewed by TSRTC admin before activation.
            </Text>

            {/* ── Login Link ──────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Already approved?{' '}
              </Text>
              <Link href="/login" asChild>
                <Pressable>
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    Sign In
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
