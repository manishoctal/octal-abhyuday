'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { BroadcastEvent } from '@/lib/events';

export interface EventAlert {
  title: string;
  body: string;
  kind: string;
}

/** Vibration patterns (ms: vibrate, pause, vibrate…) */
const VIBRATE: Record<string, number[]> = {
  voting_live:       [200, 100, 200, 100, 300],
  voting_paused:     [100, 50, 100],
  voting_ended:      [300, 100, 300],
  results_announced: [200, 100, 200, 100, 200, 100, 400],
  qa_live:           [150, 80, 150],
  poll_live:         [150, 80, 150],
  ranking_live:      [150, 80, 150],
};

/**
 * Opens a private SSE connection and fires `onAlert` with vibration
 * whenever a key event (voting live, results announced, Q&A live, etc.) is broadcast.
 * Designed to be mounted once in the attendee layout.
 */
export function useEventAlerts(onAlert: (alert: EventAlert) => void) {
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const vibrate = useCallback((pattern: number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream');

    es.onmessage = (e) => {
      let event: BroadcastEvent;
      try { event = JSON.parse(e.data); } catch { return; }

      if (!event.alert || !event.alertTitle) return;

      vibrate(VIBRATE[event.alert] ?? [200, 100, 200]);

      onAlertRef.current({
        kind:  event.alert,
        title: event.alertTitle,
        body:  event.alertBody ?? '',
      });
    };

    return () => es.close();
  }, [vibrate]);
}
