import React from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

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
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: 'center' as const,
            opacity: isValid && !disabled ? 1 : 0.5,
          },
          isPrimary
            ? { backgroundColor: '#fff' }
            : {
                borderWidth: 1,
                borderColor: '#333',
                backgroundColor: 'transparent',
              },
          style,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator
            color={isPrimary ? '#000' : '#fff'}
            size="small"
          />
        ) : (
          <Text
            style={{
              color: isPrimary ? '#000' : '#fff',
              fontSize: 16,
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
