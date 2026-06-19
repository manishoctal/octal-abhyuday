import { EventEmitter } from 'events';

export type UpdateType = 'vote' | 'state' | 'candidates' | 'qa';

declare global {
  // eslint-disable-next-line no-var
  var __octalVoteEmitter: EventEmitter | undefined;
}

// Survives Next.js dev hot-reloads, shared by all route handlers in the process
export const emitter: EventEmitter = globalThis.__octalVoteEmitter ?? new EventEmitter();
emitter.setMaxListeners(0);
globalThis.__octalVoteEmitter = emitter;

export function broadcast(type: UpdateType) {
  emitter.emit('update', { type, at: Date.now() });
}
