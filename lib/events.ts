import { EventEmitter } from 'events';

export type UpdateType = 'vote' | 'state' | 'candidates' | 'qa';

export type AlertKind =
  | 'voting_live'
  | 'voting_paused'
  | 'voting_ended'
  | 'results_announced'
  | 'qa_live'
  | 'poll_live'
  | 'ranking_live';

export interface BroadcastEvent {
  type: UpdateType;
  at: number;
  alert?: AlertKind;
  alertTitle?: string;
  alertBody?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __octalVoteEmitter: EventEmitter | undefined;
}

// Survives Next.js dev hot-reloads, shared by all route handlers in the process
export const emitter: EventEmitter = globalThis.__octalVoteEmitter ?? new EventEmitter();
emitter.setMaxListeners(0);
globalThis.__octalVoteEmitter = emitter;

export function broadcast(type: UpdateType, alert?: { kind: AlertKind; title: string; body: string }) {
  const event: BroadcastEvent = { type, at: Date.now() };
  if (alert) {
    event.alert = alert.kind;
    event.alertTitle = alert.title;
    event.alertBody = alert.body;
  }
  emitter.emit('update', event);
}
