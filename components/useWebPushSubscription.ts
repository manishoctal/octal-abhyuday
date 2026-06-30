'use client';

import { useEffect } from 'react';
import { isNative } from '@/lib/platform';

// Only attempt once per session
let _attempted = false;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

/**
 * Subscribes the current browser to web push notifications via the VAPID key.
 * Runs once per session on authenticated pages. Native apps use usePushRegistration instead.
 * Admins are excluded — they view the stage and should not receive employee notifications.
 */
export function useWebPushSubscription(isAdmin = false) {
  useEffect(() => {
    if (isNative()) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // If admin: unsubscribe any existing web push subscription and remove from DB
    if (isAdmin) {
      (async () => {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'web' }) });
            console.log('[push/web] admin — unsubscribed from web push');
          }
        } catch { /* ignore */ }
      })();
      return;
    }

    if (_attempted) return;
    _attempted = true;

    (async () => {
      try {
        // Fetch VAPID public key
        const res = await fetch('/api/push/vapid-key');
        const { key } = await res.json();
        if (!key) {
          console.log('[push/web] VAPID key not configured — skipping web push');
          return;
        }

        const reg = await navigator.serviceWorker.ready;

        // Check existing subscription
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          // Not subscribed — subscribe now
          console.log('[push/web] no subscription found, subscribing...');
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
          console.log('[push/web] subscribed successfully');
        }

        // Always save/refresh subscription in DB (handles rotated keys or new logins)
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), platform: 'web' }),
        });
        console.log('[push/web] subscription saved to server');
      } catch (e) {
        console.error('[push/web] subscription error:', e);
        _attempted = false; // allow retry on next mount
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
