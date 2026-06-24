import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { AppState, Candidate, CandidateWithVotes, Gender, VotingRound, VotingState } from './types';

// On Render (and any host) point DATA_DIR at the mounted persistent disk so the
// SQLite file survives restarts and deploys. Falls back to ./data locally.
const DB_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'vote.db');

/** How many candidates per gender advance from the round-1 qualifier */
export const FINALISTS_PER_GENDER = 10;

declare global {
  // eslint-disable-next-line no-var
  var __octalVoteDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (e) {
    throw new Error(
      `Cannot create database directory "${DB_DIR}". ` +
      `Set DATA_DIR env var to a writable path (e.g. DATA_DIR=/var/data). ` +
      `Original: ${e}`,
    );
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT CHECK (gender IN ('male','female')),
      image_url TEXT NOT NULL,
      email TEXT UNIQUE,
      is_finalist INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      gender TEXT NOT NULL CHECK (gender IN ('male','female')),
      round INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, candidate_id, round)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

// During `pnpm build` Next.js runs every server component once ("Collecting page data").
// Skip real DB init in that phase — the filesystem path isn't guaranteed during build.
// At runtime (pnpm start / pm2) NEXT_PHASE is unset, so we always use the real DB.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function makeBuildStub(): Database.Database {
  const stmt = () => ({
    get: () => undefined,
    all: () => [] as never[],
    run: () => ({ changes: 0, lastInsertRowid: 0 }),
    iterate: function* () {},
  });
  return new Proxy({} as Database.Database, {
    get: (_t, prop) => {
      const p = String(prop);
      if (p === 'prepare') return stmt;
      if (['exec', 'pragma', 'close', 'serialize'].includes(p)) return () => undefined;
      // transaction(fn) must return a callable so callers can do: const t = db.transaction(fn); t();
      if (p === 'transaction') return (fn: (...a: unknown[]) => unknown) => fn;
      return undefined;
    },
  });
}

// Reuse the connection across Next.js dev hot-reloads
export const db: Database.Database = isBuildPhase
  ? makeBuildStub()
  : (globalThis.__octalVoteDb ?? createDb());
if (!isBuildPhase) globalThis.__octalVoteDb = db;

// ---------- migrations (run on every module load; cheap and idempotent) ----------

const candidateCols = (db.prepare('PRAGMA table_info(candidates)').all() as { name: string }[]).map(
  (c) => c.name
);
if (!candidateCols.includes('email')) {
  // Two-round upgrade: gender becomes nullable, add email (dedupe key) and finalist flag
  db.exec(`
    CREATE TABLE candidates_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT CHECK (gender IN ('male','female')),
      image_url TEXT NOT NULL,
      email TEXT UNIQUE,
      is_finalist INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO candidates_new (id, name, gender, image_url, created_at)
      SELECT id, name, gender, image_url, created_at FROM candidates;
    DROP TABLE candidates;
    ALTER TABLE candidates_new RENAME TO candidates;
  `);
}

const voteCols = (db.prepare('PRAGMA table_info(votes)').all() as { name: string }[]).map(
  (c) => c.name
);
if (!voteCols.includes('round')) {
  // Round 1 allows multiple picks per gender, so the old UNIQUE(user_id, gender) goes away
  db.exec(`
    CREATE TABLE votes_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      gender TEXT NOT NULL CHECK (gender IN ('male','female')),
      round INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, candidate_id, round)
    );
    INSERT INTO votes_new (id, user_id, candidate_id, gender, round, updated_at)
      SELECT id, user_id, candidate_id, gender, 1, updated_at FROM votes;
    DROP TABLE votes;
    ALTER TABLE votes_new RENAME TO votes;
  `);
}

db.exec(`
  INSERT OR IGNORE INTO settings (key, value) VALUES ('voting_state', 'not_started');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('results_announced', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('event_name', 'ABHYUDAY 2026');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('voting_round', '1');
`);

// ---------- users ----------

