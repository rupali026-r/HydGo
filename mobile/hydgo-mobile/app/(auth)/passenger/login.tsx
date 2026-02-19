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
  AuthButton,
  Checkbox,
  Divider,
  GoogleSignInButton,
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

// Removed role routes. Passenger only.

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PassengerLoginScreen() {
  const { login, googleSignIn, loginAsGuest } = useAuth();
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
      await login(v.email, v.password, 'PASSENGER');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Login failed. Check your credentials.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleGoogleSignIn = async (idToken: string, accessToken?: string) => {
    setApiError('');
    try {
      console.log('🔵 Sending idToken to backend...');
      await googleSignIn(idToken, 'PASSENGER');
      console.log('✅ Login successful, redirecting...');
    } catch (e: any) {
      console.error('❌ Backend error:', e);
      console.error('❌ Response data:', e?.response?.data);
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Google Sign-In failed. Please try again.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleGoogleError = (error: string) => {
    setApiError(error);
  };

  // Role switch removed. Passenger only.

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-start',
            padding: 28,
            paddingTop: 40,
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
            {/* ── Subtitle ───────────────────────────────────────── */}
            <Text style={{ color: '#888', fontSize: 18, fontWeight: '500', textAlign: 'center', marginBottom: 40 }}>
              Your digital bus companion
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
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

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

            <AuthButton
              label="Sign In"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid}
              style={{ marginBottom: 0 }}
            />

            <Divider text="or" />
            <GoogleSignInButton
              onSuccess={handleGoogleSignIn}
              onError={handleGoogleError}
              style={{ marginBottom: 32 }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Don't have an account?{' '}
              </Text>
              <Link href="/(auth)/passenger/register" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Sign Up
                  </Text>
                </Pressable>
              </Link>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 0 }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Are you an admin?{' '}
              </Text>
              <Link href="/(auth)/admin/login" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Click here
                  </Text>
                </Pressable>
              </Link>
            </View>

            {/* ── Driver App Card ────────────────────────────────── */}
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#222',
                  padding: 18,
                  width: '100%',
                  maxWidth: 380,
                  alignSelf: 'center',
                  marginBottom: 12,
                  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                  Are you a TSRTC Driver?
                </Text>
                <Text style={{ color: '#bbb', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                  Manage trips, update live location, and track occupancy in real-time.
                </Text>
                <Pressable
                  onPress={() => {
                    // Open external link
                    import('expo-linking').then(Linking => Linking.openURL('https://play.google.com/store/apps/details?id=com.hydgo.driver'));
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#3B82F6' : '#fff',
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    alignSelf: 'center',
                    marginTop: 4,
                    boxShadow: pressed ? '0px 2px 6px rgba(59, 130, 246, 0.18)' : '0px 2px 6px rgba(59, 130, 246, 0.08)',
                  })}
                >
                  {({ pressed }) => (
                    <Text style={{ color: pressed ? '#fff' : '#3B82F6', fontWeight: '700', fontSize: 15, textAlign: 'center', letterSpacing: 0.2 }}>
                      Download Driver App
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
