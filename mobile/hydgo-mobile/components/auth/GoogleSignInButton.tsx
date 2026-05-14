import React, { useState, useEffect, useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
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
    const redirectHandled = useRef(false);

  // Handle redirect result on mount (for when user returns after signInWithRedirect)
  useEffect(() => {
        if (redirectHandled.current) return;
        redirectHandled.current = true;

                (async () => {
                        try {
                                  const result = await getRedirectResult(auth);
                                  if (result && result.user) {
                                              setIsLoading(true);
                                              console.log('[OK] Redirect Sign-In completed:', {
                                                            email: result.user.email,
                                                            name: result.user.displayName,
                                                            uid: result.user.uid,
                                              });
                                              const idToken = await result.user.getIdToken();
                                              await onSuccess(idToken);
                                              setIsLoading(false);
                                  }
                        } catch (error: any) {
                                  console.error('[ERROR] Redirect result error:', error);
                                  onError?.(error?.message || 'Google Sign-In failed after redirect.');
                        }
                })();
  }, []);

  const handlePress = async () => {
        if (isLoading) return;

        setIsLoading(true);

        try {
                console.log('[INFO] Starting Google Sign-In (popup)...');

          // Try popup first - fast and seamless when not blocked
          const result = await signInWithPopup(auth, googleProvider);
                const user = result.user;

          // Get Firebase ID token
          const idToken = await user.getIdToken();

          console.log('[OK] Firebase Auth Success:', {
                    email: user.email,
                    name: user.displayName,
                    uid: user.uid
          });

          // Call parent success handler with Firebase ID token
          await onSuccess(idToken);

          setIsLoading(false);
        } catch (error: any) {
                console.error('[ERROR] Popup sign-in error:', error);

          if (error.code === 'auth/popup-blocked') {
                    // Popup was blocked - fall back to redirect-based sign-in
                  console.log('[RETRY] Popup blocked, falling back to redirect...');
                    try {
                                await signInWithRedirect(auth, googleProvider);
                                // Page will redirect - no need to setIsLoading(false)
                      return;
                    } catch (redirectError: any) {
                                console.error('[ERROR] Redirect fallback error:', redirectError);
                                setIsLoading(false);
                                onError?.(redirectError?.message || 'Google Sign-In failed. Please try again.');
                    }
          } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                    setIsLoading(false);
                    onError?.('Sign-in cancelled');
          } else {
                    setIsLoading(false);
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
                                  </Text>Text>
                        </>>
                      )}
        </Pressable>Pressable>
      );
}
</></Pressable>