export function upsertUser(email: string, name: string) {
  db.prepare(
    `INSERT INTO users (email, name) VALUES (?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name`
  ).run(email, name);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: number;
    email: string;
    name: string;
  };
}

// ---------- settings / state ----------

export function getAppState(): AppState {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    voting_state: (map.voting_state ?? 'not_started') as VotingState,
    results_announced: map.results_announced === '1',
    event_name: map.event_name ?? 'ABHYUDAY 2026',
    voting_round: (map.voting_round === '2' ? 2 : 1) as VotingRound,
  };
}

export function setSetting(key: string, value: string) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

// ---------- candidates ----------

export interface ListOptions {
  round: VotingRound;
  finalistsOnly?: boolean;
  orderByName?: boolean;
  /** include candidates without a gender (admin views) */
  includeUngendered?: boolean;
}

export function listCandidates(gender: Gender | undefined, opts: ListOptions): CandidateWithVotes[] {
  const where: string[] = [];
  const params: unknown[] = [opts.round];
  if (gender) {
    where.push('c.gender = ?');
    params.push(gender);
  } else if (!opts.includeUngendered) {
    where.push('c.gender IS NOT NULL');
  }
  if (opts.finalistsOnly) where.push('c.is_finalist = 1');
  const order = opts.orderByName ? 'c.name ASC' : 'vote_count DESC, c.name ASC';
  return db
    .prepare(
      `SELECT c.*, COUNT(v.id) AS vote_count
       FROM candidates c
       LEFT JOIN votes v ON v.candidate_id = c.id AND v.round = ?
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY c.id
       ORDER BY ${order}`
    )
    .all(...params) as CandidateWithVotes[];
}

export function getCandidate(id: number): Candidate | undefined {
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as Candidate | undefined;
}

export function createCandidate(
  name: string,
  gender: Gender | null,
  imageUrl: string,
  email: string | null = null
): Candidate {
  const info = db
    .prepare('INSERT INTO candidates (name, gender, image_url, email) VALUES (?, ?, ?, ?)')
    .run(name, gender, imageUrl, email);
  return getCandidate(Number(info.lastInsertRowid))!;
}

export function updateCandidate(
  id: number,
  name: string,
  gender: Gender | null,
  imageUrl: string,
  email: string | null
) {
  db.prepare('UPDATE candidates SET name = ?, gender = ?, image_url = ?, email = ? WHERE id = ?').run(
    name,
    gender,
    imageUrl,
    email,
    id
  );
}

export function deleteCandidate(id: number) {
  db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(id);
  db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
}

export function getCandidateByEmail(email: string): Candidate | undefined {
  return db.prepare('SELECT * FROM candidates WHERE email = ?').get(email.toLowerCase()) as
    | Candidate
    | undefined;
}

/** CSV upsert: rows with an email update the existing candidate instead of duplicating. */
export function upsertCandidateByEmail(
  name: string,
  gender: Gender | null,
  imageUrl: string,
  email: string
): { action: 'added' | 'updated' } {
  const existing = getCandidateByEmail(email);
  if (existing) {
    updateCandidate(existing.id, name, gender ?? existing.gender, imageUrl, email.toLowerCase());
    return { action: 'updated' };
  }
  createCandidate(name, gender, imageUrl, email.toLowerCase());
  return { action: 'added' };
}

/** Auto-import: every signing-in employee becomes a candidate (deduped by email).
 *  Gender starts unset, so they stay off ballots until the admin assigns it. */
export function ensureEmployeeCandidate(email: string, name: string) {
  const normalized = email.toLowerCase();
  if (getCandidateByEmail(normalized)) return;
  createCandidate(
    name,
    null,
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
    normalized
  );
}

// ---------- votes ----------

