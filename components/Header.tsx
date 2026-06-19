'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header({
  name,
  eventName,
  isAdmin = false,
}: {
  name: string;
  eventName: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition" title="Home">
          <span className="text-xl">🏆</span>
          <span className="font-extrabold text-slate-900 truncate">{eventName}</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Home
          </Link>
          <span className="hidden sm:block text-sm font-semibold text-slate-400 truncate max-w-[140px]">
            {name}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-full text-sm font-semibold text-red-600 hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
