'use client';

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEventAlerts, type EventAlert } from './useEventAlerts';

const ICONS: Record<string, string> = {
  voting_live:       '🗳️',
  voting_paused:     '⏸️',
  voting_ended:      '🏁',
  results_announced: '🎉',
  qa_live:           '💬',
  poll_live:         '📊',
  ranking_live:      '🏅',
};

const COLORS: Record<string, string> = {
  voting_live:       'from-green-600 to-emerald-500',
  voting_paused:     'from-amber-500 to-orange-400',
  voting_ended:      'from-slate-700 to-slate-600',
  results_announced: 'from-pink-600 via-purple-600 to-orange-500',
  qa_live:           'from-blue-600 to-sky-500',
  poll_live:         'from-violet-600 to-purple-500',
  ranking_live:      'from-amber-600 to-yellow-500',
};

interface ToastItem extends EventAlert { id: number }

/** Mounts in the attendee layout — listens to server events, vibrates, shows a toast. */
export default function EventAlertToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const handleAlert = useCallback((alert: EventAlert) => {
    const id = ++nextId.current;
    setToasts(prev => [...prev.slice(-2), { ...alert, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  useEventAlerts(handleAlert);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`w-full pointer-events-auto bg-gradient-to-r ${COLORS[t.kind] ?? 'from-slate-700 to-slate-600'} rounded-2xl shadow-2xl overflow-hidden`}
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-2xl shrink-0">{ICONS[t.kind] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-sm leading-tight">{t.title}</p>
                {t.body && <p className="text-white/75 text-xs mt-0.5 truncate">{t.body}</p>}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <X size={13} className="text-white" />
              </button>
            </div>
            {/* Auto-dismiss progress bar */}
            <motion.div
              className="h-0.5 bg-white/30"
              initial={{ scaleX: 1, originX: 0 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
