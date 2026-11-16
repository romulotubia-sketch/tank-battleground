export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function triggerHaptic(enabled: boolean, pattern: number | number[]): void {
  if (!enabled || !isVibrationSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Safely ignore if blocked or unsupported in embedded WebViews
  }
}
