import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getPushSubscriptionsWithUser } from '@/lib/db';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? 'admin@octalsoftware.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (isErrorResponse(err)) return err;

  if (!process.env.VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  const { title, body, target = 'all', department } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  // Only web-push subscriptions are sent from the server; native (FCM) is handled separately.
  let subs = getPushSubscriptionsWithUser().filter((s) => s.platform === 'web');

  if (target === 'admins') {
    subs = subs.filter((s) => adminEmails.includes(s.email.toLowerCase()));
  } else if (target === 'department') {
    if (!department) return NextResponse.json({ error: 'department required' }, { status: 400 });
    subs = subs.filter((s) => s.department === department);
  }

  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subs.map((s) => {
      const parsed = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
      return webpush.sendNotification(parsed, payload);
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ ok: true, sent, failed, total: subs.length, target });
}
