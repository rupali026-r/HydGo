import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

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
          color: '#ccc',
          fontSize: 13,
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
          borderColor: focused ? '#fff' : '#1A1A1A',
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
        {right}
      </View>
      {error ? (
        <Text style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
