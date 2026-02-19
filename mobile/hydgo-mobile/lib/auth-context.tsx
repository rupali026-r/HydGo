import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { api } from './api';
import { getItem, setItem, removeItem } from './storage';

export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN' | 'GUEST';

interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string, role: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: string;
    city?: string;
    adminSecretKey?: string;
    busType?: string;
    licenseNumber?: string;
    experience?: number;
    depotLocation?: string;
  }) => Promise<void>;
  googleSignIn: (idToken: string, role: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

function redirectForRole(role: Role, router: ReturnType<typeof useRouter>, status?: string) {
  switch (role) {
    case 'PASSENGER':
      router.replace('/(app)/passenger/home' as any);
      break;
    case 'DRIVER':
      if (status === 'PENDING') {
        router.replace('/(app)/driver/pending' as any);
      } else {
        router.replace('/(app)/driver/dashboard' as any);
      }
      break;
    case 'ADMIN':
      router.replace('/(app)/admin/panel' as any);
      break;
    case 'GUEST':
      router.replace('/(app)/guest/map' as any);
      break;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // Load persisted session on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await getItem('user');
        const token = await getItem('accessToken');
        if (raw && token) {
          const parsed = JSON.parse(raw) as User;
          setUser(parsed);
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  // Route protection
  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !isGuest && !inAuth) {
      router.replace('/(auth)/passenger/login' as any);
    } else if ((user || isGuest) && inAuth) {
      if (isGuest) {
        router.replace('/(app)/guest/map' as any);
      } else if (user) {
        redirectForRole(user.role, router, user.status);
      }
    }
  }, [user, isGuest, segments, isLoading]);

  const login = useCallback(async (email: string, password: string, role: string) => {
    const response = await api.post('/auth/login', { email, password, role });
    const result = response.data?.data ?? response.data;
    const u: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name ?? undefined,
      role: result.user.role,
      status: result.user.status ?? 'ACTIVE',
    };
    await setItem('accessToken', result.accessToken);
    await setItem('refreshToken', result.refreshToken);
    await setItem('user', JSON.stringify(u));
    setIsGuest(false);
    setUser(u);
  }, []);

  const googleSignIn = useCallback(async (idToken: string, role: string) => {
    console.log('🔵 Calling /auth/google endpoint...', { role });
    const response = await api.post('/auth/google', { idToken, role });
    console.log('✅ Backend response:', response.data);
    const result = response.data?.data ?? response.data;
    const u: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name ?? undefined,
      role: result.user.role,
      status: result.user.status ?? 'ACTIVE',
    };
    await setItem('accessToken', result.accessToken);
    await setItem('refreshToken', result.refreshToken);
    await setItem('user', JSON.stringify(u));
    console.log('✅ User data saved to storage:', u);
    setIsGuest(false);
    setUser(u);
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role: string;
      city?: string;
      adminSecretKey?: string;
      busType?: string;
      licenseNumber?: string;
      experience?: number;
      depotLocation?: string;
    }) => {
      const response = await api.post('/auth/register', payload);
      const result = response.data?.data ?? response.data;
      if (result.accessToken) {
        const u: User = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name ?? undefined,
          role: result.user.role,
          status: result.user.status ?? 'ACTIVE',
        };
        await setItem('accessToken', result.accessToken);
        await setItem('refreshToken', result.refreshToken);
        await setItem('user', JSON.stringify(u));
        setIsGuest(false);
        setUser(u);
      } else {
        // If register doesn't return token, auto-login
        await login(payload.email, payload.password, payload.role);
      }
    },
    [login],
  );

  const loginAsGuest = useCallback(() => {
    setUser(null);
    setIsGuest(true);
  }, []);

  const logout = useCallback(async () => {
    // Fire-and-forget server notification with a hard 3s cap — never block logout on backend
    getItem('refreshToken').then((tok) => {
      if (tok) api.post('/auth/logout', { tok }, { timeout: 3000 }).catch(() => {});
    }).catch(() => {});
    // Clear local state immediately
    setUser(null);
    setIsGuest(false);
    await removeItem('accessToken');
    await removeItem('refreshToken');
    await removeItem('user');
    router.replace('/(auth)/passenger/login' as any);
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isGuest, login, register, googleSignIn, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
