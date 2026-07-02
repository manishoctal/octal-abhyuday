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
  employee_code: string | null;
  is_finalist: number;
  created_at: string;
}

export interface CandidateWithVotes extends Candidate {
  vote_count: number;
}

export type VotingRound = number;

export interface AppState {
  voting_state: VotingState;
  results_announced: boolean;
  event_name: string;
  voting_round: VotingRound;
  /** Admin-configurable total number of rounds; last round is the Grand Finale */
  total_rounds: number;
  /** When true, employees can browse the candidate list before voting opens */
  candidates_preview: boolean;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  employee_code?: string;
  isAdmin: boolean;
}

/* ---------- Phase 1: Event platform ---------- */

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  department: string | null;
  profile_photo_url: string | null;
}

export type ScheduleSessionType = 'session' | 'meal' | 'break' | 'activity' | 'ceremony';

export interface ScheduleSession {
  id: number;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  speaker: string | null;
  type: ScheduleSessionType;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface EventInfoItem {
  id: number;
  section: string;
  title: string;
  body: string;
  maps_url: string | null;
  sort_order: number;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  checked_in_at: string;
  name: string;
  email: string;
  department: string | null;
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
