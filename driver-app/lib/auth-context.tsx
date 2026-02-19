/**
 * HydGo Driver — Auth Context
 * Mirrors the passenger app's auth-context.tsx pattern.
 * Handles login, register, logout, session restore, route protection.
 * Driver-specific: checks approval status, redirects to /pending if unapproved.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { api } from './api';
import { getItem, setItem, removeItem } from './storage';
import { restoreSession, shouldAutoResume } from './sessionRestore';
import type { User, DriverProfile, RegisterPayload } from './types';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AuthContextValue {
  user: User | null;
  driver: DriverProfile | null;
  isLoading: boolean;
  needsAutoResume: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAutoResume: () => void;
}

/* ── Context ───────────────────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

/* ── Route Protection ──────────────────────────────────────────────────────── */

function useProtectedRoute(
  user: User | null,
  driver: DriverProfile | null,
  isLoading: boolean,
) {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait until navigation is ready and session is restored
    if (isLoading || !navigationState?.key) return;

    const currentRoute = segments[0] ?? '';
    const isAuthRoute =
      currentRoute === 'login' || currentRoute === 'register';

    if (!user) {
      // Not logged in → go to login
      if (!isAuthRoute) {
        router.replace('/login');
      }
    } else if (isAuthRoute) {
      // Logged in but on auth screen → redirect by approval status
      if (driver && driver.approved) {
        router.replace('/dashboard');
      } else {
        router.replace('/pending');
      }
    } else if (user && driver) {
      // Logged in — enforce approval gate
      if (
        !driver.approved &&
        currentRoute !== 'pending' &&
        currentRoute !== 'settings'
      ) {
        router.replace('/pending');
      }
      // If approved but on pending, redirect to dashboard
      if (driver.approved && currentRoute === 'pending') {
        router.replace('/dashboard');
      }
    }
  }, [user, driver, isLoading, segments, navigationState?.key]);
}

/* ── Provider ──────────────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsAutoResume, setNeedsAutoResume] = useState(false);
  const router = useRouter();

  // Fetch driver profile from backend
  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/drivers/me');
      const profile: DriverProfile = data.data ?? data;
      setDriver(profile);
      
      // Update driver store immediately
      const { useDriverStore } = await import('../store/driverStore');
      const store = useDriverStore.getState();
      if (profile.bus) {
        store.setInit({
          driverId: profile.id,
          busId: profile.bus.id,
          registrationNo: profile.bus.registrationNo,
          routeId: profile.bus.route?.id || null,
          routeNumber: profile.bus.route?.routeNumber || null,
          routeName: profile.bus.route?.name || null,
          capacity: profile.bus.capacity || 40,
          status: profile.driverStatus as any,
        });
      }
      return;
    } catch {
      // If profile fetch fails, driver may not exist yet
      setDriver(null);
    }
  }, []);

  const clearAutoResume = useCallback(() => {
    setNeedsAutoResume(false);
  }, []);

  // Session restore on mount — uses sessionRestore.ts for token refresh
  useEffect(() => {
    (async () => {
      try {
        const session = await restoreSession();
        if (session) {
          setUser(session.user);
          setDriver(session.driver);

          // If driver was ONLINE/ON_TRIP before crash, signal auto-resume
          if (session.tokenValid && shouldAutoResume(session.driver)) {
            setNeedsAutoResume(true);
          }
        }
      } catch {
        // Corrupted storage — start fresh
      }
      setIsLoading(false);
    })();
  }, []);

  // Route protection
  useProtectedRoute(user, driver, isLoading);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post('/auth/login', { email, password });
      const result = response.data?.data ?? response.data;
      const u: User = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        status: result.user.status ?? 'ACTIVE',
      };

      // Must be a driver
      if (u.role !== 'DRIVER') {
        throw new Error('This app is for TSRTC drivers only.');
      }

      await setItem('accessToken', result.accessToken);
      await setItem('refreshToken', result.refreshToken);
      await setItem('user', JSON.stringify(u));
      setUser(u);

      // Handle driver profile from login response
      if (result.driver) {
        const driverProfile: DriverProfile = {
          id: result.driver.id,
          userId: u.id,
          approved: result.driver.approved,
          driverStatus: result.driver.driverStatus,
          busId: result.driver.busId,
          bus: result.driver.bus,
          user: u,
          licenseNumber: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDriver(driverProfile);
        
        // Update driver store immediately
        const { useDriverStore } = await import('../store/driverStore');
        const store = useDriverStore.getState();
        if (driverProfile.bus) {
          store.setInit({
            driverId: driverProfile.id,
            busId: driverProfile.bus.id,
            registrationNo: driverProfile.bus.registrationNo,
            routeId: driverProfile.bus.route?.id || null,
            routeNumber: driverProfile.bus.route?.routeNumber || null,
            routeName: driverProfile.bus.route?.name || null,
            capacity: driverProfile.bus.capacity || 40,
            status: driverProfile.driverStatus as any,
          });
        }
      } else {
        // Fallback: fetch from profile endpoint
        await refreshProfile();
      }
    },
    [refreshProfile],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await api.post('/auth/register', {
        ...payload,
        role: 'DRIVER',
      });
      const result = response.data?.data ?? response.data;

      if (result.accessToken) {
        const u: User = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          status: result.user.status ?? 'PENDING',
        };
        await setItem('accessToken', result.accessToken);
        await setItem('refreshToken', result.refreshToken);
        await setItem('user', JSON.stringify(u));
        setUser(u);
        await refreshProfile();
      }
    },
    [refreshProfile],
  );

  const logout = useCallback(async () => {
    try {
      // Stop any ongoing operations before logout
      const { useDriverStore } = await import('../store/driverStore');
      const reset = useDriverStore.getState().reset;
      reset();

      // Give a brief moment for cleanup effects to run
      await new Promise(resolve => setTimeout(resolve, 100));

      const refreshToken = await getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } catch (error) {
      // Log but don't block logout
      console.warn('Logout cleanup error:', error);
    }
    setUser(null);
    setDriver(null);
    await removeItem('accessToken');
    await removeItem('refreshToken');
    await removeItem('user');
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, driver, isLoading, needsAutoResume, login, register, logout, refreshProfile, clearAutoResume }}
    >
      {children}
    </AuthContext.Provider>
  );
}
