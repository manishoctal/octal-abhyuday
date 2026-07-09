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

/** Resolves a relative URL to an absolute one using the current origin. */
function toAbsolute(url: string): string {
  if (url.startsWith('http')) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Opens a URL in the device's system browser (Safari / Chrome).
 * Used in Capacitor for single-file downloads where we already have a URL.
 */
export function openInSystemBrowser(url: string): void {
  window.open(toAbsolute(url), '_system');
}

/**
 * Downloads a single photo via the system browser.
 * Creates a short-lived token, then opens the GET download URL which responds
 * with Content-Disposition: attachment so the system browser saves the file.
 * Used in Capacitor native builds only.
 */
export async function downloadPhotoNative(photoId: number): Promise<void> {
  const res = await fetch('/api/photos/zip-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds: [photoId] }),
  });
  if (!res.ok) throw new Error('Failed to create download token');
  const { token } = await res.json();
  window.open(toAbsolute(`/api/photos/single/download/${token}`), '_system');
}

/**
 * Downloads selected photos as a ZIP via the system browser.
 * POSTs photoIds to get a short-lived token, then opens the GET download URL.
 * Used in Capacitor native builds only.
 */
export async function downloadZipNative(photoIds: number[]): Promise<void> {
  const res = await fetch('/api/photos/zip-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error('Failed to create download token');
  const { token } = await res.json();
  window.open(toAbsolute(`/api/photos/zip/download/${token}`), '_system');
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
