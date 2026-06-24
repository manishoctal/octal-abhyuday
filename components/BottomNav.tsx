'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Home, CalendarDays, Zap, ImageIcon, User } from 'lucide-react';
import { useRealtime } from './useRealtime';

const fetcher = (u: string) => fetch(u).then(r => r.json());

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
  pulse?: boolean;
}

export default function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const path = usePathname();
  const { data } = useSWR('/api/state', fetcher, { refreshInterval: 30000 });
  useRealtime(['/api/state']);

  const isLive =
    data?.state?.voting_state === 'live' || data?.state?.voting_state === 'paused';

  const sz = { size: 22, strokeWidth: 1.6 };

  const tabs: Tab[] = [
    { href: '/',         label: 'Home',     icon: <Home     {...sz} />, match: p => p === '/' },
    { href: '/schedule', label: 'Schedule', icon: <CalendarDays {...sz} />, match: p => p.startsWith('/schedule') },
    { href: '/live',     label: 'Live',     icon: <Zap      {...sz} />, match: p => ['/live','/vote','/qna'].includes(p), pulse: isLive },
    { href: '/gallery',  label: 'Gallery',  icon: <ImageIcon {...sz} />, match: p => p.startsWith('/gallery') },
    { href: '/me',       label: 'Me',       icon: <User     {...sz} />, match: p => ['/me', '/feedback', '/leaderboard'].includes(p) },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-[60px] max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = tab.match(path);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] relative"
              style={{ color: active ? '#FE9234' : '#94A3B8' }}
            >
              {active && (
                <span
                  className="absolute top-0 w-8 h-0.5 rounded-full"
                  style={{ background: '#FE9234' }}
                />
              )}
              {tab.pulse && !active && (
                <span className="absolute top-2 right-[calc(50%-10px)] w-2 h-2 rounded-full bg-red-500">
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                </span>
              )}
              <span className={`transition-transform duration-150 ${active ? 'scale-110' : 'scale-100'}`}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold leading-none tracking-tight">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
