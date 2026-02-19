// ── Passenger Socket Hook ───────────────────────────────────────────────────
// Manages WebSocket connection to /passenger namespace.
// Emits location, handles snapshot/update/offline events.

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { getItem, setItem } from '@/lib/storage';
import { api } from '@/lib/api';
import { usePassengerStore } from '../store/passengerStore';
import type { BusState, BusUpdate, SuggestionInfo } from '../types';

const WS_URL =
  (process.env as any).EXPO_PUBLIC_API_URL?.replace('/api', '') ||
  (Constants?.expoConfig?.extra as any)?.API_BASE_URL?.replace('/api', '') ||
  'http://localhost:3000';

const LOCATION_THROTTLE_MS = 5_000;

/** Ensure we have a non-expired access token, refreshing via /auth/refresh if needed */
async function ensureFreshToken(): Promise<string | null> {
  const token = await getItem('accessToken');
  if (!token) return null;

  // Decode JWT payload to check expiry (no crypto verification – server does that)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp > now + 60) {
      return token; // still valid with 60 s buffer
    }
  } catch {
    // Cannot decode — fall through to refresh
  }

  // Token expired or un-decodable → attempt refresh
  try {
    const refreshToken = await getItem('refreshToken');
    if (!refreshToken) return null;
    const { data } = await api.post('/auth/refresh', { refreshToken });
    const result = data?.data ?? data;
    await setItem('accessToken', result.accessToken);
    await setItem('refreshToken', result.refreshToken);
    return result.accessToken;
  } catch {
    return null;
  }
}

export function usePassengerSocket() {
  const socketRef = useRef<Socket | null>(null);
  const lastSendRef = useRef(0);

  const setSnapshot = usePassengerStore((s) => s.setSnapshot);
  const updateBus = usePassengerStore((s) => s.updateBus);
  const updateBuses = usePassengerStore((s) => s.updateBuses);
  const removeBus = usePassengerStore((s) => s.removeBus);
  const setNearbyBuses = usePassengerStore((s) => s.setNearbyBuses);
  const setSuggestions = usePassengerStore((s) => s.setSuggestions);
  const setConnectionStatus = usePassengerStore((s) => s.setConnectionStatus);

  // Connect on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await ensureFreshToken();
      // Allow connection even without token (guest mode — read-only bus data)

      setConnectionStatus('connecting');

      const socket = io(`${WS_URL}/passenger`, {
        auth: token ? { token } : {},
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (!mounted) return;
        setConnectionStatus('connected');
      });

      socket.on('disconnect', () => {
        if (!mounted) return;
        setConnectionStatus('disconnected');
      });

      socket.on('connect_error', async (err) => {
        if (!mounted) return;
        console.warn('[Socket] connect_error:', err.message);

        // If auth-related, try refreshing the token for the next reconnection attempt
        if (
          err.message?.includes('token') ||
          err.message?.includes('Authentication') ||
          err.message?.includes('auth')
        ) {
          const freshToken = await ensureFreshToken();
          if (freshToken && mounted) {
            (socket.auth as any).token = freshToken;
            // Socket.IO auto-reconnects; updated auth will be used on next attempt
          }
        }

        setConnectionStatus('error');
      });

      // Initial snapshot of all active buses
      socket.on('buses:snapshot', (buses: BusState[]) => {
        if (!mounted) return;
        setSnapshot(buses);
      });

      // Periodic simulation updates (array of bus updates)
      socket.on('buses:update', (updates: BusUpdate[]) => {
        if (!mounted) return;
        updateBuses(updates);
      });

      // Real driver location update (singular)
      socket.on('bus:update', (update: BusUpdate) => {
        if (!mounted) return;
        updateBus(update);
      });

      // Nearby buses enriched with ETA + distance + intelligence
      socket.on('buses:nearby', (buses: BusState[]) => {
        if (!mounted) return;
        setNearbyBuses(buses);
      });

      // Smart suggestions (top 3 ranked buses)
      socket.on('buses:suggestions', (suggestions: SuggestionInfo[]) => {
        if (!mounted) return;
        setSuggestions(suggestions);
      });

      // Bus went offline (driver disconnect)
      socket.on('bus:offline', (data: { busId: string }) => {
        if (!mounted) return;
        removeBus(data.busId);
      });
    })();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, []);

  // Send user location to server (throttled)
  const sendLocation = useCallback((latitude: number, longitude: number) => {
    const now = Date.now();
    if (now - lastSendRef.current < LOCATION_THROTTLE_MS) return;
    lastSendRef.current = now;

    socketRef.current?.emit('location:send', { latitude, longitude });
  }, []);

  return { sendLocation, socket: socketRef };
}
