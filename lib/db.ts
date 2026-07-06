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
  INSERT OR IGNORE INTO settings (key, value) VALUES ('total_rounds', '2');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('otp_email_enabled', '0');
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
    voting_round: Math.max(1, parseInt(map.voting_round ?? '1', 10)),
    total_rounds: Math.max(1, parseInt(map.total_rounds ?? '2', 10)),
    candidates_preview: map.candidates_preview === '1',
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
  const order = opts.orderByName ? 'c.name ASC' : 'vote_count DESC, MIN(v.updated_at) ASC, c.name ASC';
  return db
    .prepare(
      `SELECT c.id, c.name, c.gender, c.email, c.employee_code, c.is_finalist,
              COALESCE(
                NULLIF(e.profile_photo_url, ''),
                NULLIF(u.profile_photo_url, ''),
                c.image_url
              ) AS image_url,
              COUNT(v.id) AS vote_count, MIN(v.updated_at) AS first_vote_at
       FROM candidates c
       LEFT JOIN employees e ON (
         (c.email        IS NOT NULL AND lower(e.email)         = lower(c.email))        OR
         (c.employee_code IS NOT NULL AND e.employee_code        = c.employee_code)
       )
       LEFT JOIN users u ON (
         (c.email IS NOT NULL AND lower(u.email) = lower(c.email))
       )
       LEFT JOIN votes v ON v.candidate_id = c.id AND v.round = ?
       WHERE (e.exclude_from_voting IS NULL OR e.exclude_from_voting = 0)
       ${where.length ? 'AND ' + where.join(' AND ') : ''}
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
  email: string | null = null,
  employeeCode: string | null = null
): Candidate {
  const info = db
    .prepare('INSERT INTO candidates (name, gender, image_url, email, employee_code) VALUES (?, ?, ?, ?, ?)')
    .run(name, gender, imageUrl, email, employeeCode);
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

/** Bulk-sync candidate image_url from employees/users tables.
 *  Matches by email first, then by employee_code. Returns number of rows updated. */
export function syncAllCandidatePhotos(): number {
  const result = db.prepare(`
    UPDATE candidates SET image_url = (
      SELECT COALESCE(NULLIF(e.profile_photo_url,''), NULLIF(u.profile_photo_url,''))
      FROM employees e
      LEFT JOIN users u ON lower(u.email) = lower(e.email)
      WHERE (
        (candidates.email         IS NOT NULL AND lower(e.email)          = lower(candidates.email)) OR
        (candidates.employee_code IS NOT NULL AND e.employee_code          = candidates.employee_code)
      )
      AND COALESCE(NULLIF(e.profile_photo_url,''), NULLIF(u.profile_photo_url,'')) IS NOT NULL
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN users u ON lower(u.email) = lower(e.email)
      WHERE (
        (candidates.email         IS NOT NULL AND lower(e.email)          = lower(candidates.email)) OR
        (candidates.employee_code IS NOT NULL AND e.employee_code          = candidates.employee_code)
      )
      AND COALESCE(NULLIF(e.profile_photo_url,''), NULLIF(u.profile_photo_url,'')) IS NOT NULL
    )
  `).run();
  return result.changes;
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

/** Advance to the next round: mark the chosen candidates as finalists and bump the round counter. */
export function promoteFinalists(candidateIds: number[], nextRound: number) {
  const run = db.transaction(() => {
    db.prepare('UPDATE candidates SET is_finalist = 0').run();
    const mark = db.prepare('UPDATE candidates SET is_finalist = 1 WHERE id = ?');
    for (const id of candidateIds) mark.run(id);
    setSetting('voting_round', String(nextRound));
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

/** Keep candidates.image_url in sync whenever a profile photo is saved. */
function syncCandidatePhoto(email: string | null | undefined, photoUrl: string | null) {
  if (!email || !photoUrl) return;
  db.prepare('UPDATE candidates SET image_url = ? WHERE email = ?').run(photoUrl, email.toLowerCase());
}

/** Keep candidates.name in sync when an employee name is corrected. */
function syncCandidateName(email: string | null | undefined, name: string | null) {
  if (!email || !name) return;
  db.prepare('UPDATE candidates SET name = ? WHERE email = ?').run(name, email.toLowerCase());
}

/** Keep candidates.email in sync when an employee email is corrected. */
function syncCandidateEmail(oldEmail: string | null | undefined, newEmail: string | null | undefined) {
  if (!oldEmail || !newEmail || oldEmail.toLowerCase() === newEmail.toLowerCase()) return;
  db.prepare('UPDATE candidates SET email = ? WHERE email = ?').run(
    newEmail.toLowerCase(), oldEmail.toLowerCase()
  );
}

/** Keep candidates.gender and votes.gender in sync when employee gender is corrected. */
function syncCandidateGender(email: string | null | undefined, gender: 'male' | 'female' | null) {
  if (!email || !gender) return;
  const emailLower = email.toLowerCase();
  const candidate = db.prepare('SELECT id, gender FROM candidates WHERE email = ?').get(emailLower) as
    | { id: number; gender: string | null } | undefined;
  if (!candidate || candidate.gender === gender) return;
  db.prepare('UPDATE candidates SET gender = ? WHERE id = ?').run(gender, candidate.id);
  db.prepare('UPDATE votes SET gender = ? WHERE candidate_id = ?').run(gender, candidate.id);
}

export function updateUserProfile(userId: number, department: string | null, profilePhotoUrl: string | null) {
  db.prepare('UPDATE users SET department = ?, profile_photo_url = ? WHERE id = ?').run(
    department, profilePhotoUrl, userId
  );
  if (profilePhotoUrl) {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    if (user?.email) {
      db.prepare('UPDATE employees SET profile_photo_url = ? WHERE lower(email) = ?').run(
        profilePhotoUrl, user.email.toLowerCase()
      );
    }
    syncCandidatePhoto(user?.email, profilePhotoUrl);
  }
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
  return db.prepare('SELECT * FROM event_info ORDER BY sort_order ASC, id ASC').all() as EventInfoItem[];
}

export function reorderEventInfo(ids: number[]) {
  const stmt = db.prepare('UPDATE event_info SET sort_order=? WHERE id=?');
  const tx = db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)));
  tx();
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

// Inline migration: add location columns to attendance if not present
{
  const cols = (db.prepare('PRAGMA table_info(attendance)').all() as { name: string }[]).map(c => c.name);
  if (!cols.includes('lat'))        db.exec('ALTER TABLE attendance ADD COLUMN lat REAL');
  if (!cols.includes('lng'))        db.exec('ALTER TABLE attendance ADD COLUMN lng REAL');
  if (!cols.includes('distance_m')) db.exec('ALTER TABLE attendance ADD COLUMN distance_m REAL');
}

export function checkIn(userId: number) {
  return db.prepare(
    'INSERT OR IGNORE INTO attendance (user_id) VALUES (?)'
  ).run(userId);
}

export function selfCheckIn(userId: number, lat: number, lng: number, distanceM: number) {
  return db.prepare(
    'INSERT OR IGNORE INTO attendance (user_id, lat, lng, distance_m) VALUES (?, ?, ?, ?)'
  ).run(userId, lat, lng, distanceM);
}

export function getAttendance(userId: number) {
  return db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(userId) as
    | { id: number; user_id: number; checked_in_at: string; lat: number | null; lng: number | null; distance_m: number | null }
    | undefined;
}

export function listAttendance() {
  return db.prepare(
    `SELECT a.*, u.name, u.email, u.department
     FROM attendance a JOIN users u ON u.id = a.user_id
     ORDER BY a.checked_in_at DESC`
  ).all() as {
    id: number; user_id: number; checked_in_at: string;
    lat: number | null; lng: number | null; distance_m: number | null;
    name: string; email: string; department: string | null;
  }[];
}

export interface VenueConfig {
  lat: number | null;
  lng: number | null;
  radius_km: number;
}

export function getVenueConfig(): VenueConfig {
  return {
    lat:       getSetting('venue_lat')    ? Number(getSetting('venue_lat'))    : null,
    lng:       getSetting('venue_lng')    ? Number(getSetting('venue_lng'))    : null,
    radius_km: getSetting('venue_radius_km') ? Number(getSetting('venue_radius_km')) : 0.5,
  };
}

export function setVenueConfig(lat: number, lng: number, radiusKm: number) {
  setSetting('venue_lat',       String(lat));
  setSetting('venue_lng',       String(lng));
  setSetting('venue_radius_km', String(radiusKm));
}

export function getCheckinToken(): string {
  let token = getSetting('checkin_token');
  if (!token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    token = require('crypto').randomBytes(16).toString('hex') as string;
    setSetting('checkin_token', token);
  }
  return token;
}

export function regenerateCheckinToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const token = require('crypto').randomBytes(16).toString('hex') as string;
  setSetting('checkin_token', token);
  return token;
}

// ---------- module config ----------

export type ModuleKey = 'schedule'|'awards'|'gallery'|'vote'|'qna'|'leaderboard'|'badge'|'venue'|'feedback';

const ALL_MODULES: ModuleKey[] = ['schedule','awards','gallery','vote','qna','leaderboard','badge','venue','feedback'];
const DEFAULT_TRUE = Object.fromEntries(ALL_MODULES.map(k => [k, true])) as Record<ModuleKey, boolean>;

export interface ModuleConfig {
  visibility: Record<ModuleKey, boolean>;
  enabled:    Record<ModuleKey, boolean>;
}

export function getModuleConfig(): ModuleConfig {
  const vis = getSetting('module_visibility');
  const ena = getSetting('module_enabled');
  return {
    visibility: vis ? { ...DEFAULT_TRUE, ...JSON.parse(vis) } : { ...DEFAULT_TRUE },
    enabled:    ena ? { ...DEFAULT_TRUE, ...JSON.parse(ena) } : { ...DEFAULT_TRUE },
  };
}

export function setModuleConfig(visibility: Record<string, boolean>, enabled: Record<string, boolean>) {
  setSetting('module_visibility', JSON.stringify(visibility));
  setSetting('module_enabled',    JSON.stringify(enabled));
}

const DEFAULT_MODULE_ORDER = ['schedule','awards','gallery','vote','qna','leaderboard','badge','venue','feedback'];

export function getModuleOrder(): string[] {
  const raw = getSetting('module_order');
  if (!raw) return DEFAULT_MODULE_ORDER;
  try {
    const parsed = JSON.parse(raw) as string[];
    // Merge: keep saved order, append any new keys not yet in saved list
    const extra = DEFAULT_MODULE_ORDER.filter(k => !parsed.includes(k));
    return [...parsed, ...extra];
  } catch { return DEFAULT_MODULE_ORDER; }
}

export function setModuleOrder(order: string[]): void {
  setSetting('module_order', JSON.stringify(order));
}

// ---------- data reset ----------

export function resetVotes()          { db.prepare('DELETE FROM votes').run(); }
export function resetAttendance()     { db.prepare('DELETE FROM attendance').run(); }
export function resetPoints()         { db.prepare('DELETE FROM points').run(); }
export function resetFeedback() {
  db.prepare('DELETE FROM feedback').run();
  db.prepare('DELETE FROM feedback_submissions').run();
}
export function resetGallery()        {
  db.prepare('DELETE FROM photo_tags').run();
  db.prepare('DELETE FROM face_embeddings').run();
  db.prepare('DELETE FROM photos').run();
}
export function resetRoomAllocations() { db.prepare('DELETE FROM room_allocations').run(); }
export function resetAadharCards()    { db.prepare('DELETE FROM aadhar_cards').run(); }
export function resetAwardWinners()   { db.prepare('DELETE FROM award_winners').run(); }
export function resetPushSubscriptions() { db.prepare('DELETE FROM push_subscriptions').run(); }

export function getPushSubscriptionStats(): { web: number; android: number; ios: number; total: number } {
  const rows = db.prepare(
    `SELECT platform, COUNT(*) as cnt FROM push_subscriptions GROUP BY platform`
  ).all() as { platform: string; cnt: number }[];
  const byPlatform: Record<string, number> = {};
  rows.forEach(r => { byPlatform[r.platform] = r.cnt; });
  const web     = byPlatform['web']     ?? 0;
  const android = byPlatform['android'] ?? 0;
  const ios     = byPlatform['ios']     ?? 0;
  return { web, android, ios, total: web + android + ios };
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

export function deletePushSubscriptionById(id: number) {
  db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id);
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

/* ── Admin code management (DB-backed, managed from admin UI) ── */

export function getDbAdminCodes(): string[] {
  const raw = getSetting('admin_codes');
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function addDbAdminCode(code: string): void {
  const codes = getDbAdminCodes();
  const trimmed = code.trim();
  if (!trimmed || codes.includes(trimmed)) return;
  setSetting('admin_codes', JSON.stringify([...codes, trimmed]));
}

export function removeDbAdminCode(code: string): void {
  const codes = getDbAdminCodes().filter(c => c !== code.trim());
  setSetting('admin_codes', JSON.stringify(codes));
}

/** Distinct, non-empty department names — for the notification targeting dropdown. */
export function listDepartments(): string[] {
  return (db.prepare(
    `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department ASC`
  ).all() as { department: string }[]).map((r) => r.department);
}

/** Vote-based promotion: admin chooses how many advance per gender from the current round.
 *  Ties at the cutoff are included (when the cutoff has actual votes). */
export function promoteTopByVotes(
  maleCount: number,
  femaleCount: number,
  currentRound: number,
  nextRound: number,
): { male: CandidateWithVotes[]; female: CandidateWithVotes[] } {
  // Always take exactly N — ties broken by first-vote timestamp (MIN(v.updated_at) ASC in the query).
  const pick = (gender: Gender, n: number) => {
    const ranked = listCandidates(gender, { round: currentRound, finalistsOnly: false });
    return ranked.slice(0, n);
  };
  const male = pick('male', maleCount);
  const female = pick('female', femaleCount);
  promoteFinalists([...male, ...female].map((c) => c.id), nextRound);
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
`);
// Ensure the UNIQUE constraint index exists even for databases created before it was added
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_award_winners_category ON award_winners(category_id)`);
db.exec(`
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
  CREATE TABLE IF NOT EXISTS photo_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    confidence REAL NOT NULL DEFAULT 0,
    tagged_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(photo_id, employee_id)
  );
  CREATE TABLE IF NOT EXISTS face_embeddings (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    embedding TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS feedback_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    type TEXT NOT NULL DEFAULT 'rating',
    options TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS feedback_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    answers TEXT NOT NULL DEFAULT '{}',
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

// Seed default feedback questions on first run
{
  const count = (db.prepare('SELECT COUNT(*) as c FROM feedback_questions').get() as { c: number }).c;
  if (count === 0) {
    const ins = db.prepare(
      'INSERT INTO feedback_questions (title, subtitle, type, required, sort_order) VALUES (?,?,?,?,?)'
    );
    const seed = db.transaction(() => {
      ins.run('Overall Experience', 'How would you rate the event overall?', 'rating', 1, 0);
      ins.run('Food Quality', 'Rate the food and refreshments', 'rating', 0, 1);
      ins.run('Venue & Facilities', 'Rate the venue, seating, and facilities', 'rating', 0, 2);
      ins.run('What did you enjoy most?', null, 'text', 0, 3);
      ins.run('Suggestions for next year', 'Any improvements you would suggest?', 'text', 0, 4);
    });
    seed();
  }
}

// Room allocation + Aadhar tables
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT NOT NULL UNIQUE,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS room_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id)
  );
  CREATE TABLE IF NOT EXISTS aadhar_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    front_url TEXT,
    back_url TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(employee_id)
  );
