/**
 * Trailing-edge throttle.
 * Guarantees the last call within the interval always fires.
 */

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  intervalMs: number,
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer !== null) return;

    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, intervalMs);
  };

  return throttled as unknown as T;
}
