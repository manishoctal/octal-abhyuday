# Phase 2 — Live Q&A Module (sli.do-style, admin-presented)

*Planned 2026-06-11 with Manish. Build order: Live Q&A first; Live Polls and Rankings reuse the same engine in later phases.*

## Concept

Admin-driven interactive Q&A for events (ABHYUDAY 2026): the admin prepares a deck of questions, presents them live one at a time, the audience answers from their phones, and the admin reveals answers/results with the same fanfare as the voting results. A projector-friendly presenter view shows everything on stage.

**Flow:** Admin creates session → adds questions → starts session → pushes Q1 live → everyone's phone switches to Q1 instantly → audience answers (anonymous or named — sender's choice) → admin reveals → push Q2 → … → session summary (leaderboard for quiz questions).

## Question types (v1)

1. **Multiple choice / quiz** — options, optionally one marked correct. Reveal shows the answer + live bar chart of how people voted. Correct answers score points (speed bonus optional) → session leaderboard.
2. **Open text ("funny Q&A")** — short free-text answers. Audience sees answers appear live and can upvote 😂; reveal highlights the top-voted answers. Anonymous-or-named toggle per answer.
3. **Rating / emoji scale** *(cheap to add)* — 1–5 stars or emoji reactions, reveal shows average + distribution.

## Data model (extends existing SQLite)

```
qa_sessions    id, title, status ('draft'|'live'|'ended'), active_question_id, created_at
qa_questions   id, session_id, type ('mcq'|'text'|'rating'), prompt, options(JSON),
               correct_option, state ('pending'|'live'|'revealed'), sort_order
qa_answers     id, question_id, user_id, value, is_anonymous, created_at
               UNIQUE(question_id, user_id)   -- one answer each, editable until reveal
qa_upvotes     id, answer_id, user_id, UNIQUE(answer_id, user_id)
```

## Pages

- **`/admin/qna`** — module page (flip registry entry to `live`): session list → session editor (add/reorder questions, CSV/bulk paste import) → **presenter controls**: Push live / Reveal / Next, live answer counter.
- **`/qna`** (employee) — shows the active question; answer form by type; switches question and shows reveals in realtime. Idle state: "Waiting for the host…" with event branding. When a session goes live, the voting page shows a "🎤 Live now — join in!" banner (and vice versa).
- **`/stage`** (presenter view) — full-screen dark stage theme matching the results page: event name header, big question text, live-updating chart / top answers, reveal animations (confetti on correct answer), QR-less (everyone is already signed in).

## Reuse from Phase 1

- Realtime: same SSE bus (`lib/events.ts` + `/api/stream`) — add event types `qa_state`, `qa_answer`, `qa_upvote`.
- Auth/session, admin guard, module registry, toasts, Framer Motion patterns, confetti, stage styling from `ResultsClient`.

## Build order

1. Schema + `lib/qa.ts` queries + API routes (sessions, questions, answers, upvotes, presenter actions)
2. Admin module: session/question management + presenter controls
3. Employee `/qna` page (all three question types, realtime switching)
4. `/stage` presenter view + reveal animations + quiz leaderboard
5. Polish: banners between modules, empty states, mobile checks, seed demo session

## Later phases

- **Live Polls** = standalone single-question sessions (thin wrapper over the same engine)
- **Rankings** = new question type `rank` (drag-to-order, combined crowd ranking)
- Word cloud question type; export results to CSV
