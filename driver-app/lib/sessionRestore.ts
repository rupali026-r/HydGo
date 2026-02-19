/**
 * HydGo Driver — Session Restore Engine
 *
 * On app boot (or crash recovery):
 *   1. Load tokens from SecureStore
 *   2. Attempt token refresh if expired
 *   3. Reconnect socket
 *   4. Wait for driver:init to restore correct state
 *   5. Resume background tracking if driver was ONLINE/ON_TRIP
 *
 * No manual re-login required unless refresh token is expired.
 */

import { api } from './api';
import { getItem, setItem, removeItem } from './storage';
import type { User, DriverProfile } from './types';

export interface SessionData {
  user: User;
  driver: DriverProfile | null;
  tokenValid: boolean;
}

/**
 * Attempt to restore a session from secure storage.
 * Returns null if no session exists or tokens are irrecoverable.
 */
export async function restoreSession(): Promise<SessionData | null> {
  try {
    const [rawUser, accessToken, refreshToken] = await Promise.all([
      getItem('user'),
      getItem('accessToken'),
      getItem('refreshToken'),
    ]);

    if (!rawUser || !refreshToken) return null;

    const user: User = JSON.parse(rawUser);

    // Try the access token first
    if (accessToken) {
      try {
        const { data } = await api.get('/drivers/profile');
        const driver: DriverProfile = data.data ?? data;
        return { user, driver, tokenValid: true };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 401) {
          // Non-auth error (network, server down) — token might still be valid
          return { user, driver: null, tokenValid: true };
        }
      }
    }

    // Access token expired — try refresh
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken });
      const newAccess = data.data?.accessToken ?? data.accessToken;
      const newRefresh = data.data?.refreshToken ?? data.refreshToken;

      if (newAccess) {
        await setItem('accessToken', newAccess);
        if (newRefresh) {
          await setItem('refreshToken', newRefresh);
        }

        // Fetch driver profile with fresh token
        try {
          const { data: profileData } = await api.get('/drivers/profile');
          const driver: DriverProfile = profileData.data ?? profileData;
          return { user, driver, tokenValid: true };
        } catch {
          return { user, driver: null, tokenValid: true };
        }
      }
    } catch {
      // Refresh failed — session irrecoverable
    }

    // Clean up invalid session
    await Promise.all([
      removeItem('accessToken'),
      removeItem('refreshToken'),
      removeItem('user'),
    ]);

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a driver should auto-resume tracking based on their status.
 */
export function shouldAutoResume(driver: DriverProfile | null): boolean {
  if (!driver) return false;
  if (!driver.approved) return false;
  if (!driver.busId) return false;

  return (
    driver.driverStatus === 'ONLINE' ||
    driver.driverStatus === 'ON_TRIP' ||
    driver.driverStatus === 'IDLE'
  );
}
