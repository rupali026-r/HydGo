// ── ETA Smoothing Hook ──────────────────────────────────────────────────────
// Prevents ETA display from flickering wildly between updates.
//
// Formula: smoothedETA = (0.7 × previousETA) + (0.3 × newETA)
// Applied only when difference > 30%.
// Resets when bus changes or ETA is null.

import { useRef, useCallback } from 'react';

// S7: tightened thresholds — trigger at 25%, heavier smoothing (0.8/0.2) for large jumps
const SMOOTH_THRESHOLD = 0.18; // 18% difference triggers smoothing
const SMOOTH_WEIGHT_PREV_LARGE = 0.8;
const SMOOTH_WEIGHT_NEW_LARGE = 0.2;
const SMOOTH_WEIGHT_PREV_NORMAL = 0.7;
const SMOOTH_WEIGHT_NEW_NORMAL = 0.3;
const LARGE_DELTA_THRESHOLD = 0.40; // >40% delta uses heavier smoothing

interface SmoothedETA {
  estimatedMinutes: number;
  formattedETA: string;
  isSmoothed: boolean;
}

export function useETASmoothing() {
  const prevETARef = useRef<Map<string, number>>(new Map());

  /**
   * Smooth an ETA value for a given bus.
   * Returns the smoothed minutes and formatted string.
   */
  const smooth = useCallback(
    (busId: string, rawMinutes: number | undefined): SmoothedETA | null => {
      if (rawMinutes == null || rawMinutes < 0) {
        prevETARef.current.delete(busId);
        return null;
      }

      const prev = prevETARef.current.get(busId);

      // No previous value — use raw
      if (prev == null) {
        prevETARef.current.set(busId, rawMinutes);
        return { estimatedMinutes: rawMinutes, formattedETA: formatMinutes(rawMinutes), isSmoothed: false };
      }

      // Check if difference exceeds threshold
      const diff = Math.abs(rawMinutes - prev) / Math.max(prev, 1);
      let smoothed: number;
      let isSmoothed = false;

      if (diff > LARGE_DELTA_THRESHOLD) {
        // S7: large jump — use heavier smoothing to prevent flicker
        smoothed = Math.round(SMOOTH_WEIGHT_PREV_LARGE * prev + SMOOTH_WEIGHT_NEW_LARGE * rawMinutes);
        isSmoothed = true;
      } else if (diff > SMOOTH_THRESHOLD) {
        // Moderate jump — normal smoothing
        smoothed = Math.round(SMOOTH_WEIGHT_PREV_NORMAL * prev + SMOOTH_WEIGHT_NEW_NORMAL * rawMinutes);
        isSmoothed = true;
      } else {
        smoothed = rawMinutes;
      }

      prevETARef.current.set(busId, smoothed);
      return { estimatedMinutes: smoothed, formattedETA: formatMinutes(smoothed), isSmoothed };
    },
    [],
  );

  /** Clear smoothing state for a bus (e.g., on deselect) */
  const reset = useCallback((busId?: string) => {
    if (busId) {
      prevETARef.current.delete(busId);
    } else {
      prevETARef.current.clear();
    }
  }, []);

  return { smooth, reset };
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return 'Arriving now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
