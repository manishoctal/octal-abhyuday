import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { getAllPushSubscriptions } from '@/lib/db';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? 'admin@octalsoftware.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (err) return err;

  if (!process.env.VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  const { title, body } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  const subs = getAllPushSubscriptions().filter((s) => s.platform === 'web');
  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subs.map((s) => {
      const parsed = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
      return webpush.sendNotification(parsed, payload);
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ ok: true, sent, failed, total: subs.length });
}
