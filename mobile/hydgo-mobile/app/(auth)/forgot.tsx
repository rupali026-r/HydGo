import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api } from '../../lib/api';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});
type Form = z.infer<typeof schema>;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  const { control, handleSubmit, formState } = useForm<Form>({
    defaultValues: { email: '' },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = async (v: Form) => {
    setApiError('');
    try {
      await api.post('/auth/forgot-password', { email: v.email });
      setSent(true);
    } catch (e: any) {
      // Show success even if email not found (security best practice)
      setSent(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
          <Animated.View entering={FadeIn.duration(400)}>
            {/* ── Title ─────────────────────────────────────────────── */}
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: 8 }}>
              Reset Password
            </Text>
            <Text style={{ color: '#999', fontSize: 15, marginBottom: 32, lineHeight: 22 }}>
              {sent
                ? 'If an account with that email exists, we sent a reset link.'
                : 'Enter your email and we\'ll send you a reset link.'}
            </Text>

            {sent ? (
              /* ── Success state ────────────────────────────────────── */
              <View>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#222',
                    borderRadius: 10,
                    padding: 20,
                    alignItems: 'center',
                    marginBottom: 28,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 40, marginBottom: 12 }}>✓</Text>
                  <Text style={{ color: '#ccc', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                    Check your inbox for a password reset link.
                  </Text>
                </View>

                <Link href="/(auth)/passenger/login" asChild>
                  <Pressable
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 10,
                      paddingVertical: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Back to Sign In</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              /* ── Form state ───────────────────────────────────────── */
              <View>
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

                {apiError ? (
                  <Text style={{ color: '#ff4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                    {apiError}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleSubmit(onSubmit)}
                  disabled={formState.isSubmitting}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    paddingVertical: 16,
                    alignItems: 'center',
                    opacity: formState.isValid ? 1 : 0.5,
                    marginBottom: 24,
                  }}
                >
                  {formState.isSubmitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Send Reset Link</Text>
                  )}
                </Pressable>

                <Link href="/(auth)/passenger/login" asChild>
                  <Pressable style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>← Back to Sign In</Text>
                  </Pressable>
                </Link>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Reusable Input ────────────────────────────────────────────────────────────
function InputField({
  label,
  error,
  ...props
}: {
  label: string;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: '#ccc', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: focused ? '#fff' : '#222',
          borderRadius: 10,
          backgroundColor: '#0a0a0a',
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor="#555"
          style={{
            flex: 1,
            color: '#fff',
            fontSize: 15,
            paddingVertical: 14,
          }}
        />
      </View>
      {error ? (
        <Text style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