`);

// Add thumbnail_url and face_tag_status to photos if missing
{
  const photoCols = (db.prepare('PRAGMA table_info(photos)').all() as { name: string }[]).map(c => c.name);
  if (!photoCols.includes('thumbnail_url')) {
    db.exec('ALTER TABLE photos ADD COLUMN thumbnail_url TEXT');
  }
  if (!photoCols.includes('face_tag_status')) {
    db.exec("ALTER TABLE photos ADD COLUMN face_tag_status TEXT DEFAULT NULL");
  }
}

// Seed master room list — INSERT OR IGNORE keeps existing notes/allocations intact
{
  const masterRooms = [
    '101','102','103','104','105','106',
    '201','202','203','204','205','206',
    '301','302','303','304','305','306','307','308','309','310',
    '401','402','403','404','405','406','407','408','409','410',
    '602','603','604','605',
    '702','703','704','705',
  ];
  const seedRoom = db.prepare('INSERT OR IGNORE INTO rooms (room_number) VALUES (?)');
  const seedAll  = db.transaction((rooms: string[]) => rooms.forEach(n => seedRoom.run(n)));
  seedAll(masterRooms);
}
// Promote legacy pending photos (approved=0) to visible (approved=1)
db.prepare('UPDATE photos SET approved=1 WHERE approved=0').run();

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
  db.prepare('DELETE FROM award_winners WHERE category_id=?').run(categoryId);
  db.prepare('INSERT INTO award_winners (category_id, nominee_id) VALUES (?,?)').run(categoryId, nomineeId);
}
export function clearWinner(categoryId: number) {
  db.prepare('DELETE FROM award_winners WHERE category_id=?').run(categoryId);
}

// ---------- face embeddings ----------

export function saveFaceEmbedding(employeeId: number, embedding: number[]) {
  db.prepare(
    `INSERT INTO face_embeddings (employee_id, embedding, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(employee_id) DO UPDATE SET embedding = excluded.embedding, updated_at = excluded.updated_at`
  ).run(employeeId, JSON.stringify(embedding));
}

export function getFaceEmbedding(employeeId: number): number[] | null {
  const row = db.prepare('SELECT embedding FROM face_embeddings WHERE employee_id = ?').get(employeeId) as { embedding: string } | undefined;
  return row ? JSON.parse(row.embedding) : null;
}

export function getAllFaceEmbeddings(): { employee_id: number; embedding: number[] }[] {
  return (db.prepare('SELECT employee_id, embedding FROM face_embeddings').all() as { employee_id: number; embedding: string }[])
    .map(r => ({ employee_id: r.employee_id, embedding: JSON.parse(r.embedding) }));
}

export function deleteFaceEmbedding(employeeId: number) {
  db.prepare('DELETE FROM face_embeddings WHERE employee_id = ?').run(employeeId);
}

// ---------- photo tags ----------

export function addPhotoTag(photoId: number, employeeId: number, confidence: number) {
  db.prepare(
    'INSERT OR IGNORE INTO photo_tags (photo_id, employee_id, confidence) VALUES (?, ?, ?)'
  ).run(photoId, employeeId, confidence);
}

export function getPhotosByEmployeeId(employeeId: number): Photo[] {
  return db.prepare(
    `SELECT p.* FROM photos p
     JOIN photo_tags pt ON pt.photo_id = p.id
     WHERE pt.employee_id = ? AND p.approved = 1
     ORDER BY p.uploaded_at DESC`
  ).all(employeeId) as Photo[];
}

export function getPhotosWithConfidenceByEmployeeId(
  employeeId: number,
  minConfidence = 0,
): Array<Photo & { tag_confidence: number }> {
  return db.prepare(
    `SELECT p.*, pt.confidence as tag_confidence
     FROM photos p
     JOIN photo_tags pt ON pt.photo_id = p.id
     WHERE pt.employee_id = ? AND pt.confidence >= ? AND p.approved = 1
     ORDER BY pt.confidence DESC`,
  ).all(employeeId, minConfidence) as Array<Photo & { tag_confidence: number }>;
}

export function getTagsForPhoto(photoId: number) {
  return db.prepare(
    `SELECT pt.employee_id, pt.confidence, e.name, e.employee_code
     FROM photo_tags pt JOIN employees e ON e.id = pt.employee_id
     WHERE pt.photo_id = ?`
  ).all(photoId) as { employee_id: number; confidence: number; name: string; employee_code: string }[];
}

// ---------- rooms ----------

export interface Room {
  id: number; room_number: string; notes: string | null; created_at: string;
}
export interface RoomWithOccupants extends Room {
  employees: Array<{ id: number; name: string; employee_code: string; profile_photo_url: string | null }>;
}

export function createRoom(room_number: string, notes?: string): Room {
  const r = db.prepare(
    'INSERT INTO rooms (room_number, notes) VALUES (?, ?) RETURNING *'
  ).get(room_number.trim(), notes?.trim() ?? null) as Room;
  return r;
}

export function deleteRoom(id: number) {
  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
}

export function listRoomsWithOccupants(): RoomWithOccupants[] {
  const rows = db.prepare(
    `SELECT r.id, r.room_number, r.notes, r.created_at,
       COALESCE(json_group_array(
         CASE WHEN e.id IS NOT NULL THEN
           json_object('id', e.id, 'name', e.name, 'employee_code', e.employee_code,
                       'profile_photo_url', e.profile_photo_url)
         ELSE NULL END
       ) FILTER (WHERE e.id IS NOT NULL), '[]') as employees_json
     FROM rooms r
     LEFT JOIN room_allocations ra ON ra.room_id = r.id
     LEFT JOIN employees e ON e.id = ra.employee_id
     GROUP BY r.id
     ORDER BY r.room_number`
  ).all() as Array<Room & { employees_json: string }>;
  return rows.map(r => ({ ...r, employees: JSON.parse(r.employees_json) }));
}

export function assignToRoom(room_id: number, employee_id: number) {
  db.prepare(
    'INSERT OR REPLACE INTO room_allocations (room_id, employee_id) VALUES (?, ?)'
  ).run(room_id, employee_id);
}

export function removeFromRoom(employee_id: number) {
  db.prepare('DELETE FROM room_allocations WHERE employee_id = ?').run(employee_id);
}

export function getRoomForEmployee(employee_id: number): (Room & { roommates: Array<{ id: number; name: string; employee_code: string; profile_photo_url: string | null }> }) | null {
  const row = db.prepare(
    `SELECT r.*,
       COALESCE(json_group_array(
         json_object('id', e.id, 'name', e.name, 'employee_code', e.employee_code, 'profile_photo_url', e.profile_photo_url)
       ) FILTER (WHERE e.id IS NOT NULL AND e.id != ?), '[]') as roommates_json
     FROM rooms r
     JOIN room_allocations ra ON ra.room_id = r.id AND ra.employee_id = ?
     LEFT JOIN room_allocations ra2 ON ra2.room_id = r.id
     LEFT JOIN employees e ON e.id = ra2.employee_id
     GROUP BY r.id`
  ).get(employee_id, employee_id) as (Room & { roommates_json: string }) | undefined;
  if (!row) return null;
  return { ...row, roommates: JSON.parse(row.roommates_json) };
}

// ---------- aadhar ----------

export interface AadharCard {
  id: number; employee_id: number; front_url: string | null; back_url: string | null; uploaded_at: string;
}
export interface AadharWithEmployee {
  employee_id: number; name: string; employee_code: string; department: string | null;
  profile_photo_url: string | null; room_number: string | null;
  front_url: string | null; back_url: string | null; uploaded_at: string | null;
}

export function upsertAadharCard(employee_id: number, front_url?: string | null, back_url?: string | null) {
  db.prepare(
    `INSERT INTO aadhar_cards (employee_id, front_url, back_url)
     VALUES (?, ?, ?)
     ON CONFLICT(employee_id) DO UPDATE SET
       front_url = COALESCE(excluded.front_url, aadhar_cards.front_url),
       back_url  = COALESCE(excluded.back_url,  aadhar_cards.back_url),
       uploaded_at = datetime('now')`
  ).run(employee_id, front_url ?? null, back_url ?? null);
}

export function getAadharByEmployee(employee_id: number): AadharCard | null {
  return db.prepare('SELECT * FROM aadhar_cards WHERE employee_id = ?').get(employee_id) as AadharCard | null ?? null;
}

export function deleteAadharCard(employee_id: number) {
  db.prepare('DELETE FROM aadhar_cards WHERE employee_id = ?').run(employee_id);
}

export function listAadharWithRoomInfo(): AadharWithEmployee[] {
  return db.prepare(
    `SELECT e.id as employee_id, e.name, e.employee_code, e.department, e.profile_photo_url,
       r.room_number,
       ac.front_url, ac.back_url, ac.uploaded_at
     FROM employees e
     LEFT JOIN room_allocations ra ON ra.employee_id = e.id
     LEFT JOIN rooms r ON r.id = ra.room_id
     LEFT JOIN aadhar_cards ac ON ac.employee_id = e.id
     WHERE e.is_active = 1
     ORDER BY r.room_number NULLS LAST, e.name`
  ).all() as AadharWithEmployee[];
}

// ---------- photos ----------

export interface Photo {
  id: number; uploader_id: number; uploader_name: string; url: string;
  thumbnail_url: string | null; caption: string | null; session_tag: string | null;
  approved: number; uploaded_at: string; face_tag_status: string | null;
}
export function setPhotoThumbnail(id: number, thumbnailUrl: string) {
  db.prepare('UPDATE photos SET thumbnail_url=? WHERE id=?').run(thumbnailUrl, id);
}
export function setPhotoTagStatus(id: number, status: 'done' | 'failed') {
  db.prepare('UPDATE photos SET face_tag_status=? WHERE id=?').run(status, id);
}
export function listPhotosNeedingTag(): Photo[] {
  return db.prepare(
    "SELECT * FROM photos WHERE approved=1 AND (face_tag_status IS NULL OR face_tag_status='failed') ORDER BY uploaded_at DESC"
  ).all() as Photo[];
}
export function countPhotosNeedingTag(): { untagged: number; failed: number } {
  const u = (db.prepare("SELECT COUNT(*) as n FROM photos WHERE approved=1 AND face_tag_status IS NULL").get() as { n: number }).n;
  const f = (db.prepare("SELECT COUNT(*) as n FROM photos WHERE approved=1 AND face_tag_status='failed'").get() as { n: number }).n;
  return { untagged: u, failed: f };
}
export function listPhotosWithoutThumbnail(): Photo[] {
  return db.prepare('SELECT * FROM photos WHERE thumbnail_url IS NULL AND approved != -1 ORDER BY id DESC').all() as Photo[];
}

export function getPhotoById(id: number): Photo | undefined {
  return db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;
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
  // Auto-approved — no moderation queue for user uploads
  const r = db.prepare('INSERT INTO photos (uploader_id, uploader_name, url, caption, session_tag, approved) VALUES (?,?,?,?,?,1)').run(uploaderId, uploaderName, url, caption, sessionTag);
  awardPoints(uploaderId, 'uploaded_photo', 15);
  return r.lastInsertRowid as number;
}
export function addPhotoPreApproved(uploaderId: number, uploaderName: string, url: string, caption: string | null, sessionTag: string | null) {
  const r = db.prepare('INSERT INTO photos (uploader_id, uploader_name, url, caption, session_tag, approved) VALUES (?,?,?,?,?,1)').run(uploaderId, uploaderName, url, caption, sessionTag);
  return r.lastInsertRowid as number;
}
export function disablePhoto(id: number) {
  db.prepare('UPDATE photos SET approved=-1 WHERE id=?').run(id);
}
export function enablePhoto(id: number) {
  db.prepare('UPDATE photos SET approved=1 WHERE id=?').run(id);
}
export function deletePhoto(id: number) {
  db.prepare('DELETE FROM photos WHERE id=?').run(id);
}
/** Returns all photo + thumbnail URLs, then wipes the photos table (photo_tags cascade). */
export function deleteAllPhotos(): { url: string; thumbnail_url: string | null }[] {
  const rows = db.prepare('SELECT url, thumbnail_url FROM photos').all() as { url: string; thumbnail_url: string | null }[];
  db.prepare('DELETE FROM photos').run();
  return rows;
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

// ---------- feedback questions (configurable) ----------

export type FeedbackQuestionType = 'rating' | 'rating_group' | 'text' | 'choice' | 'multiselect' | 'yesno';

export interface FeedbackQuestion {
  id: number;
  title: string;
  subtitle: string | null;
  type: FeedbackQuestionType;
  options: string | null;
  required: number;
  sort_order: number;
  active: number;
}

export interface FeedbackSubmission {
  id: number;
  user_id: number;
  answers: string;
  submitted_at: string;
}

export function listFeedbackQuestions(activeOnly = true): FeedbackQuestion[] {
  return db.prepare(
    `SELECT * FROM feedback_questions ${activeOnly ? 'WHERE active=1' : ''} ORDER BY sort_order ASC, id ASC`
  ).all() as FeedbackQuestion[];
}

export function upsertFeedbackQuestion(data: {
  id?: number; title: string; subtitle?: string | null; type: FeedbackQuestionType;
  options?: string | null; required?: number; sort_order?: number; active?: number;
}): number {
  if (data.id) {
    db.prepare(
      'UPDATE feedback_questions SET title=?,subtitle=?,type=?,options=?,required=?,sort_order=?,active=? WHERE id=?'
    ).run(data.title, data.subtitle ?? null, data.type, data.options ?? null,
      data.required ?? 0, data.sort_order ?? 0, data.active ?? 1, data.id);
    return data.id;
  }
  const max = (db.prepare('SELECT MAX(sort_order) as m FROM feedback_questions').get() as { m: number | null }).m ?? -1;
  const info = db.prepare(
    'INSERT INTO feedback_questions (title,subtitle,type,options,required,sort_order,active) VALUES (?,?,?,?,?,?,?)'
  ).run(data.title, data.subtitle ?? null, data.type, data.options ?? null,
    data.required ?? 0, max + 1, data.active ?? 1);
  return Number(info.lastInsertRowid);
}

export function deleteFeedbackQuestion(id: number) {
  db.prepare('DELETE FROM feedback_questions WHERE id=?').run(id);
}

export function reorderFeedbackQuestions(ids: number[]) {
  const stmt = db.prepare('UPDATE feedback_questions SET sort_order=? WHERE id=?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

export function getFeedbackSubmission(userId: number): FeedbackSubmission | undefined {
  return db.prepare('SELECT * FROM feedback_submissions WHERE user_id=?').get(userId) as FeedbackSubmission | undefined;
}

export function upsertFeedbackSubmission(userId: number, answers: Record<string, unknown>) {
  db.prepare(
    `INSERT INTO feedback_submissions (user_id,answers) VALUES (?,?)
     ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers,submitted_at=datetime('now')`
  ).run(userId, JSON.stringify(answers));
  awardPoints(userId, 'feedback', 20);
}

export function listFeedbackSubmissions() {
  return db.prepare(
    'SELECT fs.*,u.name,u.email FROM feedback_submissions fs JOIN users u ON u.id=fs.user_id ORDER BY fs.submitted_at DESC'
  ).all() as (FeedbackSubmission & { name: string; email: string })[];
}

export function listAllUsers() {
  return db.prepare(
    `SELECT id, name, email, department, profile_photo_url FROM users ORDER BY name ASC`
  ).all() as { id: number; name: string; email: string; department: string | null; profile_photo_url: string | null }[];
}

// ═══════════════════════════════════════════════════════
//  EMPLOYEES (admin-managed master roster)
// ═══════════════════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    department TEXT,
    gender TEXT CHECK (gender IN ('male','female')),
    profile_photo_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// Inline migrations
const empCols = (db.prepare('PRAGMA table_info(employees)').all() as { name: string }[]).map(c => c.name);
if (!empCols.includes('exclude_from_voting')) {
  db.exec('ALTER TABLE employees ADD COLUMN exclude_from_voting INTEGER NOT NULL DEFAULT 0');
}

// add employee_code to users + candidates
const userColsV2 = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name);
if (!userColsV2.includes('employee_code')) {
  db.exec('ALTER TABLE users ADD COLUMN employee_code TEXT');
}

const candidateColsV2 = (db.prepare('PRAGMA table_info(candidates)').all() as { name: string }[]).map(c => c.name);
if (!candidateColsV2.includes('employee_code')) {
  db.exec('ALTER TABLE candidates ADD COLUMN employee_code TEXT');
}

// Back-fill employee_code from image URL filename for existing candidates.
// Filenames like "1423.png" → employee_code "1423" (numeric-only filenames only).
{
  const rows = db.prepare(
    `SELECT id, image_url FROM candidates WHERE employee_code IS NULL AND image_url IS NOT NULL`
  ).all() as { id: number; image_url: string }[];
  const upd = db.prepare('UPDATE candidates SET employee_code = ? WHERE id = ?');
  for (const r of rows) {
    try {
      const filename = (r.image_url.split('/').pop() ?? '').split('?')[0];
      const code = filename.replace(/\.[^.]+$/, '');
      if (/^\d+$/.test(code)) upd.run(code, r.id);
    } catch { /* ignore */ }
  }
}

// Seed employees from candidates that have an employee_code but no matching employee record yet.
// Runs once at startup; safe to repeat (INSERT OR IGNORE skips duplicates by employee_code/email).
{
  const candidates = db.prepare(
    `SELECT employee_code, name, gender, image_url, email
     FROM candidates
     WHERE employee_code IS NOT NULL AND employee_code != ''`
  ).all() as { employee_code: string; name: string; gender: string | null; image_url: string | null; email: string | null }[];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO employees (employee_code, name, email, gender, profile_photo_url, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  );

  let seeded = 0;
  for (const c of candidates) {
    // Require at least a placeholder email if missing (use code@internal.local)
    const email = c.email?.trim() || `${c.employee_code}@internal.local`;
    try {
      const result = insert.run(c.employee_code, c.name, email, c.gender ?? null, c.image_url ?? null) as { changes: number };
      if (result.changes) seeded++;
    } catch { /* already exists under a different unique constraint */ }
  }
  if (seeded > 0) console.log(`[db] Seeded ${seeded} employee(s) from candidates table.`);
}

// Back-fill employees.profile_photo_url from users where employees still have the old photo.
// Catches up any profile photos employees uploaded via the /me page before this sync was added.
{
  const result = db.prepare(`
    UPDATE employees
    SET profile_photo_url = (
      SELECT u.profile_photo_url
      FROM users u
      WHERE lower(u.email) = lower(employees.email)
        AND u.profile_photo_url IS NOT NULL
    )
    WHERE EXISTS (
      SELECT 1 FROM users u
      WHERE lower(u.email) = lower(employees.email)
        AND u.profile_photo_url IS NOT NULL
        AND (employees.profile_photo_url IS NULL
             OR u.profile_photo_url != employees.profile_photo_url)
    )
  `).run() as { changes: number };
  if (result.changes > 0)
    console.log(`[db] Synced profile photos for ${result.changes} employee(s) from users table.`);
}

export interface Employee {
  id: number;
  employee_code: string;
  name: string;
  email: string;
  department: string | null;
  gender: 'male' | 'female' | null;
  profile_photo_url: string | null;
  is_active: number;
  exclude_from_voting: number;
  created_at: string;
}

export function listEmployees(): Employee[] {
  return db.prepare('SELECT * FROM employees ORDER BY name ASC').all() as Employee[];
}

export type EngagementStatus = 'not_logged_in' | 'inactive' | 'active';
export type EmployeeEngagement = {
  id: number; employee_code: string; name: string; email: string;
  department: string | null; gender: string | null;
  status: EngagementStatus; logged_in_at: string | null; activity_count: number;
};

export function listEmployeeEngagement(): EmployeeEngagement[] {
  const rows = db.prepare(`
    SELECT
      e.id, e.employee_code, e.name, e.email, e.department, e.gender,
      u.created_at AS logged_in_at,
      COALESCE(p.cnt, 0) AS activity_count
    FROM employees e
    LEFT JOIN users u ON u.email = e.email COLLATE NOCASE
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM points GROUP BY user_id) p ON p.user_id = u.id
    WHERE e.is_active = 1
    ORDER BY e.name ASC
  `).all() as (Omit<EmployeeEngagement, 'status'> & { logged_in_at: string | null; activity_count: number })[];
  return rows.map(r => ({
    ...r,
    status: !r.logged_in_at ? 'not_logged_in' : r.activity_count === 0 ? 'inactive' : 'active',
  }));
}

export function listEmployeesWithFaceStatus(): (Employee & { face_indexed: boolean })[] {
  return (db.prepare(`
    SELECT e.*,
      CASE WHEN EXISTS (SELECT 1 FROM face_embeddings fe WHERE fe.employee_id = e.id) THEN 1 ELSE 0 END AS face_indexed
    FROM employees e
    ORDER BY e.name ASC
  `).all() as (Employee & { face_indexed: number })[]).map(r => ({ ...r, face_indexed: r.face_indexed === 1 }));
}

export function getEmployeeById(id: number): Employee | undefined {
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined;
}

export function getEmployeeByCode(code: string): Employee | undefined {
  return db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(code) as Employee | undefined;
}

export function getEmployeeByEmail(email: string): Employee | undefined {
  return db.prepare('SELECT * FROM employees WHERE email = ?').get(email.toLowerCase()) as Employee | undefined;
}

export function createEmployee(
  employeeCode: string, name: string, email: string,
  department: string | null, gender: 'male' | 'female' | null,
  profilePhotoUrl: string | null
): Employee {
  const r = db.prepare(
    `INSERT INTO employees (employee_code, name, email, department, gender, profile_photo_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(employeeCode, name, email.toLowerCase(), department, gender, profilePhotoUrl);
  syncCandidatePhoto(email, profilePhotoUrl);
  syncCandidateName(email, name);
  syncCandidateGender(email, gender);
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(r.lastInsertRowid) as Employee;
}

