'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

/**
 * Subscribes to the server's SSE stream and revalidates the given SWR keys
 * when something changes (vote cast, voting state, candidate list).
 * Events are batched (max one refetch per key per 750ms) so vote bursts from
 * hundreds of users don't multiply into request storms.
 * EventSource auto-reconnects on drops; SWR's slow fallback polling covers
 * any events missed while disconnected.
 */
export function useRealtime(keys: string[]) {
  const { mutate } = useSWRConfig();
  const joined = keys.join(',');

  useEffect(() => {
    const list = joined.split(',').filter(Boolean);
    const es = new EventSource('/api/stream');
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      pending = false;
      for (const key of list) mutate(key);
    };

    es.onmessage = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(flush, 750);
    };

    return () => {
      es.close();
      if (timer) clearTimeout(timer);
    };
  }, [joined, mutate]);
}
