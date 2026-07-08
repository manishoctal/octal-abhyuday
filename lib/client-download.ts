/**
 * Cross-platform file download that works in both:
 *   - Desktop/mobile browsers: anchor click with blob URL
 *   - Capacitor WebViews (iOS/Android): Web Share API with native share sheet
 *
 * On iOS WKWebView and Android WebView, `<a download>` is silently ignored.
 * navigator.share({ files }) opens the native OS share sheet where the user
 * can save to Photos, Files, WhatsApp, etc.
 *
 * Usage:
 *   const blob = await res.blob();
 *   await triggerDownload(blob, 'photo.jpg', 'image/jpeg');
 */
export async function triggerDownload(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  // Web Share API — works in Capacitor WebViews; opens native share sheet
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      // AbortError = user dismissed the share sheet — treat as success
      if ((e as Error)?.name === 'AbortError') return;
      // Any other error falls through to the anchor approach
    }
  }

  // Fallback: anchor click — works in desktop browsers
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
