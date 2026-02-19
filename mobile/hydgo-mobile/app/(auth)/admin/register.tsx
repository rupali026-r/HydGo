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
import { InputField, AuthButton, Checkbox } from '../../../components/auth';

// ── Validation ────────────────────────────────────────────────────────────────
const schema = z
  .object({
    name: z.string().min(1, 'Name is required').min(2, 'Min 2 characters'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z.string().min(1, 'Phone is required').min(10, 'Enter a valid phone number'),
    adminSecretKey: z.string().min(1, 'Admin secret key is required'),
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/\d/, 'Must contain a number')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
    confirm: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms',
    }),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type Form = z.infer<typeof schema>;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AdminRegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [apiError, setApiError] = useState('');

  const { control, handleSubmit, formState, setValue, watch } = useForm<Form>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      adminSecretKey: '',
      password: '',
      confirm: '',
      acceptTerms: false as any,
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
        role: 'ADMIN',
        adminSecretKey: v.adminSecretKey,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message || e?.response?.data?.message || 'Registration failed. Try again.';
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
              Admin Registration
            </Text>
            <Text style={{ color: '#888', fontSize: 15, marginBottom: 8 }}>
              HydGo system management.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#1a1200',
                borderWidth: 1,
                borderColor: '#332600',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 28,
              }}
            >
              <Ionicons name="shield-checkmark" size={18} color="#FFA000" />
              <Text style={{ color: '#FFA000', fontSize: 12, flex: 1 }}>
                Requires an authorized admin secret key provided by HydGo.
              </Text>
            </View>

            {/* ── Full Name ───────────────────────────────────────── */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Full Name"
                  error={formState.errors.name?.message}
                  placeholder="Admin Name"
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
                  label="Admin Email"
                  error={formState.errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="admin@hydgo.com"
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

            {/* ── Admin Secret Key ────────────────────────────────── */}
            <Controller
              control={control}
              name="adminSecretKey"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Admin Secret Key"
                  error={formState.errors.adminSecretKey?.message}
                  placeholder="HYDGO_SUPER_ADMIN_2026"
                  autoCapitalize="none"
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

            {/* ── Terms ───────────────────────────────────────────── */}
            <View style={{ marginBottom: 24 }}>
              <Checkbox
                checked={!!acceptTerms}
                onToggle={() =>
                  setValue('acceptTerms', !acceptTerms as any, {
                    shouldValidate: true,
                  })
                }
                label="I accept the Admin Terms & Conditions"
              />
              {formState.errors.acceptTerms ? (
                <Text
                  style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}
                >
                  {formState.errors.acceptTerms.message}
                </Text>
              ) : null}
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

            {/* ── Register ────────────────────────────────────────── */}
            <AuthButton
              label="Create Admin Account"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 28 }}
            />

            {/* ── Login Link ──────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Already registered?{' '}
              </Text>
              <Link href="/(auth)/admin/login" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Admin Login
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
