import React, { useState } from 'react';
import { Pressable, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string, accessToken?: string) => Promise<void>;
  onError?: (error: string) => void;
  disabled?: boolean;
  style?: any;
}

export function GoogleSignInButton({ 
  onSuccess, 
  onError, 
  disabled,
  style 
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      console.log('🔵 Starting Google Sign-In...');
      
      // Use popup for Expo web - works better than redirect
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      console.log('✅ Firebase Auth Success:', {
        email: user.email,
        name: user.displayName,
        uid: user.uid
      });

      // Call parent success handler with Firebase ID token
      await onSuccess(idToken);
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      setIsLoading(false);
      
      if (error.code === 'auth/popup-blocked') {
        onError?.('Pop-up was blocked. Please allow pop-ups for this app.');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        onError?.('Sign-in cancelled');
      } else {
        onError?.(error?.message || 'Failed to start Google Sign-In');
      }
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: 8,
          paddingVertical: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#ddd',
          opacity: disabled || isLoading ? 0.6 : 1,
        },
        style
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#666" />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#DB4437" style={{ marginRight: 12 }} />
          <Text
            style={{
              color: '#444',
              fontSize: 15,
              fontWeight: '600',
              letterSpacing: 0.2,
            }}
          >
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}
