import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../../lib/auth-context';
import { InputField, AuthButton, Checkbox } from '../../../components/auth';

// ── Validation ────────────────────────────────────────────────────────────────
const BUS_TYPES = [
  'City Ordinary',
  'Metro Express',
  'Metro Deluxe',
  'Super Luxury',
  'Garuda Plus',
  'Rajdhani',
  'Palle Velugu',
  'Express',
  'Electric AC',
] as const;

const BUS_TYPE_API_MAP: Record<string, string> = {
  'City Ordinary': 'CITY_ORDINARY',
  'Metro Express': 'METRO_EXPRESS',
  'Metro Deluxe': 'METRO_DELUXE',
  'Super Luxury': 'SUPER_LUXURY',
  'Garuda Plus': 'GARUDA_PLUS',
  'Rajdhani': 'RAJDHANI',
  'Palle Velugu': 'PALLE_VELUGU',
  'Express': 'EXPRESS',
  'Electric AC': 'ELECTRIC_AC',
};

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
    busType: z.string().min(1, 'Bus type is required'),
    licenseNumber: z.string().min(1, 'License number is required'),
    experience: z.string().min(1, 'Years of experience is required'),
    depotLocation: z.string().min(1, 'Depot location is required'),
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
export default function DriverRegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [apiError, setApiError] = useState('');
  const [licenseFile, setLicenseFile] = useState<string | null>(null);
  const [showBusDropdown, setShowBusDropdown] = useState(false);

  const { control, handleSubmit, formState, setValue, watch } = useForm<Form>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirm: '',
      busType: '',
      licenseNumber: '',
      experience: '',
      depotLocation: '',
      acceptTerms: false as any,
    },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const acceptTerms = watch('acceptTerms');
  const busType = watch('busType');

  const pickLicense = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setLicenseFile(result.assets[0].name);
      }
    } catch {
      Alert.alert('Error', 'Could not pick document');
    }
  };

  const onSubmit = async (v: Form) => {
    if (!licenseFile) {
      setApiError('License upload is mandatory.');
      return;
    }
    setApiError('');
    try {
      await register({
        name: v.name,
        email: v.email,
        password: v.password,
        phone: v.phone,
        role: 'DRIVER',
        busType: BUS_TYPE_API_MAP[v.busType] || v.busType,
        licenseNumber: v.licenseNumber,
        experience: parseInt(v.experience, 10) || 0,
        depotLocation: v.depotLocation,
      });
      // Driver accounts are pending until admin approval
    } catch (e: any) {
      setApiError(
        e?.response?.data?.error?.message || e?.response?.data?.message || 'Application failed. Try again.',
      );
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
              HydGo Driver Application
            </Text>
            <Text style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
              Join the HydGo driver network.
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

            {/* ── Bus Type Dropdown ──────────────────────────────── */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: '#ccc',
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 6,
                }}
              >
                Bus Type
              </Text>
              <Pressable
                onPress={() => setShowBusDropdown(!showBusDropdown)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: '#1A1A1A',
                  borderRadius: 10,
                  backgroundColor: '#0a0a0a',
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                }}
              >
                <Text
                  style={{
                    color: busType ? '#fff' : '#555',
                    fontSize: 15,
                  }}
                >
                  {busType || 'Select bus type'}
                </Text>
                <Ionicons
                  name={showBusDropdown ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#666"
                />
              </Pressable>
              {showBusDropdown && (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#1A1A1A',
                    borderRadius: 10,
                    backgroundColor: '#0a0a0a',
                    marginTop: 4,
                    overflow: 'hidden',
                    maxHeight: 250,
                  }}
                >
                  <ScrollView nestedScrollEnabled>
                    {BUS_TYPES.map((type) => (
                      <Pressable
                        key={type}
                        onPress={() => {
                          setValue('busType', type, {
                            shouldValidate: true,
                          });
                          setShowBusDropdown(false);
                        }}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: '#1A1A1A',
                          backgroundColor:
                            busType === type ? '#111' : 'transparent',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 15 }}>
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {formState.errors.busType ? (
                <Text
                  style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}
                >
                  {formState.errors.busType.message}
                </Text>
              ) : null}
            </View>

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

            {/* ── Upload License ──────────────────────────────────── */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: '#ccc',
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 6,
                }}
              >
                Upload License
              </Text>
              <Pressable
                onPress={pickLicense}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderWidth: 1,
                  borderColor: '#1A1A1A',
                  borderRadius: 10,
                  backgroundColor: '#0a0a0a',
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                }}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#666" />
                <Text
                  style={{
                    color: licenseFile ? '#fff' : '#555',
                    fontSize: 15,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {licenseFile || 'Choose file...'}
                </Text>
                {licenseFile && (
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                )}
              </Pressable>
            </View>

            {/* ── Years of Experience ─────────────────────────────── */}
            <Controller
              control={control}
              name="experience"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Years of Experience"
                  error={formState.errors.experience?.message}
                  keyboardType="number-pad"
                  placeholder="e.g. 5"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {/* ── Depot Location ──────────────────────────────────── */}
            <Controller
              control={control}
              name="depotLocation"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Depot Location"
                  error={formState.errors.depotLocation?.message}
                  placeholder="e.g. Miyapur Depot"
                  autoCapitalize="words"
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
                  setValue('acceptTerms', !acceptTerms as any, {
                    shouldValidate: true,
                  })
                }
                label="I accept the Driver Terms & Conditions"
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

            {/* ── Submit ──────────────────────────────────────────── */}
            <AuthButton
              label="Submit Application"
              onPress={handleSubmit(onSubmit)}
              isLoading={formState.isSubmitting}
              isValid={formState.isValid && !!licenseFile}
              disabled={!formState.isValid || !licenseFile}
              style={{ marginBottom: 16 }}
            />

            {/* ── Review Notice ────────────────────────────────────── */}
            <Text
              style={{
                color: '#555',
                fontSize: 12,
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 18,
              }}
            >
              Applications are reviewed before activation.
            </Text>

            {/* ── Driver Login Link ────────────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>
                Already approved?{' '}
              </Text>
              <Link href="/(auth)/driver/login" asChild>
                <Pressable>
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Driver Login
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
