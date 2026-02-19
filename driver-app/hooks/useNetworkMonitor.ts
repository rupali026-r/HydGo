/**
 * HydGo Driver — Network State Monitor
 *
 * Detects network connectivity changes and triggers appropriate actions:
 *   - Network lost → DISCONNECTED state, pause emissions, offline banner
 *   - Network restored → reconnect socket, replay buffer, resume heartbeat
 *
 * Uses @react-native-community/netinfo for reliable network state detection.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { useDriverStore } from '../store/driverStore';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

interface UseNetworkMonitorOptions {
  onNetworkLost: () => void;
  onNetworkRestored: () => void;
}

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useNetworkMonitor({
  onNetworkLost,
  onNetworkRestored,
}: UseNetworkMonitorOptions) {
  const wasConnectedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const setError = useDriverStore((s) => s.setError);

  const handleStateChange = useCallback(
    (state: NetworkState) => {
      const isOnline = state.isConnected && state.isInternetReachable !== false;

      if (!isOnline && wasConnectedRef.current) {
        // Transition: online → offline
        wasConnectedRef.current = false;
        setError('Network connection lost');
        onNetworkLost();
      } else if (isOnline && !wasConnectedRef.current) {
        // Transition: offline → online
        wasConnectedRef.current = true;
        setError(null);
        onNetworkRestored();
      }
    },
    [onNetworkLost, onNetworkRestored, setError],
  );

  useEffect(() => {
    // Skip on web — navigator.onLine is handled differently
    if (Platform.OS === 'web') {
      const onOnline = () =>
        handleStateChange({ isConnected: true, isInternetReachable: true });
      const onOffline = () =>
        handleStateChange({ isConnected: false, isInternetReachable: false });

      if (typeof window !== 'undefined') {
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
          window.removeEventListener('online', onOnline);
          window.removeEventListener('offline', onOffline);
        };
      }
      return;
    }

    // Native: use NetInfo
    let mounted = true;

    (async () => {
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        if (!mounted) return;

        unsubscribeRef.current = NetInfo.default.addEventListener((state) => {
          if (!mounted) return;
          handleStateChange({
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable,
          });
        });
      } catch {
        // NetInfo not available (e.g., web fallback)
      }
    })();

    return () => {
      mounted = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [handleStateChange]);
}
