import { Platform } from 'react-native';

// SecureStore with automatic web fallback to localStorage
// Expo SecureStore throws on web, so we detect platform at runtime.

let _secureStore: typeof import('expo-secure-store') | null = null;

async function getSecureStore() {
  if (Platform.OS !== 'web' && !_secureStore) {
    _secureStore = await import('expo-secure-store');
  }
  return _secureStore;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  const store = await getSecureStore();
  await store?.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const store = await getSecureStore();
  return (await store?.getItemAsync(key)) ?? null;
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  const store = await getSecureStore();
  await store?.deleteItemAsync(key);
}
