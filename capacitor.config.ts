import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the *hosted* app as a native Android/iOS shell.
 *
 * `server.url` points at the live Render deployment — NOT a static export — so
 * every server-side feature keeps working inside the native app: SSE realtime,
 * SQLite, auth cookies, push, uploads. The database stays on Render; the phone
 * is just a window onto it. App-logic updates deploy on Render and reach the
 * native apps instantly with no store re-submission.
 *
 * Override the URL per-environment with CAPACITOR_SERVER_URL (e.g. a staging host).
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://abhyuday.octallabs.com';

const config: CapacitorConfig = {
  appId: 'com.octalsoftware.abhyuday',
  appName: 'ABHYUDAY',
  webDir: 'public', // required by the CLI; unused because we load server.url
  server: {
    url: serverUrl,
    cleartext: false,
  },
  backgroundColor: '#F8FAFC',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2200,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
