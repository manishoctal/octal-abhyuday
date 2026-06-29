'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isNative } from '@/lib/platform';

interface ReleaseInfo {
  downloadUrl:    string | null;
  versionName:    string | null;
  minVersionCode: number | null;
}

/**
 * Mounts once in the root layout.  On native Capacitor builds it compares the
 * device's versionCode against the minimum required version from the server.
 * If the build is too old it blocks the UI with a non-dismissable update prompt.
 */
export default function AppUpdateCheck() {
  const pathname                          = usePathname();
  const [updateRequired, setUpdateRequired] = useState(false);
  const [release, setRelease]               = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    // Don't block the install page itself — user is already downloading
    if (pathname === '/install' || !isNative()) return;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const [info, res] = await Promise.all([
          App.getInfo(),
          fetch('/api/app/release'),
        ]);
        if (!res.ok) return;

        const data: ReleaseInfo = await res.json();
        if (!data.minVersionCode) return;

        const currentBuild = Number.parseInt(info.build, 10);
        if (!Number.isNaN(currentBuild) && currentBuild < data.minVersionCode) {
          setRelease(data);
          setUpdateRequired(true);
        }
      } catch {
        // Never block the app for update-check errors
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!updateRequired || !release) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(15,16,53,0.97)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="px-6 pt-8 pb-5 text-center"
          style={{ background: 'linear-gradient(135deg,#0F1035,#1E1B4B)' }}
        >
          <div className="text-5xl mb-2">🚀</div>
          <h2 className="text-white font-black text-xl">Update Required</h2>
          <p className="text-white/60 text-sm mt-1">A new version is available</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4 text-center">
          <p className="text-slate-600 text-sm leading-relaxed">
            Please update the app to continue.
            {release.versionName && ` Version ${release.versionName} is now available.`}
          </p>

          <a
            href={release.downloadUrl ?? '/install'}
            className="block w-full py-4 rounded-2xl text-white font-black text-base"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}
          >
            ⬇ Download Update
          </a>

          <p className="text-xs text-slate-400">
            Download the APK, open it, and tap Install
          </p>
        </div>
      </div>
    </div>
  );
}
