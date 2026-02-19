/**
 * HydGo Driver — AuthButton
 * Mirrors passenger app's auth/AuthButton.tsx
 * Reanimated press animation, primary (white bg) / secondary (outline).
 */

import React from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Font } from '../../constants/theme';

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  isValid?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: object;
}

export function AuthButton({
  label,
  onPress,
  isLoading = false,
  isValid = true,
  disabled = false,
  variant = 'primary',
  style,
}: AuthButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
        onPress={onPress}
        disabled={disabled || isLoading}
        style={[
          {
            borderRadius: Radius.md,
            paddingVertical: 16,
            alignItems: 'center' as const,
            opacity: isValid && !disabled ? 1 : 0.5,
          },
          isPrimary
            ? { backgroundColor: Colors.ctaPrimaryBg }
            : {
                borderWidth: 1,
                borderColor: Colors.ctaSecondaryBorder,
                backgroundColor: 'transparent',
              },
          style,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator
            color={isPrimary ? Colors.ctaPrimaryText : Colors.ctaSecondaryText}
            size="small"
          />
        ) : (
          <Text
            style={{
              color: isPrimary ? Colors.ctaPrimaryText : Colors.ctaSecondaryText,
              fontSize: Font.lg,
              fontWeight: '700',
            }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
