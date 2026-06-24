import type { Metadata, Viewport } from 'next';
import { getAppState } from '@/lib/db';
import './globals.css';

export function generateMetadata(): Metadata {
  const eventName = getAppState().event_name;
  return {
    title: `${eventName} — Octal IT Solutions`,
    description: `Your event companion for ${eventName} — schedule, voting, Q&A, gallery, and more.`,
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: eventName },
    icons: { icon: '/icons/icon-192.svg', apple: '/icons/icon-192.svg' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FE9234',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
