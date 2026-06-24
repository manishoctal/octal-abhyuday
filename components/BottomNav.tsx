'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Home, CalendarDays, Zap, ImageIcon, User } from 'lucide-react';
import { useRealtime } from './useRealtime';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const path = usePathname();
  const { data } = useSWR('/api/state', fetcher, { refreshInterval: 30000 });
  useRealtime(['/api/state']);

  const isLive = data?.state?.voting_state === 'live' || data?.state?.voting_state === 'paused';

  const tabs = [
    { href: '/',         label: 'Home',     icon: Home,        match: (p: string) => p === '/' },
    { href: '/schedule', label: 'Schedule', icon: CalendarDays, match: (p: string) => p.startsWith('/schedule') },
    { href: '/live',     label: 'Live',     icon: Zap,          match: (p: string) => ['/live','/vote','/qna'].includes(p), live: true, pulse: isLive },
    { href: '/gallery',  label: 'Gallery',  icon: ImageIcon,    match: (p: string) => p.startsWith('/gallery') },
    { href: '/me',       label: 'Me',       icon: User,         match: (p: string) => ['/me','/feedback','/leaderboard'].includes(p) },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50"
      style={{
        background: 'rgba(9,9,18,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center h-[60px] max-w-lg mx-auto px-2">
        {tabs.map(tab => {
          const active = tab.match(path);
          const Icon = tab.icon;

          if (tab.live) {
            return (
              <Link key={tab.href} href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 relative">
                <div
                  className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center -mt-5 transition-transform active:scale-90"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg,#FF7A00,#FF4F87)'
                      : tab.pulse
                      ? 'linear-gradient(135deg,#EF4444,#DC2626)'
                      : 'linear-gradient(135deg,#FF7A00,#FF4F87)',
                    boxShadow: active || tab.pulse
                      ? '0 4px 18px rgba(255,79,135,0.45)'
                      : '0 4px 18px rgba(255,122,0,0.4)',
                  }}
                >
                  {tab.pulse && !active && (
                    <span className="absolute -top-0.5 right-[calc(50%-16px)] w-2 h-2 rounded-full bg-white">
                      <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
                    </span>
                  )}
                  <Icon size={20} strokeWidth={1.8} color="white" />
                </div>
                <span className="text-[10px] font-bold leading-none" style={{ color:'#FF7A00' }}>
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1 relative active:scale-95 transition-transform">
              {active && (
                <span className="absolute top-0 w-8 h-[3px] rounded-full"
                  style={{ background:'linear-gradient(90deg,#FF7A00,#FF4F87)' }} />
              )}
              <Icon size={22} strokeWidth={1.7}
                style={{ color: active ? '#FF7A00' : 'rgba(255,255,255,0.35)' }} />
              <span className="text-[10px] font-semibold leading-none"
                style={{ color: active ? '#FF7A00' : 'rgba(255,255,255,0.35)' }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
