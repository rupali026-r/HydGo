// ── Navigation Utilities ────────────────────────────────────────────────────
// Consistent back-navigation across all screens.
// Uses router.canGoBack() with fallback to home.

import type { Router } from 'expo-router';

const HOME_PATH = '/(app)/passenger/home';

/**
 * Go back one screen. If the navigation stack is empty,
 * replace with the passenger home screen.
 */
export function goBack(router: Router): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(HOME_PATH as any);
  }
}
