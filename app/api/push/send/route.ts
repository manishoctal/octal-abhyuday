import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import { getPushSubscriptionsWithUser, deletePushSubscriptionById } from '@/lib/db';
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

function parseFirebaseKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\r\n|\r/g, '\n');
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
          privateKey: parseFirebaseKey(process.env.FIREBASE_PRIVATE_KEY!),
        }),
      });

  const messages = tokens.map((token) => ({
    token,
    notification: { title, body },
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  }));

  const response = await getMessaging(app).sendEach(messages);

  // Log individual FCM failures
  response.responses.forEach((r, i) => {
    if (!r.success) {
      console.error(`[push/fcm] token[${i}] failed:`, r.error?.code, r.error?.message);
    }
  });

  return { sent: response.successCount, failed: response.failureCount };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const err = await requireAdmin();
  if (isErrorResponse(err)) return err;

  const { title, body, target = 'all', department } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  console.log(`[push/send] title="${title}" target=${target}${department ? ` dept=${department}` : ''}`);

  let allSubs = getPushSubscriptionsWithUser();

  if (target === 'admins') {
    allSubs = allSubs.filter((s) => adminEmails.has(s.email.toLowerCase()));
  } else if (target === 'department') {
    if (!department) return NextResponse.json({ error: 'department required' }, { status: 400 });
    allSubs = allSubs.filter((s) => s.department === department);
  }

  const webSubs    = allSubs.filter((s) => s.platform === 'web');
  const nativeSubs = allSubs.filter((s) => s.platform === 'android' || s.platform === 'ios');

  console.log(`[push/send] ${webSubs.length} web, ${nativeSubs.length} native subscribers`);

  // ── Web Push (VAPID) ──────────────────────────────────────────────────────
  let webSent = 0, webFailed = 0;
  if (webSubs.length > 0) {
    if (!initVapid()) {
      console.warn('[push/send] VAPID not configured — skipping web push');
    } else {
      const payload = JSON.stringify({ title, body });
      const results = await Promise.allSettled(
        webSubs.map((s) => {
          const parsed = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
          return webpush.sendNotification(parsed, payload);
        })
      );

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const sub = webSubs[i];
        if (r.status === 'fulfilled') {
          webSent++;
          console.log(`[push/web] ✓ sent to user ${sub.user_id} (${sub.email})`);
        } else {
          webFailed++;
          const e = r.reason as { statusCode?: number; message?: string };
          console.error(`[push/web] ✗ failed user ${sub.user_id} (${sub.email}): status=${e?.statusCode} ${e?.message}`);
          // 410 Gone or 404 = subscription definitively expired — remove from DB
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            deletePushSubscriptionById(sub.id);
            console.log(`[push/web] deleted stale sub id=${sub.id} for user ${sub.user_id}`);
          }
        }
      }
    }
  }

  // ── FCM (Android / iOS) ───────────────────────────────────────────────────
  let fcmSent = 0, fcmFailed = 0;
  if (nativeSubs.length > 0) {
    if (!isFcmConfigured()) {
      console.warn('[push/send] FCM not configured — skipping native push');
    } else {
      const tokens = nativeSubs.map((s) =>
        typeof s.subscription === 'string' ? s.subscription : JSON.stringify(s.subscription)
      );
      try {
        ({ sent: fcmSent, failed: fcmFailed } = await sendFcm(tokens, title, body));
      } catch (fcmErr) {
        console.error('[push/send] FCM error:', fcmErr);
        fcmFailed = nativeSubs.length;
      }
    }
  }

  const sent   = webSent   + fcmSent;
  const failed = webFailed + fcmFailed;
  const total  = allSubs.length;

  console.log(`[push/send] done: ${sent} sent, ${failed} failed of ${total}`);

  return NextResponse.json({ ok: true, sent, failed, total, target });
}
