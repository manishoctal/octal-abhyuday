'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useState } from 'react';

export default function Header({
  eventName,
  title,
  back,
  hideBack = false,
  isAdmin = false,
  name: _name,
}: {
  eventName: string;
  title?: string;
  back?: string;
  hideBack?: boolean;
  isAdmin?: boolean;
  name?: string;
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  async function doLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const isHome = !title && !back;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
        <div
          className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Left */}
          {back && !hideBack ? (
            <Link
              href={back}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shrink-0 active:bg-slate-200 transition-colors"
            >
              <ChevronLeft size={19} strokeWidth={2.2} />
            </Link>
          ) : (
            <Link href="/" className="shrink-0 active:opacity-70 transition-opacity" aria-label="Home">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg,#FE9234 0%,#F97316 100%)' }}
              >
                <span className="text-white font-black text-[13px] leading-none">O</span>
              </div>
            </Link>
          )}

          {/* Center */}
          {isHome ? (
            <span className="flex-1 text-center font-semibold text-slate-900 text-[15px] tracking-tight truncate">
              {eventName}
            </span>
          ) : title ? (
            <span className="flex-1 font-bold text-slate-900 text-[16px] truncate text-center">
              {title}
            </span>
          ) : (
            <span className="flex-1" />
          )}

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="h-7 px-2.5 flex items-center rounded-full text-[11px] font-bold border"
                style={{ background: '#FFF4E8', color: '#FE9234', borderColor: '#FED098' }}
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => setShowDialog(true)}
              aria-label="Logout"
              className="flex items-center gap-1.5 h-9 px-3 rounded-2xl bg-slate-100 text-slate-600 text-[12px] font-semibold active:bg-red-50 active:text-red-500 transition-colors"
            >
              <LogOut size={13} strokeWidth={2.2} />
              <span className="hidden xs:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {showDialog && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-[84px] sm:pb-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FEF2F2' }}>
              <LogOut size={24} strokeWidth={1.8} className="text-red-500" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">Log out?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              You&apos;ll need to sign in again to access the app.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={doLogout}
                className="w-full h-12 rounded-2xl text-white font-semibold text-[15px] transition-opacity active:opacity-90"
                style={{ background: '#EF4444' }}
              >
                Yes, log out
              </button>
              <button
                onClick={() => setShowDialog(false)}
                className="w-full h-12 rounded-2xl bg-slate-100 text-slate-700 font-semibold text-[15px] transition-opacity active:opacity-90"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
