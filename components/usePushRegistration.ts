'use client';

import { useEffect } from 'react';
import { isNative, getPlatform } from '@/lib/platform';

// Module-level flag: only run registration once per WebView session.
let _attempted = false;

/**
 * Registers this device for native push notifications (Android / iOS) via
 * @capacitor/push-notifications.  Runs once after the user is authenticated
 * (component is only rendered on authed pages).
 *
 * On web/PWA this is a no-op — web push is subscribed separately via the
 * service worker.
 */
export function usePushRegistration() {
  useEffect(() => {
    if (_attempted || !isNative()) return;
    _attempted = true;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Check / request OS permission
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        // Attach listener BEFORE calling register() so we don't miss the event
        await PushNotifications.addListener('registration', async ({ value: token }) => {
          const platform = getPlatform();
          console.log(`[push] FCM token obtained (${platform}), saving to server...`);
          try {
            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: token, platform }),
            });
            if (res.ok) {
              console.log('[push] subscription saved successfully');
            } else {
              const body = await res.text().catch(() => '');
              console.error(`[push] subscribe endpoint returned ${res.status}: ${body}`);
              _attempted = false; // allow retry on next mount
            }
          } catch (e) {
            console.error('[push] network error saving subscription:', e);
            _attempted = false; // allow retry on next mount
          }
        });

        await PushNotifications.addListener('registrationError', (err) => {
          console.error('[push] FCM registration error:', err.error);
          _attempted = false; // reset so a retry is possible on next app start
        });

        // Trigger FCM token fetch — fires 'registration' listener above
        await PushNotifications.register();
      } catch (e) {
        console.error('[push] native push setup error:', e);
        _attempted = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
