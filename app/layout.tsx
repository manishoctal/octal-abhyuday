import type { Metadata, Viewport } from 'next';
import { getAppState } from '@/lib/db';
import SplashHider from '@/components/SplashHider';
import EventAlertToast from '@/components/EventAlertToast';
import AppUpdateCheck from '@/components/AppUpdateCheck';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import './globals.css';

export function generateMetadata(): Metadata {
  const eventName = getAppState().event_name;
  const title = `${eventName} — Octal IT Solution LLP`;
  const description = `Your event companion for ${eventName} — schedule, voting, Q&A, gallery, and more.`;
  return {
    metadataBase: new URL('https://abhyuday.octallabs.com'),
    title,
    description,
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: eventName },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
    openGraph: {
      title,
      description,
      siteName: 'Octal IT Solution LLP',
      type: 'website',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FE9234',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const eventName = getAppState().event_name;
  return (
    <html lang="en">
      <body>
        {/* Web splash — shown on initial load, React hides it after hydration */}
        <div id="web-splash" aria-hidden="true">
          <div className="splash-logo"><img src="/icons/icon-192.png" width={72} height={72}
     style={{ borderRadius: 22, display: 'block' }} alt="" /></div>
          <div className="splash-name">{eventName}</div>
          <div className="splash-by">Octal IT Solution LLP</div>
        </div>
        <SplashHider />
        <EventAlertToast />
        <AppUpdateCheck />
        <PWAInstallBanner />
        {children}
      </body>
    </html>
  );
}
