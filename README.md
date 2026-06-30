# Octal Vote 🏆

Internal voting app for **Octal IT Solution LLP** — employees vote for *Most Popular Male* and *Most Popular Female*. Mobile-first, fully responsive.

## Quick start

```bash
pnpm install
pnpm seed      # optional: add 8 demo candidates
pnpm dev       # http://localhost:3000
```

## How it works

- **Sign in** (`/login`): any `@octalsoftware.com` email + OTP. The OTP is currently fixed via `OTP_CODE` in `.env.local` (default `1234`); swap in a real email sender in `app/api/auth/request-otp/route.ts` later.
- **Vote** (`/`) — two rounds:
  - **Round 1 · Qualifier** (days before the event): the full pool (~100 candidates). Each employee votes for **1 male + 1 female** (changeable while open). Neutral alphabetical list with a search box — **no counts, no ranking** visible to employees. Every employee who signs in is auto-added as a candidate (deduped by email, off-ballot until the admin sets their gender).
  - **Round 2 · Grand Finale** (event day): when the admin ends Round 1, the **top 10 per gender advance automatically** based purely on votes (ties at 10th place are included). Finale = finalists only, one changeable vote per category, live leaderboard with crowns, then the results announcement.
- **Results** (`/voting-results`): not linked anywhere — employees are auto-redirected there the moment the admin announces (drumroll, lightning, confetti, podium). Direct visits before the announcement see a teaser.
- **Admin** (`/admin`): hidden from all menus — admins (emails in `ADMIN_EMAILS`) navigate to `/admin` directly. It's a **module dashboard**; the live *Popularity Voting* module (`/admin/voting`) holds the event name (shown on the voting & results pages, default "ABHYUDAY 2026"), candidates CRUD, CSV upload, Start/Pause/Resume/End/Announce and live stats. All four modules are live; new modules register in `lib/admin-modules.ts` with a page under `app/admin/<id>/`.
- **Live Q&A** (`/admin/qna`): build sessions of questions (🧠 quiz MCQ with optional correct answer, 💬 open text with anonymous option + 😂 upvotes, ⭐ 1–5 rating), then Go Live and present them one at a time — every signed-in phone switches instantly. Reveal shows charts/correct answer/top answers; ending a session shows the quiz leaderboard. Employees join at `/qna` (a banner on the voting page links there whenever a session is live, and vice versa).
- **Live Polls** (`/admin/polls`): one-tap launcher — type a question + options and it's instantly live on every phone; voters see the live result chart the moment they vote. End locks the results.
- **Rankings** (`/admin/ranking`): same launcher with a tap-in-order ballot — everyone numbers the items on their phone, the combined crowd ranking (Borda count) updates live with medals.
- **Stage view** (`/stage`): projector-friendly presenter screen (admin-only — sign the projector machine in as admin): event branding, the live question, live-updating results, reveal confetti, final standings.

## Configuration (`.env.local`)

| Variable | Purpose |
|---|---|
| `OTP_CODE` | The accepted OTP (temporary, until real OTP delivery is wired up) |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `JWT_SECRET` | Session signing secret — change for production |
| `ALLOWED_EMAIL_DOMAIN` | Allowed sign-in domain (default `octalsoftware.com`) |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · SQLite (better-sqlite3, file at `data/vote.db`) · Framer Motion · canvas-confetti · JWT session cookie (jose) · SWR

## Realtime

All clients hold a Server-Sent Events connection to `/api/stream`. Every vote, voting-status change, and candidate edit is broadcast instantly (`lib/events.ts`), and clients revalidate their data the moment an event arrives — votes, admin stats, the paused banner, and the results announcement all appear within ~1 second with no refresh. SWR keeps a slow 15s poll purely as a reconnect safety net. Note: the in-process event bus means realtime requires running as a single Node process (the default `next start`).

## Notes

- The database file is created automatically on first run; delete `data/vote.db` to start fresh.
- "Reset All" in the admin panel returns the state machine to *not started* and clears the announcement flag, but keeps votes. Delete the DB file to wipe votes.
