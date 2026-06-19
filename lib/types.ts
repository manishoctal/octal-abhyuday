export type Gender = 'male' | 'female';

export type VotingState = 'not_started' | 'live' | 'paused' | 'ended';

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface Candidate {
  id: number;
  name: string;
  /** null = auto-imported employee whose gender hasn't been set yet (excluded from ballots) */
  gender: Gender | null;
  image_url: string;
  email: string | null;
  is_finalist: number;
  created_at: string;
}

export interface CandidateWithVotes extends Candidate {
  vote_count: number;
}

export type VotingRound = 1 | 2;

export interface AppState {
  voting_state: VotingState;
  results_announced: boolean;
  event_name: string;
  /** 1 = qualifier (pick up to 10 per gender, counts hidden); 2 = grand finale */
  voting_round: VotingRound;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
}

/* ---------- Live Q&A (Phase 2) ---------- */

export type QaQuestionType = 'mcq' | 'text' | 'rating' | 'rank';
export type QaQuestionState = 'pending' | 'live' | 'revealed';
export type QaSessionStatus = 'draft' | 'live' | 'ended';
/** qna = multi-question presented session; poll/ranking = quick-launch single question */
export type QaSessionKind = 'qna' | 'poll' | 'ranking';

export interface QaSession {
  id: number;
  title: string;
  status: QaSessionStatus;
  kind: QaSessionKind;
  active_question_id: number | null;
  created_at: string;
}

export interface QaQuestion {
  id: number;
  session_id: number;
  type: QaQuestionType;
  prompt: string;
  options: string[];
  correct_option: number | null;
  state: QaQuestionState;
  sort_order: number;
}

export interface QaTextAnswer {
  id: number;
  value: string;
  /** null when posted anonymously */
  name: string | null;
  upvotes: number;
  mine: boolean;
  upvotedByMe: boolean;
}

export interface QaResults {
  /** answers per option index (mcq) or per star 1–5 (rating) */
  counts?: number[];
  average?: number;
  answers?: QaTextAnswer[];
}

export interface QaLeaderboardRow {
  name: string;
  score: number;
}
