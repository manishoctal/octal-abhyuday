/**
 * Server-side push notification utility.
 * Call sendPushToAll() from any admin API route to notify all subscribed devices.
 */
import webpush from 'web-push';
import { getPushSubscriptionsWithUser } from '@/lib/db';

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

function isFcmConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function parseFirebaseKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')      // strip accidental surrounding quotes
    .replace(/\\r\\n|\\n|\\r/g, '\n') // unescape literal \n / \r\n / \r
    .replace(/\r\n|\r/g, '\n');       // normalise any real CRLF
}

export async function sendPushToAll(title: string, body: string, url = '/'): Promise<void> {
  const subs = getPushSubscriptionsWithUser();
  if (!subs.length) return;

  const webSubs    = subs.filter(s => s.platform === 'web');
  const nativeSubs = subs.filter(s => s.platform === 'android' || s.platform === 'ios');

  const promises: Promise<unknown>[] = [];

  // Web Push (VAPID)
  if (webSubs.length && initVapid()) {
    const payload = JSON.stringify({ title, body, url });
    promises.push(
      Promise.allSettled(
        webSubs.map(s => {
          const parsed = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
          return webpush.sendNotification(parsed, payload);
        })
      )
    );
  }

  // FCM (Android / iOS)
  if (nativeSubs.length && isFcmConfigured()) {
    promises.push((async () => {
      const { initializeApp, getApps, getApp, cert } = await import('firebase-admin/app');
      const { getMessaging }                          = await import('firebase-admin/messaging');
      const app = getApps().length
        ? getApp()
        : initializeApp({
            credential: cert({
              projectId:    process.env.FIREBASE_PROJECT_ID!,
              clientEmail:  process.env.FIREBASE_CLIENT_EMAIL!,
              privateKey:   parseFirebaseKey(process.env.FIREBASE_PRIVATE_KEY!),
            }),
          });

      const tokens = nativeSubs.map(s =>
        typeof s.subscription === 'string' ? s.subscription : JSON.stringify(s.subscription)
      );

      await getMessaging(app).sendEach(
        tokens.map(token => ({
          token,
          notification: { title, body },
          android:  { priority: 'high' as const },
          apns:     { payload: { aps: { sound: 'default' } } },
        }))
      );
    })());
  }

  await Promise.allSettled(promises);
}

// Module enable notifications
const MODULE_PUSH: Record<string, { title: string; body: string; url: string }> = {
  schedule:    { title: '📅 Schedule is live',        body: 'View the full event agenda.',              url: '/schedule'    },
  awards:      { title: '🏆 Awards section is open',  body: 'See the categories and nominees.',         url: '/awards'      },
  gallery:     { title: '📸 Gallery is now open',     body: 'Browse and find yourself in event photos.',url: '/gallery'     },
  vote:        { title: '🗳️ Voting is available',     body: 'Head over and cast your vote.',            url: '/vote'        },
  qna:         { title: '💬 Q&A is now available',    body: 'Ask your questions live.',                 url: '/qna'         },
  leaderboard: { title: '🏅 Rankings are live',       body: 'See where you stand on the leaderboard.',  url: '/leaderboard' },
  badge:       { title: '🎫 My Badge is active',      body: 'Check in at the venue with your QR badge.',url: '/me'          },
  venue:       { title: '📍 Venue info is available', body: 'Find maps and event info.',                 url: '/info'        },
  feedback:    { title: '⭐ Feedback is now open',    body: 'Share your event experience.',              url: '/feedback'    },
};

export async function sendModuleEnabledPush(key: string): Promise<void> {
  const cfg = MODULE_PUSH[key];
  if (cfg) await sendPushToAll(cfg.title, cfg.body, cfg.url);
}
