import { db } from './db';
import type {
  QaLeaderboardRow,
  QaQuestion,
  QaQuestionType,
  QaResults,
  QaSession,
  QaSessionKind,
  QaTextAnswer,
} from './types';

// Runs on module load so new tables appear without a full server restart.
db.exec(`
  CREATE TABLE IF NOT EXISTS qa_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','ended')),
    kind TEXT NOT NULL DEFAULT 'qna' CHECK (kind IN ('qna','poll','ranking')),
    active_question_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS qa_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('mcq','text','rating','rank')),
    prompt TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    correct_option INTEGER,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','live','revealed')),
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS qa_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    value TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(question_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS qa_upvotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    answer_id INTEGER NOT NULL REFERENCES qa_answers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    UNIQUE(answer_id, user_id)
  );
`);

// Migrations for databases created before the polls/rankings phase
const sessionCols = db.prepare('PRAGMA table_info(qa_sessions)').all() as { name: string }[];
if (!sessionCols.some((c) => c.name === 'kind')) {
  db.exec("ALTER TABLE qa_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'qna'");
}
const questionsSql =
  (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'qa_questions'")
      .get() as { sql: string } | undefined
  )?.sql ?? '';
if (!questionsSql.includes("'rank'")) {
  // SQLite can't relax a CHECK constraint in place — rebuild the table
  db.exec(`
    CREATE TABLE qa_questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('mcq','text','rating','rank')),
      prompt TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      correct_option INTEGER,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','live','revealed')),
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO qa_questions_new (id, session_id, type, prompt, options, correct_option, state, sort_order)
      SELECT id, session_id, type, prompt, options, correct_option, state, sort_order FROM qa_questions;
    DROP TABLE qa_questions;
    ALTER TABLE qa_questions_new RENAME TO qa_questions;
  `);
}

function parseQuestion(row: Record<string, unknown>): QaQuestion {
  return {
    ...(row as unknown as QaQuestion),
    options: JSON.parse((row.options as string) ?? '[]'),
  };
}

/* ---------- sessions ---------- */

