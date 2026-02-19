/**
 * HydGo Driver — Design Tokens
 * Mirrors the passenger app's dark-mode palette.
 * Pure black + white. No gradients. Minimal.
 */

export const Colors = {
  bg: '#000',
  surface: '#0a0a0a',
  surfaceAlt: '#111',
  border: '#1A1A1A',
  borderFocus: '#fff',

  textPrimary: '#fff',
  textSecondary: '#ccc',
  textMuted: '#888',
  textDim: '#555',
  placeholder: '#555',

  ctaPrimaryBg: '#fff',
  ctaPrimaryText: '#000',
  ctaSecondaryBorder: '#333',
  ctaSecondaryText: '#fff',

  error: '#ff4444',
  success: '#4CAF50',
  warning: '#FFC107',
  info: '#2196F3',

  occupancyLow: '#22C55E',
  occupancyMedium: '#EAB308',
  occupancyHigh: '#F97316',
  occupancyFull: '#EF4444',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const Font = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 15,
  lg: 16,
  xl: 20,
  xxl: 28,
  hero: 36,
} as const;

/** Navigation theme passed to ThemeProvider */
export const DARK_THEME = {
  dark: true as const,
  colors: {
    background: Colors.bg,
    card: Colors.bg,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.textPrimary,
    notification: Colors.textPrimary,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};
