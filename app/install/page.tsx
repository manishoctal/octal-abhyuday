import { headers } from 'next/headers';
import { getSetting } from '@/lib/db';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export default async function InstallPage() {
  const downloadUrl  = getSetting('apk_url') ?? '';
  const versionName  = getSetting('apk_version_name') ?? '';
  const releaseNotes = getSetting('apk_release_notes') ?? '';

  // Always make the URL absolute — relative paths (/releases/...) break QR scanners
  const host = headers().get('host') ?? '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const absoluteDownloadUrl = downloadUrl.startsWith('http')
    ? downloadUrl
    : downloadUrl.startsWith('/')
      ? `${proto}://${host}${downloadUrl}`
      : downloadUrl;

  let qrSvg = '';
  if (downloadUrl) {
    qrSvg = await QRCode.toString(absoluteDownloadUrl, {
      type: 'svg',
      width: 240,
      margin: 2,
      color: { dark: '#0F1035', light: '#ffffff' },
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg,#0F1035 0%,#1E1B4B 100%)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* ── Branding ── */}
        <div
          className="px-6 py-7 text-center"
          style={{ background: 'linear-gradient(135deg,#0F1035,#1E1B4B)' }}
        >
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl font-black text-white mb-3"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}
          >
            A
          </div>
          <h1 className="text-white font-black text-xl tracking-tight">ABHYUDAY</h1>
          <p className="text-white/50 text-xs mt-1">Octal IT Solution LLP</p>
          {versionName && (
            <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full text-white/80"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              v{versionName}
            </span>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-6 space-y-5 text-center">
          {downloadUrl ? (
            <>
              {/* QR Code */}
              {qrSvg && (
                <div
                  className="flex justify-center p-3 rounded-2xl mx-auto w-fit"
                  style={{ background: '#f8f9ff' }}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}

              <p className="text-slate-500 text-sm">
                Scan the QR code or tap the button below to download
              </p>

              <a
                href={downloadUrl}
                className="block w-full py-4 rounded-2xl text-white font-black text-base"
                style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}
              >
                ⬇ Download APK
              </a>

              {releaseNotes && (
                <div className="text-left rounded-2xl p-4 bg-slate-50">
                  <p className="font-bold text-slate-800 text-sm mb-1">What&apos;s new</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {releaseNotes}
                  </p>
                </div>
              )}

              <div className="text-xs text-slate-400 space-y-1 pt-1">
                <p>Android only · Tap Download → Open the file</p>
                <p>Allow &quot;Install unknown apps&quot; if prompted</p>
              </div>
            </>
          ) : (
            <div className="py-10 text-slate-400">
              <p className="text-4xl mb-3">🔧</p>
              <p className="font-semibold text-slate-600">No build available yet</p>
              <p className="text-sm mt-1">Check back soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
