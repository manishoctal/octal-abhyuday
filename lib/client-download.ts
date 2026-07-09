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
    const intentUrl =
      `intent://${u.host}${u.pathname}${u.search}` +
      `#Intent;scheme=${u.protocol.replace(':', '')};` +
      `action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`;
    // Simulate a real tap — Capacitor's shouldOverrideUrlLoading fires on anchor clicks
    // but may swallow programmatic window.location.href assignments.
    const a = document.createElement('a');
    a.href = intentUrl;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(absoluteUrl, '_system');
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
  console.log('[download] isNative check:', typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

  const token = await createToken([photoId]);
  const downloadUrl = toAbsolute(`/api/photos/single/download/${token}`);
  console.log('[download] downloadUrl:', downloadUrl);

  if (platform === 'android') {
    const u = new URL(downloadUrl);
    const intentUrl =
      `intent://${u.host}${u.pathname}${u.search}` +
      `#Intent;scheme=${u.protocol.replace(':', '')};` +
      `action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(downloadUrl)};end`;
    console.log('[download] Android intent URL:', intentUrl);
    const a = document.createElement('a');
    a.href = intentUrl;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    console.log('[download] iOS/web — window.open _system');
    window.open(downloadUrl, '_system');
  }
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