export function listSessions(): (QaSession & { question_count: number })[] {
  return db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM qa_questions q WHERE q.session_id = s.id) AS question_count
       FROM qa_sessions s ORDER BY s.created_at DESC, s.id DESC`
    )
    .all() as (QaSession & { question_count: number })[];
}

export function getQaSession(id: number): QaSession | undefined {
  return db.prepare('SELECT * FROM qa_sessions WHERE id = ?').get(id) as QaSession | undefined;
}

export function createQaSession(title: string, kind: QaSessionKind = 'qna'): QaSession {
  const info = db.prepare('INSERT INTO qa_sessions (title, kind) VALUES (?, ?)').run(title, kind);
  return getQaSession(Number(info.lastInsertRowid))!;
}

export function deleteQaSession(id: number) {
  db.prepare('DELETE FROM qa_upvotes WHERE answer_id IN (SELECT a.id FROM qa_answers a JOIN qa_questions q ON q.id = a.question_id WHERE q.session_id = ?)').run(id);
  db.prepare('DELETE FROM qa_answers WHERE question_id IN (SELECT id FROM qa_questions WHERE session_id = ?)').run(id);
  db.prepare('DELETE FROM qa_questions WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM qa_sessions WHERE id = ?').run(id);
}

export function getLiveSession(): QaSession | undefined {
  return db.prepare("SELECT * FROM qa_sessions WHERE status = 'live' LIMIT 1").get() as
    | QaSession
    | undefined;
}

export function getLatestEndedSession(): QaSession | undefined {
  return db
    .prepare("SELECT * FROM qa_sessions WHERE status = 'ended' ORDER BY id DESC LIMIT 1")
    .get() as QaSession | undefined;
}

export function startSession(id: number) {
  // Only one live session at a time
  db.prepare("UPDATE qa_sessions SET status = 'ended' WHERE status = 'live' AND id != ?").run(id);
  db.prepare("UPDATE qa_sessions SET status = 'live' WHERE id = ?").run(id);
}

export function endSession(id: number) {
  // Lock and reveal whatever was being presented so the ended view shows final results
  db.prepare("UPDATE qa_questions SET state = 'revealed' WHERE session_id = ? AND state = 'live'").run(id);
  db.prepare("UPDATE qa_sessions SET status = 'ended' WHERE id = ?").run(id);
}

/* ---------- questions ---------- */

export function listQuestions(sessionId: number): QaQuestion[] {
  return (
    db
      .prepare('SELECT * FROM qa_questions WHERE session_id = ? ORDER BY sort_order ASC, id ASC')
      .all(sessionId) as Record<string, unknown>[]
  ).map(parseQuestion);
}

export function getQuestion(id: number): QaQuestion | undefined {
  const row = db.prepare('SELECT * FROM qa_questions WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? parseQuestion(row) : undefined;
}

export function createQuestion(
  sessionId: number,
  type: QaQuestionType,
  prompt: string,
  options: string[],
  correctOption: number | null
): QaQuestion {
  const maxOrder = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM qa_questions WHERE session_id = ?')
      .get(sessionId) as { m: number }
  ).m;
  const info = db
    .prepare(
      'INSERT INTO qa_questions (session_id, type, prompt, options, correct_option, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(sessionId, type, prompt, JSON.stringify(options), correctOption, maxOrder + 1);
  return getQuestion(Number(info.lastInsertRowid))!;
}

export function updateQuestion(
  id: number,
  prompt: string,
  options: string[],
  correctOption: number | null
) {
  db.prepare('UPDATE qa_questions SET prompt = ?, options = ?, correct_option = ? WHERE id = ?').run(
    prompt,
    JSON.stringify(options),
    correctOption,
    id
  );
}

export function deleteQuestion(id: number) {
  db.prepare('DELETE FROM qa_upvotes WHERE answer_id IN (SELECT id FROM qa_answers WHERE question_id = ?)').run(id);
  db.prepare('DELETE FROM qa_answers WHERE question_id = ?').run(id);
  db.prepare("UPDATE qa_sessions SET active_question_id = NULL WHERE active_question_id = ?").run(id);
  db.prepare('DELETE FROM qa_questions WHERE id = ?').run(id);
}

export function moveQuestion(id: number, direction: 'up' | 'down') {
  const q = getQuestion(id);
  if (!q) return;
  const neighbor = db
    .prepare(
      `SELECT * FROM qa_questions WHERE session_id = ? AND sort_order ${direction === 'up' ? '<' : '>'} ?
       ORDER BY sort_order ${direction === 'up' ? 'DESC' : 'ASC'} LIMIT 1`
    )
    .get(q.session_id, q.sort_order) as { id: number; sort_order: number } | undefined;
  if (!neighbor) return;
  db.prepare('UPDATE qa_questions SET sort_order = ? WHERE id = ?').run(neighbor.sort_order, q.id);
  db.prepare('UPDATE qa_questions SET sort_order = ? WHERE id = ?').run(q.sort_order, neighbor.id);
}

/* ---------- presenting ---------- */

export function pushQuestionLive(questionId: number) {
  const q = getQuestion(questionId);
  if (!q) throw new Error('Question not found');
  const session = getQaSession(q.session_id);
  if (!session || session.status !== 'live') throw new Error('Session is not live');
  // The previously presented question is done — mark it revealed
  db.prepare(
    "UPDATE qa_questions SET state = 'revealed' WHERE session_id = ? AND state = 'live' AND id != ?"
  ).run(q.session_id, questionId);
  db.prepare("UPDATE qa_questions SET state = 'live' WHERE id = ?").run(questionId);
  db.prepare('UPDATE qa_sessions SET active_question_id = ? WHERE id = ?').run(
    questionId,
    q.session_id
  );
}

export function revealQuestion(questionId: number) {
  db.prepare("UPDATE qa_questions SET state = 'revealed' WHERE id = ?").run(questionId);
}

/* ---------- answers & upvotes ---------- */

export function upsertAnswer(
  questionId: number,
  userId: number,
  value: string,
  isAnonymous: boolean
) {
  db.prepare(
    `INSERT INTO qa_answers (question_id, user_id, value, is_anonymous) VALUES (?, ?, ?, ?)
     ON CONFLICT(question_id, user_id) DO UPDATE SET value = excluded.value, is_anonymous = excluded.is_anonymous`
  ).run(questionId, userId, value, isAnonymous ? 1 : 0);
}

export function toggleUpvote(answerId: number, userId: number): boolean {
  const existing = db
    .prepare('SELECT id FROM qa_upvotes WHERE answer_id = ? AND user_id = ?')
    .get(answerId, userId) as { id: number } | undefined;
  if (existing) {
    db.prepare('DELETE FROM qa_upvotes WHERE id = ?').run(existing.id);
    return false;
  }
  db.prepare('INSERT INTO qa_upvotes (answer_id, user_id) VALUES (?, ?)').run(answerId, userId);
  return true;
}

export function getMyAnswer(questionId: number, userId: number) {
  return db
    .prepare('SELECT value, is_anonymous FROM qa_answers WHERE question_id = ? AND user_id = ?')
    .get(questionId, userId) as { value: string; is_anonymous: number } | undefined;
}

export function getAnswerCount(questionId: number): number {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM qa_answers WHERE question_id = ?').get(questionId) as {
      n: number;
    }
  ).n;
}

/** Aggregated results for a question. `viewerId` marks the viewer's own answer/upvotes. */
export function getResults(question: QaQuestion, viewerId: number): QaResults {
  if (question.type === 'text') {
    const rows = db
      .prepare(
        `SELECT a.id, a.value, a.is_anonymous, a.user_id, u.name,
                (SELECT COUNT(*) FROM qa_upvotes v WHERE v.answer_id = a.id) AS upvotes,
                EXISTS(SELECT 1 FROM qa_upvotes v WHERE v.answer_id = a.id AND v.user_id = ?) AS upvoted_by_me
         FROM qa_answers a JOIN users u ON u.id = a.user_id
         WHERE a.question_id = ?
         ORDER BY upvotes DESC, a.created_at ASC`
      )
      .all(viewerId, question.id) as {
      id: number;
      value: string;
      is_anonymous: number;
      user_id: number;
      name: string;
      upvotes: number;
      upvoted_by_me: number;
    }[];
    const answers: QaTextAnswer[] = rows.map((r) => ({
      id: r.id,
      value: r.value,
      name: r.is_anonymous ? null : r.name,
      upvotes: r.upvotes,
      mine: r.user_id === viewerId,
      upvotedByMe: !!r.upvoted_by_me,
    }));
    return { answers };
  }

  if (question.type === 'rank') {
    // Borda count: an option ranked 1st of n earns n points, last earns 1
    const n = question.options.length;
    const points = new Array(n).fill(0);
    const rows = db
      .prepare('SELECT value FROM qa_answers WHERE question_id = ?')
      .all(question.id) as { value: string }[];
    for (const r of rows) {
      try {
        const order = JSON.parse(r.value) as number[];
        order.forEach((optionIdx, pos) => {
          if (optionIdx >= 0 && optionIdx < n) points[optionIdx] += n - pos;
        });
      } catch {
        // Skip malformed answers
      }
    }
    return { counts: points };
  }

  const size = question.type === 'mcq' ? question.options.length : 5;
  const counts = new Array(size).fill(0);
  const rows = db
    .prepare('SELECT value, COUNT(*) AS n FROM qa_answers WHERE question_id = ? GROUP BY value')
    .all(question.id) as { value: string; n: number }[];
  let total = 0;
  let weighted = 0;
  for (const r of rows) {
    const v = parseInt(r.value, 10);
    const idx = question.type === 'mcq' ? v : v - 1;
    if (idx >= 0 && idx < size) {
      counts[idx] = r.n;
      total += r.n;
      weighted += (question.type === 'rating' ? v : 0) * r.n;
    }
  }
  return {
    counts,
    average: question.type === 'rating' && total > 0 ? Math.round((weighted / total) * 10) / 10 : undefined,
  };
}

/** Quiz leaderboard: 1 point per correct MCQ answer. Names are always real (scores aren't secret). */
export function getLeaderboard(sessionId: number, limit = 10): QaLeaderboardRow[] {
  return db
    .prepare(
      `SELECT u.name, COUNT(*) AS score
       FROM qa_answers a
       JOIN qa_questions q ON q.id = a.question_id
       JOIN users u ON u.id = a.user_id
       WHERE q.session_id = ? AND q.type = 'mcq' AND q.correct_option IS NOT NULL
         AND CAST(a.value AS INTEGER) = q.correct_option
       GROUP BY a.user_id
       ORDER BY score DESC, u.name ASC
       LIMIT ?`
    )
    .all(sessionId, limit) as QaLeaderboardRow[];
}
