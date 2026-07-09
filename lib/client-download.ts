/**
 * Cross-platform download helpers.
 *
 * Capacitor WebViews (iOS WKWebView / Android WebView) do NOT support:
 *   - <a download> with blob: URLs
 *   - navigator.share({ files }) when called after an async fetch (gesture context lost on iOS)
 *
 * The reliable Capacitor path:
 *   - Single file  → window.open(absoluteUrl, '_system') opens Safari/Chrome where the
 *                    user can save/download the file natively.
 *   - ZIP          → POST to /api/photos/zip-token to get a short-lived token, then
 *                    window.open('/api/photos/zip/download/[token]', '_system').
 *                    The system browser makes a plain GET, receives Content-Disposition:
 *                    attachment, and handles the download natively.
 *
 * On desktop web, the blob + anchor approach works fine.
 */

import { getPlatform } from '@/lib/platform';

/** Resolves a relative URL to an absolute one using the current origin. */
function toAbsolute(url: string): string {
  if (url.startsWith('http')) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Opens a URL in an external browser.
 *
 * Android: uses an Intent URL (`intent://`) which Android's WebView intercepts
 * via shouldOverrideUrlLoading and launches Chrome directly.  Chrome then handles
 * the Content-Disposition: attachment response and saves the file to Downloads.
 *
 * iOS: `window.open(_system)` is handled by WKWebView/Capacitor to open Safari.
 * Safari respects Content-Disposition: attachment and offers a Download button.
 *
 * We do NOT use window.open(_system) on Android because Capacitor 6 without
 * @capacitor/browser silently drops _system window.open calls.
 */
function openExternal(absoluteUrl: string): void {
  if (getPlatform() === 'android') {
    const u = new URL(absoluteUrl);
    // intent:// URL triggers shouldOverrideUrlLoading → startActivity(Intent) → Chrome
    const intentUrl =
      `intent://${u.host}${u.pathname}${u.search}` +
      `#Intent;scheme=${u.protocol.replace(':', '')};` +
      `action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`;
    window.location.href = intentUrl;
  } else {
    window.open(absoluteUrl, '_system');
  }
}

async function createToken(photoIds: number[]): Promise<string> {
  const res = await fetch('/api/photos/zip-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error('Failed to create download token');
  const { token } = await res.json();
  return token as string;
}

/**
 * Downloads a single photo in the native Capacitor app.
 * Creates a short-lived token → opens /api/photos/single/download/[token] externally.
 * The server responds with Content-Disposition: attachment, triggering the browser download.
 */
export async function downloadPhotoNative(photoId: number): Promise<void> {
  const token = await createToken([photoId]);
  openExternal(toAbsolute(`/api/photos/single/download/${token}`));
}

/**
 * Downloads selected photos as a ZIP in the native Capacitor app.
 * Creates a short-lived token → opens /api/photos/zip/download/[token] externally.
 */
export async function downloadZipNative(photoIds: number[]): Promise<void> {
  const token = await createToken(photoIds);
  openExternal(toAbsolute(`/api/photos/zip/download/${token}`));
}

/**
 * Triggers a file download from a Blob in web/desktop browsers.
 * Capacitor native builds never reach this — they use downloadPhotoNative / downloadZipNative.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