/** Both rounds: one changeable vote per gender per round. */
export function setVote(
  userId: number,
  candidateId: number,
  gender: Gender,
  round: VotingRound
) {
  const replace = db.transaction(() => {
    db.prepare('DELETE FROM votes WHERE user_id = ? AND gender = ? AND round = ?').run(
      userId,
      gender,
      round
    );
    db.prepare('INSERT INTO votes (user_id, candidate_id, gender, round) VALUES (?, ?, ?, ?)').run(
      userId,
      candidateId,
      gender,
      round
    );
  });
  replace();
}

export function getUserVotes(userId: number, round: VotingRound): Record<Gender, number[]> {
  const rows = db
    .prepare('SELECT gender, candidate_id FROM votes WHERE user_id = ? AND round = ?')
    .all(userId, round) as { gender: Gender; candidate_id: number }[];
  const result: Record<Gender, number[]> = { male: [], female: [] };
  for (const r of rows) result[r.gender].push(r.candidate_id);
  return result;
}

export function getStats(round: VotingRound) {
  const totalVotes = (
    db.prepare('SELECT COUNT(*) AS n FROM votes WHERE round = ?').get(round) as { n: number }
  ).n;
  const totalUsers = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  const voters = (
    db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM votes WHERE round = ?').get(round) as {
      n: number;
    }
  ).n;
  return { totalVotes, totalUsers, voters };
}

/** Close round 1: mark the chosen finalists and reset the state machine for round 2. */
export function promoteFinalists(candidateIds: number[]) {
  const run = db.transaction(() => {
    db.prepare('UPDATE candidates SET is_finalist = 0').run();
    const mark = db.prepare('UPDATE candidates SET is_finalist = 1 WHERE id = ?');
    for (const id of candidateIds) mark.run(id);
    setSetting('voting_round', '2');
    setSetting('voting_state', 'not_started');
    setSetting('results_announced', '0');
  });
  run();
}

// ---------- Phase 1 migrations ----------

const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(
  (c) => c.name
);
if (!userCols.includes('department')) {
  db.exec(`ALTER TABLE users ADD COLUMN department TEXT`);
}
if (!userCols.includes('profile_photo_url')) {
  db.exec(`ALTER TABLE users ADD COLUMN profile_photo_url TEXT`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS schedule_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    location TEXT,
    speaker TEXT,
    type TEXT NOT NULL DEFAULT 'session' CHECK (type IN ('session','meal','break','activity','ceremony')),
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS event_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','android','ios')),
    subscription TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, platform)
  );
`);

// ---------- user profile ----------

export function updateUserProfile(userId: number, department: string | null, profilePhotoUrl: string | null) {
  db.prepare('UPDATE users SET department = ?, profile_photo_url = ? WHERE id = ?').run(
    department, profilePhotoUrl, userId
  );
}

export function getUserById(id: number) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | { id: number; email: string; name: string; department: string | null; profile_photo_url: string | null }
    | undefined;
}

// ---------- schedule ----------

export interface ScheduleSession {
  id: number;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  speaker: string | null;
  type: 'session' | 'meal' | 'break' | 'activity' | 'ceremony';
  description: string | null;
  sort_order: number;
  created_at: string;
}

export function listScheduleSessions(): ScheduleSession[] {
  return db.prepare('SELECT * FROM schedule_sessions ORDER BY start_time ASC, sort_order ASC').all() as ScheduleSession[];
}

export function createScheduleSession(data: Omit<ScheduleSession, 'id' | 'created_at'>) {
  const info = db.prepare(
    `INSERT INTO schedule_sessions (title, start_time, end_time, location, speaker, type, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(data.title, data.start_time, data.end_time ?? null, data.location ?? null,
        data.speaker ?? null, data.type, data.description ?? null, data.sort_order);
  return db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(info.lastInsertRowid) as ScheduleSession;
}

export function updateScheduleSession(id: number, data: Omit<ScheduleSession, 'id' | 'created_at'>) {
  db.prepare(
    `UPDATE schedule_sessions SET title=?, start_time=?, end_time=?, location=?, speaker=?, type=?, description=?, sort_order=? WHERE id=?`
  ).run(data.title, data.start_time, data.end_time ?? null, data.location ?? null,
        data.speaker ?? null, data.type, data.description ?? null, data.sort_order, id);
}

