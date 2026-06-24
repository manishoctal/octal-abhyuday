'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';

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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white/96 backdrop-blur-xl border-b border-slate-100/80">
      <div
        className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Left — back arrow or wordmark */}
        {back && !hideBack ? (
          <Link
            href={back}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 active:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </Link>
        ) : hideBack ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: '#FE9234' }}>
              <span className="text-white font-extrabold text-xs leading-none">O</span>
            </div>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2 shrink-0 active:opacity-70 transition-opacity">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: '#FE9234' }}>
              <span className="text-white font-extrabold text-xs leading-none">O</span>
            </div>
            <span className="font-bold text-slate-900 text-[15px] tracking-tight leading-none">
              {eventName}
            </span>
          </Link>
        )}

        {/* Center — page title */}
        {title ? (
          <span className="flex-1 font-semibold text-slate-900 text-[15px] truncate">{title}</span>
        ) : (
          <span className="flex-1" />
        )}

        {/* Right — admin pill + logout */}
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
            onClick={logout}
            aria-label="Logout"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-red-50 active:text-red-500 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
