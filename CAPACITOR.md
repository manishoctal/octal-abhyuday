# Native Android & iOS apps (Capacitor) — Phase 4

The ABHYUDAY app is a **PWA first**. Most attendees just open the link and "Add to
Home Screen" — no store needed. Capacitor is the optional path to real **Play Store /
App Store** builds when management wants an app-store presence.

## How it works

Capacitor does **not** bundle the app into the phone. It ships a thin native shell
whose WebView loads the **live Render URL** (`capacitor.config.ts` → `server.url`).

```
┌─────────────────┐        HTTPS         ┌──────────────────────────┐
│  Native shell   │  ───────────────▶    │  Render (octal-vote)     │
│  (Android/iOS)  │                      │  Next.js + SQLite + SSE  │
│   WebView       │  ◀───────────────    │  /var/data/vote.db       │
└─────────────────┘     same backend     └──────────────────────────┘
```

Consequences:
- **The database lives only on Render.** Web, Android, and iOS all hit the same one.
- **Updates are instant.** Deploy to Render → all three platforms update. You only
  rebuild the APK/IPA when *native* plugins change (rare).
- The app needs **internet** — there is no offline local DB (the PWA service worker
  still caches the shell for a graceful offline screen).

## Prerequisites

- **Android:** Android Studio + JDK 17. (Works on Windows/Mac/Linux.)
- **iOS:** a **Mac** with Xcode + an Apple Developer account ($99/yr) for TestFlight.

## One-time setup

```bash
pnpm install                 # pulls @capacitor/* (already in package.json)
pnpm cap:add:android         # creates ./android  (commit it)
pnpm cap:add:ios             # creates ./ios      (Mac only; commit it)
```

`server.url` defaults to `https://octal-vote.onrender.com`. Point it elsewhere with:

```bash
CAPACITOR_SERVER_URL=https://staging.example.com pnpm cap:sync
```

## Build & run

```bash
pnpm cap:sync                # copy config into native projects after any change
pnpm cap:open:android        # opens Android Studio → Run / Build > Generate Signed APK/AAB
pnpm cap:open:ios            # opens Xcode → Product > Archive → Distribute
```

## Push notifications on native

The server (`/api/push/send`) sends **Web Push** to browser/PWA subscribers. Native
apps use **FCM** instead:

1. Add `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) from Firebase.
2. The `@capacitor/push-notifications` plugin registers the device and returns an FCM
   token. Post it to `/api/push/subscribe` with `platform: 'android' | 'ios'` — the
   `push_subscriptions` table already accepts those platforms (`lib/platform.ts`
   detects the runtime).
3. Add an FCM send path in `/api/push/send` for the non-`web` rows (server currently
   only dispatches the `web` rows via `web-push`).

## Distribution

| Platform | Channel | Notes |
|----------|---------|-------|
| Android  | Direct APK download, Firebase App Distribution, or Play Store internal track | No store strictly required |
| iOS      | TestFlight (needs Apple Developer account) | Or enterprise cert if Octal has one |

For most users the **PWA covers everything** — native builds are for store presence
or power-user UX (native camera/QR/haptics plugins).