export function deleteScheduleSession(id: number) {
  db.prepare('DELETE FROM schedule_sessions WHERE id = ?').run(id);
}

// ---------- event info ----------

export interface EventInfoItem {
  id: number;
  section: string;
  title: string;
  body: string;
  maps_url: string | null;
  sort_order: number;
}

// Inline migration: add maps_url if the column doesn't exist yet
const eventInfoCols = (db.prepare('PRAGMA table_info(event_info)').all() as { name: string }[]).map(c => c.name);
if (!eventInfoCols.includes('maps_url')) {
  db.exec('ALTER TABLE event_info ADD COLUMN maps_url TEXT');
}

export function listEventInfo(): EventInfoItem[] {
  return db.prepare('SELECT * FROM event_info ORDER BY section ASC, sort_order ASC').all() as EventInfoItem[];
}

export function upsertEventInfo(
  id: number | null, section: string, title: string, body: string,
  sortOrder: number, mapsUrl: string | null = null
) {
  if (id) {
    db.prepare('UPDATE event_info SET section=?, title=?, body=?, sort_order=?, maps_url=? WHERE id=?')
      .run(section, title, body, sortOrder, mapsUrl, id);
  } else {
    db.prepare('INSERT INTO event_info (section, title, body, sort_order, maps_url) VALUES (?, ?, ?, ?, ?)')
      .run(section, title, body, sortOrder, mapsUrl);
  }
}

export function deleteEventInfo(id: number) {
  db.prepare('DELETE FROM event_info WHERE id = ?').run(id);
}

// ---------- attendance ----------

export function checkIn(userId: number) {
  return db.prepare(
    'INSERT OR IGNORE INTO attendance (user_id) VALUES (?)'
  ).run(userId);
}

export function getAttendance(userId: number) {
  return db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(userId) as
    | { id: number; user_id: number; checked_in_at: string }
    | undefined;
}

export function listAttendance() {
  return db.prepare(
    `SELECT a.*, u.name, u.email, u.department
     FROM attendance a JOIN users u ON u.id = a.user_id
     ORDER BY a.checked_in_at DESC`
  ).all() as { id: number; user_id: number; checked_in_at: string; name: string; email: string; department: string | null }[];
}

// ---------- push subscriptions ----------

export function savePushSubscription(userId: number, platform: 'web' | 'android' | 'ios', subscription: string) {
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, platform, subscription) VALUES (?, ?, ?)
     ON CONFLICT(user_id, platform) DO UPDATE SET subscription = excluded.subscription`
  ).run(userId, platform, subscription);
}

export function deletePushSubscription(userId: number, platform: 'web' | 'android' | 'ios') {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND platform = ?').run(userId, platform);
}

export function getAllPushSubscriptions() {
  return db.prepare('SELECT * FROM push_subscriptions').all() as
    { id: number; user_id: number; platform: string; subscription: string }[];
}

/** Subscriptions joined with the owning user — used for targeted sends. */
export function getPushSubscriptionsWithUser() {
  return db.prepare(
    `SELECT ps.id, ps.user_id, ps.platform, ps.subscription, u.email, u.name, u.department
     FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id`
  ).all() as {
    id: number; user_id: number; platform: string; subscription: string;
    email: string; name: string; department: string | null;
  }[];
}

/** Distinct, non-empty department names — for the notification targeting dropdown. */
export function listDepartments(): string[] {
  return (db.prepare(
    `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department ASC`
  ).all() as { department: string }[]).map((r) => r.department);
}

/** Vote-based promotion: the admin chooses how many advance per gender.
 *  Ties at the cutoff are included (when the cutoff has actual votes). */
export function promoteTopByVotes(
  maleCount: number,
  femaleCount: number
): { male: CandidateWithVotes[]; female: CandidateWithVotes[] } {
  const pick = (gender: Gender, n: number) => {
    const ranked = listCandidates(gender, { round: 1 });
    if (ranked.length <= n) return ranked;
    const cutoff = ranked[n - 1].vote_count;
    return cutoff > 0 ? ranked.filter((c) => c.vote_count >= cutoff) : ranked.slice(0, n);
  };
  const male = pick('male', maleCount);
  const female = pick('female', femaleCount);
  promoteFinalists([...male, ...female].map((c) => c.id));
  return { male, female };
}

// ═══════════════════════════════════════════════════════
//  PHASE 2 TABLES & FUNCTIONS
// ═══════════════════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS award_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS award_nominees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    department TEXT,
    image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS award_winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
    nominee_id INTEGER NOT NULL REFERENCES award_nominees(id) ON DELETE CASCADE,
    announced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category_id)
  );
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uploader_id INTEGER NOT NULL REFERENCES users(id),
    uploader_name TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    session_tag TEXT,
    approved INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    session_ratings TEXT NOT NULL DEFAULT '{}',
    food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
    venue_rating INTEGER CHECK (venue_rating BETWEEN 1 AND 5),
    suggestions TEXT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity TEXT NOT NULL,
    pts INTEGER NOT NULL DEFAULT 0,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, activity)
  );
`);

