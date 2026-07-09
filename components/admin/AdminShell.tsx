'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Vote, MessageSquare, BarChart2, ListOrdered,
  Users, Calendar, Trophy, Info,
  Camera, Bell, Star, Award, CheckSquare,
  Menu, X, LogOut, ExternalLink, LayoutDashboard,
} from 'lucide-react';

/* ── Navigation config ──────────────────────────────────── */
const NAV = [
  {
    group: 'Live Controls',
    color: 'text-orange-400',
    items: [
      { href: '/admin/voting',  icon: Vote,           label: 'Voting'    },
      { href: '/admin/qna',     icon: MessageSquare,  label: 'Live Q&A'  },
      { href: '/admin/polls',   icon: BarChart2,      label: 'Live Polls'},
      { href: '/admin/ranking', icon: ListOrdered,    label: 'Rankings'  },
    ],
  },
  {
    group: 'Event Setup',
    color: 'text-sky-400',
    items: [
      { href: '/admin/employees',  icon: Users,    label: 'Employees'  },
      { href: '/admin/schedule',   icon: Calendar, label: 'Schedule'   },
      { href: '/admin/awards',     icon: Trophy,   label: 'Awards'     },
      { href: '/admin/event-info', icon: Info,     label: 'Venue & Info'},
    ],
  },
  {
    group: 'Reports',
    color: 'text-emerald-400',
    items: [
      { href: '/admin/photos',        icon: Camera,      label: 'Photos'        },
      { href: '/admin/notifications', icon: Bell,        label: 'Notifications' },
      { href: '/admin/feedback',      icon: Star,        label: 'Feedback'      },
      { href: '/admin/leaderboard',   icon: Award,       label: 'Leaderboard'   },
      { href: '/admin/scan',          icon: CheckSquare, label: 'Attendance'    },
    ],
  },
];

/* ── Sidebar ────────────────────────────────────────────── */
function Sidebar({
  eventName,
  adminName,
  onClose,
}: {
  eventName: string;
  adminName: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 w-60 shrink-0">
      {/* Logo + close (mobile) */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-800 shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0" onClick={onClose}>
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow">
            <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-orange-400 uppercase tracking-widest leading-none">Admin</p>
            <p className="text-[13px] font-bold text-white truncate leading-tight">{eventName}</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition md:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Dashboard link */}
      <div className="px-3 pt-3">
        <Link
          href="/admin"
          onClick={onClose}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
            pathname === '/admin'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard size={15} className="shrink-0" />
          Dashboard
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {NAV.map(({ group, color, items }) => (
          <div key={group}>
            <p className={`text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5 ${color}`}>{group}</p>
            <div className="space-y-0.5">
              {items.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Stage view shortcut + user info + logout */}
      <div className="border-t border-slate-800 p-3 space-y-2 shrink-0">
        <a
          href="/voting-stage"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-orange-400 hover:bg-slate-800 transition-colors"
        >
          <ExternalLink size={14} />
          Stage View
        </a>
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 leading-none">Signed in as</p>
            <p className="text-[13px] font-semibold text-slate-300 truncate">{adminName}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Logout"
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shell (exported) ───────────────────────────────────── */
export default function AdminShell({
  children,
  eventName,
  adminName,
}: {
  children: React.ReactNode;
  eventName: string;
  adminName: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Derive page title for mobile top bar
  const activeItem = NAV.flatMap((g) => g.items).find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  const mobileTitle = activeItem?.label ?? (pathname === '/admin' ? 'Dashboard' : 'Admin');

  return (
    <div className="admin-shell flex h-dvh bg-slate-50 overflow-hidden">
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:flex">
        <Sidebar eventName={eventName} adminName={adminName} />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar eventName={eventName} adminName={adminName} onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Content pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-slate-900 flex-1 truncate">{mobileTitle}</span>
          <Link
            href="/"
            className="text-[11px] font-bold text-orange-500 border border-orange-200 bg-orange-50 px-2.5 py-1 rounded-full"
          >
            App
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
