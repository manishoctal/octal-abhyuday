'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Home, CalendarDays, Zap, ImageIcon, User } from 'lucide-react';
import { useRealtime } from './useRealtime';
import { usePushRegistration } from './usePushRegistration';
import { useWebPushSubscription } from './useWebPushSubscription';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const { data }       = useSWR('/api/state',      fetcher, { refreshInterval: 30000 });
  const { data: cfg }  = useSWR('/api/app-config', fetcher, { refreshInterval: 60000 });
  useRealtime(['/api/state']);
  usePushRegistration();
  useWebPushSubscription(isAdmin);

  const isLive = data?.state?.voting_state === 'live' || data?.state?.voting_state === 'paused';
  const vis: Record<string, boolean> = cfg?.visibility ?? {};

  // A tab is visible when the setting hasn't loaded yet (default true) OR when visible.
  const show = (key: string) => vis[key] !== false;

  const hideForRequiredProfile = path === '/profile' && searchParams.get('required') === '1';
  if (hideForRequiredProfile) return null;

  const tabs = [
    { href: '/',         label: 'Home',     Icon: Home,         match: (p: string) => p === '/',                                               show: true },
    { href: '/schedule', label: 'Schedule', Icon: CalendarDays, match: (p: string) => p.startsWith('/schedule'),                               show: show('schedule') },
    { href: '/live',     label: 'Live',     Icon: Zap,          match: (p: string) => ['/live','/vote','/qna'].includes(p), pulse: isLive,     show: show('vote') || show('qna') },
    { href: '/gallery',  label: 'Gallery',  Icon: ImageIcon,    match: (p: string) => p.startsWith('/gallery'),                                show: show('gallery') },
    { href: '/me',       label: 'Me',       Icon: User,         match: (p: string) => ['/me','/feedback','/leaderboard','/aadhar'].includes(p), show: true },
  ].filter(t => t.show);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50"
      style={{
        background: '#09091a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-[60px] max-w-lg mx-auto">
        {tabs.map(({ href, label, Icon, match, pulse }) => {
          const active = match(path);
          const color = active ? '#FF7A00' : 'rgba(255,255,255,0.38)';

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-transform active:scale-90"
            >
              {/* Active top line */}
              {active && (
                <span
                  className="absolute top-0 inset-x-3 h-[2px] rounded-full"
                  style={{ background: 'linear-gradient(90deg,#FF7A00,#FF4F87)' }}
                />
              )}

              {/* Live pulse dot */}
              {pulse && !active && (
                <span className="absolute top-2 right-[calc(50%-8px)] w-1.5 h-1.5 rounded-full bg-red-500">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-70" />
                </span>
              )}

              <Icon size={22} strokeWidth={1.7} style={{ color }} />
              <span className="text-[10px] font-semibold leading-none" style={{ color }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