export function updateEmployee(
  id: number, employeeCode: string, name: string, email: string,
  department: string | null, gender: 'male' | 'female' | null,
  profilePhotoUrl: string | null, isActive: number, excludeFromVoting = 0
) {
  const old = db.prepare('SELECT email FROM employees WHERE id = ?').get(id) as { email: string } | undefined;
  db.prepare(
    `UPDATE employees SET employee_code=?, name=?, email=?, department=?, gender=?, profile_photo_url=?, is_active=?, exclude_from_voting=? WHERE id=?`
  ).run(employeeCode, name, email.toLowerCase(), department, gender, profilePhotoUrl, isActive, excludeFromVoting, id);
  syncCandidateEmail(old?.email, email);
  syncCandidatePhoto(email, profilePhotoUrl);
  syncCandidateName(email, name);
  syncCandidateGender(email, gender);
}

export function deleteEmployee(id: number) {
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
}

// OTP storage (DB-backed, survives hot-reload)
export function saveOtp(email: string, code: string, ttlSeconds = 300) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  db.prepare(
    `INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at`
  ).run(email.toLowerCase(), code, expiresAt);
}

export function verifyAndConsumeOtp(email: string, code: string): boolean {
  const row = db.prepare('SELECT code, expires_at FROM otp_codes WHERE email = ?')
    .get(email.toLowerCase()) as { code: string; expires_at: string } | undefined;
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email.toLowerCase());
    return false;
  }
  if (row.code !== code) return false;
  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email.toLowerCase());
  return true;
}