// Idempotent migration: add UNIQUE index if the table predates this constraint
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_points_user_activity ON points(user_id, activity)');
} catch { /* duplicates already exist — safe to ignore, INSERT OR IGNORE will handle dedup */ }

// ---------- awards ----------

export interface AwardCategory {
  id: number; name: string; description: string | null; sort_order: number; created_at: string;
  winner?: AwardNominee;
  nominees?: AwardNominee[];
}
export interface AwardNominee {
  id: number; category_id: number; name: string; department: string | null; image_url: string | null;
}

export function listAwardCategories(): AwardCategory[] {
  const cats = db.prepare('SELECT * FROM award_categories ORDER BY sort_order ASC, id ASC').all() as AwardCategory[];
  const nominees = db.prepare('SELECT * FROM award_nominees').all() as AwardNominee[];
  const winners = db.prepare(
    'SELECT w.category_id, n.* FROM award_winners w JOIN award_nominees n ON n.id = w.nominee_id'
  ).all() as (AwardNominee & { category_id: number })[];
  return cats.map(c => ({
    ...c,
    nominees: nominees.filter(n => n.category_id === c.id),
    winner: winners.find(w => w.category_id === c.id),
  }));
}

export function createAwardCategory(name: string, description: string | null, sortOrder: number) {
  const r = db.prepare('INSERT INTO award_categories (name, description, sort_order) VALUES (?, ?, ?)').run(name, description, sortOrder);
  return r.lastInsertRowid as number;
}
export function updateAwardCategory(id: number, name: string, description: string | null) {
  db.prepare('UPDATE award_categories SET name=?, description=? WHERE id=?').run(name, description, id);
}
export function deleteAwardCategory(id: number) {
  db.prepare('DELETE FROM award_categories WHERE id=?').run(id);
}
export function createAwardNominee(categoryId: number, name: string, department: string | null, imageUrl: string | null) {
  db.prepare('INSERT INTO award_nominees (category_id, name, department, image_url) VALUES (?,?,?,?)').run(categoryId, name, department, imageUrl);
}
export function deleteAwardNominee(id: number) {
  db.prepare('DELETE FROM award_nominees WHERE id=?').run(id);
}
export function announceWinner(categoryId: number, nomineeId: number) {
  db.prepare(
    'INSERT INTO award_winners (category_id, nominee_id) VALUES (?,?) ON CONFLICT(category_id) DO UPDATE SET nominee_id=excluded.nominee_id, announced_at=datetime("now")'
  ).run(categoryId, nomineeId);
}
export function clearWinner(categoryId: number) {
  db.prepare('DELETE FROM award_winners WHERE category_id=?').run(categoryId);
}

