import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getPushSubscriptionsWithUser } from '@/lib/db';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

// ── Web Push (VAPID) ────────────────────────────────────────────────────────

let vapidReady = false;
function initVapid(): boolean {
  if (vapidReady) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? 'admin@octalsoftware.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
  return true;
}

// ── FCM (Android / iOS) ─────────────────────────────────────────────────────

function isFcmConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

async function sendFcm(
  tokens: string[],
  title: string,
  body: string,
): Promise<{ sent: number; failed: number }> {
  if (!tokens.length) return { sent: 0, failed: 0 };

  const { initializeApp, getApps, getApp, cert } = await import('firebase-admin/app');
  const { getMessaging } = await import('firebase-admin/messaging');

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replaceAll(String.raw`\n`, '\n'),
        }),
      });

  const messages = tokens.map((token) => ({
    token,
    notification: { title, body },
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  }));

  const response = await getMessaging(app).sendEach(messages);
  return { sent: response.successCount, failed: response.failureCount };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (isErrorResponse(err)) return err;

  const { title, body, target = 'all', department } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  let allSubs = getPushSubscriptionsWithUser();

  if (target === 'admins') {
    allSubs = allSubs.filter((s) => adminEmails.has(s.email.toLowerCase()));
  } else if (target === 'department') {
    if (!department) return NextResponse.json({ error: 'department required' }, { status: 400 });
    allSubs = allSubs.filter((s) => s.department === department);
  }

  const webSubs    = allSubs.filter((s) => s.platform === 'web');
  const nativeSubs = allSubs.filter((s) => s.platform === 'android' || s.platform === 'ios');

  // Web Push
  let webSent = 0, webFailed = 0;
  if (webSubs.length > 0 && initVapid()) {
    const payload = JSON.stringify({ title, body });
    const results = await Promise.allSettled(
      webSubs.map((s) => {
        const parsed = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
        return webpush.sendNotification(parsed, payload);
      })
    );
    webSent   = results.filter((r) => r.status === 'fulfilled').length;
    webFailed = results.filter((r) => r.status === 'rejected').length;
  }

  // FCM
  let fcmSent = 0, fcmFailed = 0;
  if (nativeSubs.length > 0 && isFcmConfigured()) {
    const tokens = nativeSubs.map((s) =>
      typeof s.subscription === 'string' ? s.subscription : JSON.stringify(s.subscription)
    );
    ({ sent: fcmSent, failed: fcmFailed } = await sendFcm(tokens, title, body));
  }

  const sent   = webSent   + fcmSent;
  const failed = webFailed + fcmFailed;
  const total  = allSubs.length;

  return NextResponse.json({ ok: true, sent, failed, total, target });
}
