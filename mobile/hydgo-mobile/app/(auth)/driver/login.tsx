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
import {
  InputField,
  RoleToggle,
  AuthButton,
  Checkbox,
} from '../../../components/auth';

// ── Validation ────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/\d/, 'Must contain a number'),
});
type Form = z.infer<typeof schema>;

const ROLE_ROUTES = [
  '/(auth)/passenger/login',
  '/(auth)/driver/login',
  '/(auth)/admin/login',
] as const;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DriverLoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
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
      await login(v.email, v.password, 'DRIVER');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Login failed. Check your credentials.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleRoleSwitch = (idx: number) => {
    router.replace(ROLE_ROUTES[idx] as any);
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
              style={{ width: 160, height: 80, marginBottom: 16, alignSelf: 'center' }}
            />

            {/* ── Header ──────────────────────────────────────────── */}
            <Text
              style={{
                color: '#fff',
                fontSize: 36,
                fontWeight: '800',
                letterSpacing: -1,
                marginBottom: 6,
              }}
            >
              HydGo Driver Portal
            </Text>
            <Text style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
              Manage your bus operations.
            </Text>

            {/* ── Role Toggle ─────────────────────────────────────── */}
            <RoleToggle selectedIndex={1} onSelect={handleRoleSwitch} />

            {/* ── Email ───────────────────────────────────────────── */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Registered Email"
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

            {/* ── Remember + Forgot ───────────────────────────────── */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <Checkbox
                checked={remember}
                onToggle={() => setRemember(!remember)}
                label="Remember me"
              />
              <Link href="/(auth)/forgot" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}
                  >
                    Forgot password?
                  </Text>
                </Pressable>
              </Link>
            </View>

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

            {/* ── Log In ──────────────────────────────────────────── */}
            <AuthButton
              label="Log In as Driver"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 24 }}
            />

            {/* ── Apply to Drive ──────────────────────────────────── */}
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#666', fontSize: 14, marginBottom: 6 }}>
                Not registered as driver?
              </Text>
              <Link href="/(auth)/driver/register" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
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
