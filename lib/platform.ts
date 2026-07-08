/**
 * Returns true when the app is running inside a Capacitor native shell
 * (Android or iOS). False in a regular web browser / PWA.
 */
export function isNative(): boolean {
  return typeof window !== 'undefined' &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.();
}

/**
 * Returns the current platform: 'ios', 'android', or 'web'.
 * Reads from the Capacitor global injected by the native WebView.
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}
