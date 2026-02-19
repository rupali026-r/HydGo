import React, { useEffect, useRef } from 'react';
import { View, Text, Animated as RNAnimated } from 'react-native';

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}

export function StatCard({ label, value, prefix = '', suffix = '', compact = false }: StatCardProps) {
  const anim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    RNAnimated.timing(anim, {
      toValue: value,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View
      style={{
        flex: compact ? undefined : 1,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 12,
        padding: compact ? 14 : 18,
        backgroundColor: '#000',
        minWidth: compact ? 140 : undefined,
      }}
    >
      <Text style={{ color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
    </View>
  );
}

function AnimatedNumber({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  const [display, setDisplay] = React.useState('0');

  useEffect(() => {
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => {
      if (prefix === '₹' || prefix === '$') {
        setDisplay(Math.floor(v).toLocaleString());
      } else {
        setDisplay(v >= 10 ? Math.floor(v).toString() : v.toFixed(1));
      }
    });
    RNAnimated.timing(anim, {
      toValue: value,
      duration: 900,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listener);
  }, [value]);

  return (
    <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
      {prefix}{display}{suffix}
    </Text>
  );
}
