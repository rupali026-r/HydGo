// ── HydGo Premium Dark Theme ────────────────────────────────────────────────
// Pure black + white foundation with semantic accent colors.
// No gradients. No emojis. 18px rounded containers. Glassmorphism overlays.
// Inter font family. 60fps animations. Subtle elevation shadows.

export const Theme = {
  // ── Core ──
  bg: '#000000',
  bgCard: '#111111',
  bgElevated: '#1A1A1A',
  bgInput: '#0A0A0A',
  bgGlass: 'rgba(17,17,17,0.85)',
  bgGlassLight: 'rgba(26,26,26,0.75)',
  bgOverlay: 'rgba(0,0,0,0.6)',
  border: '#1A1A1A',
  borderSubtle: '#222222',
  borderGlass: 'rgba(255,255,255,0.06)',

  // ── Text ──
  text: '#FFFFFF',
  textSecondary: '#CCCCCC',
  textTertiary: '#888888',
  textMuted: '#666666',
  textDim: '#444444',

  // ── Accent ──
  accent: '#FFFFFF',
  accentBlue: '#3B82F6',
  accentGreen: '#22C55E',
  accentAmber: '#EAB308',
  accentRed: '#EF4444',

  // ── Traffic ──
  trafficLow: '#22C55E',
  trafficModerate: '#EAB308',
  trafficHigh: '#EF4444',

  // ── Occupancy ──
  occupancyLow: '#22C55E',
  occupancyMedium: '#EAB308',
  occupancyHigh: '#F97316',
  occupancyFull: '#EF4444',

  // ── Confidence ──
  confidenceHigh: '#22C55E',
  confidenceMedium: '#EAB308',
  confidenceLow: '#EF4444',

  // ── Reliability ──
  reliabilityHigh: '#22C55E',
  reliabilityMedium: '#EAB308',
  reliabilityLow: '#EF4444',

  // ── Radii ──
  radius: 18,
  radiusMd: 14,
  radiusSm: 10,
  radiusXs: 8,
  radiusFull: 999,

  // ── Shadows (web-compatible boxShadow) ──
  shadow: {
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  shadowSubtle: {
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.25)',
    elevation: 4,
  },
  shadowHeavy: {
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.5)',
    elevation: 16,
  },

  // ── Glassmorphism ──
  glass: {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  glassLight: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  // ── Spacing ──
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // ── Font sizes ──
  font: {
    xs: 9,
    sm: 11,
    md: 13,
    lg: 15,
    xl: 18,
    xxl: 24,
    hero: 32,
    display: 40,
  },

  // ── Animation ──
  anim: {
    fast: 150,
    normal: 300,
    slow: 500,
    spring: { damping: 22, stiffness: 200, mass: 0.7 },
    springBouncy: { damping: 16, stiffness: 180, mass: 0.6 },
    springHeavy: { damping: 28, stiffness: 220, mass: 0.9 },
  },

  // ── Touch targets ──
  touchMin: 44,
} as const;

// ── Semantic color maps ──
export const OCCUPANCY_COLORS = {
  LOW: Theme.occupancyLow,
  MEDIUM: Theme.occupancyMedium,
  HIGH: Theme.occupancyHigh,
  FULL: Theme.occupancyFull,
} as const;

export const TRAFFIC_COLORS = {
  LOW: Theme.trafficLow,
  MODERATE: Theme.trafficModerate,
  HIGH: Theme.trafficHigh,
} as const;

export const CONFIDENCE_COLORS = {
  HIGH: Theme.confidenceHigh,
  MEDIUM: Theme.confidenceMedium,
  LOW: Theme.confidenceLow,
} as const;

export const RELIABILITY_COLORS = {
  HIGH: Theme.reliabilityHigh,
  MEDIUM: Theme.reliabilityMedium,
  LOW: Theme.reliabilityLow,
} as const;

export type OccupancyLevel = keyof typeof OCCUPANCY_COLORS;
export type TrafficLevel = keyof typeof TRAFFIC_COLORS;
export type ConfidenceLabel = keyof typeof CONFIDENCE_COLORS;
export type ReliabilityLabel = keyof typeof RELIABILITY_COLORS;