// ---------- photos ----------

export interface Photo {
  id: number; uploader_id: number; uploader_name: string; url: string;
  caption: string | null; session_tag: string | null; approved: number; uploaded_at: string;
}

export function listPhotos(approvedOnly = true): Photo[] {
  return db.prepare(
    approvedOnly
      ? 'SELECT * FROM photos WHERE approved=1 ORDER BY uploaded_at DESC'
      : 'SELECT * FROM photos ORDER BY approved ASC, uploaded_at DESC'
  ).all() as Photo[];
}
/** All photos by a specific user (approved=1, pending=0, rejected=-1). */
export function listUserPhotos(userId: number): Photo[] {
  return db.prepare('SELECT * FROM photos WHERE uploader_id=? ORDER BY uploaded_at DESC').all(userId) as Photo[];
}
export function addPhoto(uploaderId: number, uploaderName: string, url: string, caption: string | null, sessionTag: string | null) {
  const r = db.prepare('INSERT INTO photos (uploader_id, uploader_name, url, caption, session_tag) VALUES (?,?,?,?,?)').run(uploaderId, uploaderName, url, caption, sessionTag);
  awardPoints(uploaderId, 'uploaded_photo', 15);
  return r.lastInsertRowid as number;
}
export function approvePhoto(id: number) {
  db.prepare('UPDATE photos SET approved=1 WHERE id=?').run(id);
}
export function rejectPhoto(id: number) {
  // approved=-1 keeps the record visible to the uploader with "Rejected" status
  db.prepare('UPDATE photos SET approved=-1 WHERE id=?').run(id);
}

// ---------- feedback ----------

export interface FeedbackRow {
  id: number; user_id: number; overall_rating: number; session_ratings: string;
  food_rating: number | null; venue_rating: number | null; suggestions: string | null; submitted_at: string;
}

export function getFeedback(userId: number): FeedbackRow | undefined {
  return db.prepare('SELECT * FROM feedback WHERE user_id=?').get(userId) as FeedbackRow | undefined;
}
export function upsertFeedback(userId: number, overall: number, sessionRatings: Record<string, number>, food: number | null, venue: number | null, suggestions: string | null) {
  db.prepare(
    `INSERT INTO feedback (user_id, overall_rating, session_ratings, food_rating, venue_rating, suggestions)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET overall_rating=excluded.overall_rating,
       session_ratings=excluded.session_ratings, food_rating=excluded.food_rating,
       venue_rating=excluded.venue_rating, suggestions=excluded.suggestions,
       submitted_at=datetime('now')`
  ).run(userId, overall, JSON.stringify(sessionRatings), food, venue, suggestions);
  awardPoints(userId, 'feedback', 20);
}
export function listFeedback() {
  return db.prepare(
    'SELECT f.*, u.name, u.email FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.submitted_at DESC'
  ).all() as (FeedbackRow & { name: string; email: string })[];
}

// ---------- points / gamification ----------

export function awardPoints(userId: number, activity: string, pts: number) {
  db.prepare('INSERT OR IGNORE INTO points (user_id, activity, pts) VALUES (?,?,?)').run(userId, activity, pts);
}

export interface LeaderboardRow { user_id: number; name: string; email: string; total: number; activities: string }

export function getLeaderboard(limit = 20): LeaderboardRow[] {
  return db.prepare(
    `SELECT p.user_id, u.name, u.email,
            SUM(p.pts) AS total,
            GROUP_CONCAT(p.activity, ',') AS activities  /* unique per user due to UNIQUE(user_id,activity) */
     FROM points p JOIN users u ON u.id=p.user_id
     GROUP BY p.user_id ORDER BY total DESC LIMIT ?`
  ).all(limit) as LeaderboardRow[];
}

export function getUserPoints(userId: number): number {
  const r = db.prepare('SELECT SUM(pts) AS total FROM points WHERE user_id=?').get(userId) as { total: number | null };
  return r.total ?? 0;
}
