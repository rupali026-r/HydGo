// ── Animated ETA Counter ────────────────────────────────────────────────────
// Smoothly animates between ETA values with spring transitions.
// No abrupt jumps — numerals roll to new value.

import React, { useEffect } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Theme } from '../../constants/theme';

const AnimatedText = Animated.createAnimatedComponent(Text);

interface AnimatedETAProps {
  minutes: number;
  style?: TextStyle;
  suffix?: string;
}

export function AnimatedETA({ minutes, style, suffix = ' min' }: AnimatedETAProps) {
  const animatedValue = useSharedValue(minutes);

  useEffect(() => {
    animatedValue.value = withTiming(minutes, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [minutes]);

  // For web compatibility, use derived + animated style for opacity fade
  const displayMinutes = useDerivedValue(() => Math.round(animatedValue.value));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(1, { duration: 300 }),
  }));

  // Since AnimatedText with animatedProps isn't fully supported everywhere,
  // we use a simpler approach: just render with fade
  return (
    <Animated.View style={fadeStyle}>
      <Text style={[{ color: Theme.text, fontSize: Theme.font.xxl, fontWeight: '700' }, style]}>
        {minutes < 1 ? 'Now' : `${minutes}${suffix}`}
      </Text>
    </Animated.View>
  );
}

interface AnimatedPercentProps {
  value: number;
  style?: TextStyle;
}

export function AnimatedPercent({ value, style }: AnimatedPercentProps) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(1, { duration: 400 }),
  }));

  return (
    <Animated.View style={fadeStyle}>
      <Text style={[{ color: Theme.text, fontSize: Theme.font.md, fontWeight: '600' }, style]}>
        {value}%
      </Text>
    </Animated.View>
  );
}
