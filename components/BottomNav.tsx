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

  const sz = { size: 21, strokeWidth: 1.7 };

  const tabs: Tab[] = [
    { href: '/',         label: 'Home',     icon: <Home        {...sz} />, match: p => p === '/' },
    { href: '/schedule', label: 'Schedule', icon: <CalendarDays {...sz} />, match: p => p.startsWith('/schedule') },
    { href: '/live',     label: 'Live',     icon: <Zap         {...sz} />, match: p => ['/live','/vote','/qna'].includes(p), pulse: isLive },
    { href: '/gallery',  label: 'Gallery',  icon: <ImageIcon   {...sz} />, match: p => p.startsWith('/gallery') },
    { href: '/me',       label: 'Me',       icon: <User        {...sz} />, match: p => ['/me', '/feedback', '/leaderboard'].includes(p) },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)', paddingTop: 8 }}
    >
      <div
        className="flex items-stretch h-[62px] mx-4 w-full max-w-sm rounded-[22px] overflow-hidden px-2"
        style={{
          background: 'linear-gradient(160deg,#0f1120 0%,#1a1f3c 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset',
        }}
      >
        {tabs.map(tab => {
          const active = tab.match(path);
          const isLiveTab = tab.href === '/live';

          if (isLiveTab) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex-1 flex flex-col items-center justify-center"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-90"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg,#FE9234,#F97316)'
                      : tab.pulse
                      ? 'linear-gradient(135deg,#EF4444,#DC2626)'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: active
                      ? '0 4px 16px rgba(249,115,22,0.5)'
                      : tab.pulse
                      ? '0 4px 16px rgba(239,68,68,0.5)'
                      : 'none',
                  }}
                >
                  {tab.pulse && !active && (
                    <span className="absolute top-1 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-red-400">
                      <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                    </span>
                  )}
                  <span style={{ color: active || tab.pulse ? 'white' : 'rgba(255,255,255,0.45)' }}>
                    {tab.icon}
                  </span>
                  <span className="text-[9px] font-bold leading-none" style={{ color: active || tab.pulse ? 'white' : 'rgba(255,255,255,0.45)' }}>
                    {tab.label}
                  </span>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all active:scale-95"
            >
              {active && (
                <div
                  className="absolute top-2 w-8 h-0.5 rounded-full"
                  style={{ background: '#FE9234' }}
                />
              )}
              <span
                className="transition-all duration-150"
                style={{ color: active ? '#FE9234' : 'rgba(255,255,255,0.38)' }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ color: active ? '#FE9234' : 'rgba(255,255,255,0.38)' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
