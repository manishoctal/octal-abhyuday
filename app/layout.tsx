import type { Metadata, Viewport } from 'next';
import { getAppState } from '@/lib/db';
import './globals.css';

export function generateMetadata(): Metadata {
  const eventName = getAppState().event_name;
  return {
    title: `${eventName} — Octal IT Solutions`,
    description: `Vote for the Most Popular Male & Female at ${eventName}`,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
