/**
 * Cross-platform download helpers.
 *
 * Native (Android/iOS): uses @capacitor/browser to open the download URL in the
 * system browser.  The server responds with Content-Disposition: attachment and a
 * short-lived token so the browser can save the file without requiring a session cookie.
 * Single photos → /api/photos/single/download/[token]
 * ZIP bundles   → /api/photos/zip/download/[token]
 *
 * Desktop web: blob + anchor click (standard browser download).
 */

import { getPlatform } from '@/lib/platform';

/** Resolves a relative URL to an absolute one using the current origin. */
function toAbsolute(url: string): string {
  if (url.startsWith('http')) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Opens a URL in the system browser.
 *
 * Uses @capacitor/browser which calls the correct Android API (startActivity
 * with a proper VIEW intent) and WKWebView openURL on iOS.  The system browser
 * receives Content-Disposition: attachment and handles the download natively.
 */
type BrowserPlugin = { open: (opts: { url: string }) => Promise<void> };

async function openExternal(absoluteUrl: string): Promise<void> {
  const platform = getPlatform();
  if (platform === 'android' || platform === 'ios') {
    // Call the natively-registered plugin via the Capacitor bridge directly.
    // A bare `import('@capacitor/browser')` cannot resolve inside the WebView
    // because this app is remote-hosted (server.url) — the bridge object is
    // the only reliable handle to native plugins.
    const cap = (window as unknown as {
      Capacitor?: { Plugins?: { Browser?: BrowserPlugin } };
    }).Capacitor;
    const browser = cap?.Plugins?.Browser;
    console.log('[download] Browser plugin available:', !!browser);
    if (browser) {
      await browser.open({ url: absoluteUrl });
      console.log('[download] Browser.open resolved');
      return;
    }
    // Old APK without the Browser plugin — last-resort fallback.
    console.warn('[download] Browser plugin missing — falling back to window.open');
    window.open(absoluteUrl, '_blank');
  } else {
    window.open(absoluteUrl, '_blank');
  }
}

async function createToken(photoIds: number[]): Promise<string> {
  console.log('[download] createToken →', photoIds);
  const res = await fetch('/api/photos/zip-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds }),
  });
  console.log('[download] zip-token response status:', res.status);
  if (!res.ok) throw new Error(`Failed to create download token (HTTP ${res.status})`);
  const body = await res.json();
  console.log('[download] token received:', body.token ? body.token.slice(0, 12) + '…' : 'MISSING');
  return body.token as string;
}

export async function downloadPhotoNative(photoId: number): Promise<void> {
  const platform = getPlatform();
  console.log('[download] downloadPhotoNative — photoId:', photoId, 'platform:', platform);

  const token = await createToken([photoId]);
  const downloadUrl = toAbsolute(`/api/photos/single/download/${token}`);
  console.log('[download] downloadUrl:', downloadUrl);
  await openExternal(downloadUrl);
}

export async function downloadZipNative(photoIds: number[]): Promise<void> {
  const platform = getPlatform();
  console.log('[download] downloadZipNative — photoIds:', photoIds, 'platform:', platform);

  const token = await createToken(photoIds);
  const downloadUrl = toAbsolute(`/api/photos/zip/download/${token}`);
  console.log('[download] zip downloadUrl:', downloadUrl);
  openExternal(downloadUrl);
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
