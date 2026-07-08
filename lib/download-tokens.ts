/**
 * In-memory short-lived download tokens for native Capacitor ZIP downloads.
 *
 * Flow: client POSTs photoIds → gets a token → opens
 * /api/photos/zip/download/[token] in the system browser (_system) →
 * server consumes the token, generates ZIP, streams it back.
 * System browser handles the download natively (no blob/anchor tricks needed).
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TokenEntry {
  photoIds: number[];
  expiresAt: number;
}

const store = new Map<string, TokenEntry>();

function purgeExpired() {
  const now = Date.now();
  store.forEach((v, k) => { if (v.expiresAt < now) store.delete(k); });
}

export function createToken(photoIds: number[]): string {
  purgeExpired();
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  store.set(token, { photoIds, expiresAt: Date.now() + TTL_MS });
  return token;
}

/** Consumes (single-use) the token. Returns null if expired/missing. */
export function consumeToken(token: string): number[] | null {
  const entry = store.get(token);
  store.delete(token); // always delete, expired or not
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.photoIds;
}
