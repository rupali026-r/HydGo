/**
 * HydGo Driver — InputField
 * Exact mirror of the passenger app's auth/InputField.tsx
 */

import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { Colors, Radius, Font } from '../../constants/theme';

interface InputFieldProps extends TextInputProps {
  label: string;
  error?: string;
  right?: React.ReactNode;
}

export function InputField({ label, error, right, ...props }: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          color: Colors.textSecondary,
          fontSize: Font.md,
          fontWeight: '600',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: focused ? Colors.borderFocus : Colors.border,
          borderRadius: Radius.md,
          backgroundColor: Colors.surface,
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
          placeholderTextColor={Colors.placeholder}
          style={{
            flex: 1,
            color: Colors.textPrimary,
            fontSize: Font.base,
            paddingVertical: 14,
          }}
        />
        {right}
      </View>
      {error ? (
        <Text style={{ color: Colors.error, fontSize: Font.sm, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
