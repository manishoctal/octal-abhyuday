import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { AppState, Candidate, CandidateWithVotes, Gender, VotingRound, VotingState } from './types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'vote.db');

/** How many candidates per gender advance from the round-1 qualifier */
export const FINALISTS_PER_GENDER = 10;

declare global {
  // eslint-disable-next-line no-var
  var __octalVoteDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
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

// Reuse the connection across Next.js dev hot-reloads
export const db: Database.Database = globalThis.__octalVoteDb ?? createDb();
globalThis.__octalVoteDb = db;

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
