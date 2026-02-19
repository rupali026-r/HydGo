/**
 * HydGo Driver — Axios HTTP client
 * Mirrors the passenger app's api.ts.
 * Base URL: 192.168.29.195:3000/api (real backend, never localhost)
 * Auto-refresh on 401, queue-based retry.
 */

import axios from 'axios';
import Constants from 'expo-constants';
import { getItem, setItem, removeItem } from './storage';

const baseURL =
  (process.env as any).EXPO_PUBLIC_API_URL ||
  (Constants?.expoConfig?.extra as Record<string, string> | undefined)?.API_BASE_URL ||
  'http://localhost:3000/api';

export const API_BASE = baseURL.replace(/\/api$/, '');

export const api = axios.create({ baseURL, timeout: 15_000 });

// Public endpoints — no auth header
const PUBLIC_PATHS = ['/auth/register', '/auth/login', '/auth/refresh'];

// Attach access token to every non-public request
api.interceptors.request.use(async (config) => {
  const isPublic = PUBLIC_PATHS.some((p) => config.url?.includes(p));
  if (!isPublic) {
    const token = await getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (v: string | null) => void;
  reject: (e: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = PUBLIC_PATHS.some((p) =>
      original?.url?.includes(p),
    );
    if (
      error?.response?.status !== 401 ||
      original._retry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await api.post('/auth/refresh', { refreshToken });
      await setItem('accessToken', data.accessToken);
      await setItem('refreshToken', data.refreshToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api.request(original);
    } catch (e) {
      processQueue(e, null);
      await removeItem('accessToken');
      await removeItem('refreshToken');
      await removeItem('user');
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  },
);
