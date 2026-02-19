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
import { Link, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth-context';
import { InputField, AuthButton } from '../../../components/auth';

// ── Validation ────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/\d/, 'Must contain a number')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  twoFaCode: z.string().optional(),
});
type Form = z.infer<typeof schema>;



// ── Screen ────────────────────────────────────────────────────────────────────
export default function AdminLoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [apiError, setApiError] = useState('');

  const { control, handleSubmit, formState } = useForm<Form>({
    defaultValues: { email: '', password: '', twoFaCode: '' },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = async (v: Form) => {
    setApiError('');
    try {
      await login(v.email, v.password, 'ADMIN');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Authentication failed.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
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
              source={require('../../../assets/images/hydgo-logo.png')}
              resizeMode="contain"
              style={{ width: 160, height: 80, alignSelf: 'center', marginBottom: 16 }}
            />
            {/* ── Admin Title ────────────────────────────────────── */}
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
              Admin Portal
            </Text>
            {/* ── Subtitle ───────────────────────────────────────── */}
            <Text style={{ color: '#888', fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 40 }}>
              System management access
            </Text>

            {/* ── Admin Email ─────────────────────────────────────── */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Email"
                  error={formState.errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder=""
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

            {/* ── 2FA Code (Optional) ─────────────────────────────── */}
            <Controller
              control={control}
              name="twoFaCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="2FA Code (if enabled)"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {/* ── Error ───────────────────────────────────────────── */}
            {apiError ? (
              <Text
                style={{
                  color: '#ff4444',
                  fontSize: 13,
                  marginBottom: 12,
                  textAlign: 'center',
                }}
              >
                {apiError}
              </Text>
            ) : null}

            {/* ── Secure Login ────────────────────────────────────── */}
            <AuthButton
              label="Secure Login"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 24 }}
            />

            {/* ── Register Link ─────────────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Need admin access?{' '}
              </Text>
              <Link href="/(auth)/admin/register" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Register with Key
                  </Text>
                </Pressable>
              </Link>
            </View>

            {/* ── Back to Passenger Login ─────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Back to{' '}
              </Text>
              <Link href="/(auth)/passenger/login" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Passenger Login
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
