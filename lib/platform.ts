/**
 * Lightweight client-side runtime detection.
 *
 * Capacitor injects `window.Capacitor` into the native WebView. We use that to
 * decide whether to register a Web-Push subscription (browser/PWA) or an FCM
 * device token (native), and tag it with the right `platform` when calling
 * /api/push/subscribe. The server stores both in `push_subscriptions`.
 */

type NativePlatform = 'web' | 'android' | 'ios';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the Capacitor native shell (Android/iOS app). */
export function isNative(): boolean {
  return cap()?.isNativePlatform?.() ?? false;
}

/** 'web' in a browser/PWA, 'android' or 'ios' inside the native app. */
export function getPlatform(): NativePlatform {
  const p = cap()?.getPlatform?.();
  return p === 'android' || p === 'ios' ? p : 'web';
}