// Upsert user linked to an employee record
export function upsertUserFromEmployee(employee: Employee): { id: number; email: string; name: string; employee_code: string } {
  db.prepare(
    `INSERT INTO users (email, name, employee_code)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name=excluded.name, employee_code=excluded.employee_code`
  ).run(employee.email, employee.name, employee.employee_code);
  return db.prepare('SELECT id, email, name, employee_code FROM users WHERE email = ?')
    .get(employee.email) as { id: number; email: string; name: string; employee_code: string };
}

// ---------- points / gamification ----------

export function awardPoints(userId: number, activity: string, pts: number) {
  db.prepare('INSERT OR IGNORE INTO points (user_id, activity, pts) VALUES (?,?,?)').run(userId, activity, pts);
}

export interface LeaderboardRow { user_id: number; name: string; email: string; total: number; activities: string; profile_photo_url: string | null }

export function getLeaderboard(limit = 20): LeaderboardRow[] {
  return db.prepare(
    `SELECT p.user_id, u.name, u.email, u.profile_photo_url,
            SUM(p.pts) AS total,
            GROUP_CONCAT(p.activity, ',') AS activities
     FROM points p JOIN users u ON u.id=p.user_id
     GROUP BY p.user_id ORDER BY total DESC LIMIT ?`
  ).all(limit) as LeaderboardRow[];
}

export function updateRoom(id: number, room_number: string, notes: string | null) {
  db.prepare('UPDATE rooms SET room_number=?, notes=? WHERE id=?').run(room_number, notes, id);
}

export function getUserPoints(userId: number): number {
  const r = db.prepare('SELECT SUM(pts) AS total FROM points WHERE user_id=?').get(userId) as { total: number | null };
  return r.total ?? 0;
}
