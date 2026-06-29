'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Download, AlertTriangle, CheckCircle2, ImageOff,
  RefreshCw, ScanFace, Cpu, Search, Zap, X, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface Photo {
  id: number;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  session_tag: string | null;
  uploaded_at: string;
}

type Phase = 'idle' | 'detecting' | 'vectorising' | 'scanning' | 'matching' | 'done' | 'error';

const STEPS: { phase: Phase; icon: React.ElementType; label: string }[] = [
  { phase: 'detecting',   icon: ScanFace, label: 'Detecting your face'  },
  { phase: 'vectorising', icon: Cpu,      label: 'Building face vector' },
  { phase: 'scanning',    icon: Search,   label: 'Scanning gallery'     },
  { phase: 'matching',    icon: Zap,      label: 'Finding matches'      },
];

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/* ── Scan overlay (placed on the selfie preview) ─────────── */
function ScanOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Pulsing rings */}
      {[0.6, 0.8, 1].map((s, i) => (
        <motion.div key={i}
          className="absolute inset-0 rounded-2xl border-2 border-brand-400/40"
          animate={{ scale: [s, s + 0.06, s], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}
      {/* Corner brackets */}
      {[['top-2 left-2', 'border-t-2 border-l-2'], ['top-2 right-2', 'border-t-2 border-r-2'],
        ['bottom-2 left-2', 'border-b-2 border-l-2'], ['bottom-2 right-2', 'border-b-2 border-r-2']
      ].map(([pos, cls]) => (
        <div key={pos} className={`absolute ${pos} w-5 h-5 ${cls} border-green-400 rounded-sm`} />
      ))}
      {/* Scan line */}
      <motion.div
        className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
        animate={{ top: ['15%', '85%', '15%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

/* ── Animated steps ──────────────────────────────────────── */
function AISteps({ phase }: { phase: Phase }) {
  const cur = STEPS.findIndex(s => s.phase === phase);
  return (
    <div className="space-y-2.5 py-2">
      {STEPS.map((step, i) => {
        const done   = cur > i;
        const active = cur === i;
        const Icon   = step.icon;
        return (
          <motion.div key={step.phase}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: cur < i ? 0.25 : 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-2.5"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              done ? 'bg-green-500 text-white' : active ? 'text-white shadow-md' : 'bg-slate-100 text-slate-400'
            }`} style={active ? { background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' } : {}}>
              {done
                ? <CheckCircle2 size={14} />
                : active
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                      <Icon size={14} />
                    </motion.div>
                  : <Icon size={14} />}
            </div>
            <p className={`text-sm font-bold ${done ? 'text-green-600' : active ? 'text-slate-900' : 'text-slate-400'}`}>
              {step.label}
              {active && <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} className="ml-1">…</motion.span>}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function MyPhotosClient() {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [preview, setPreview]   = useState<string | null>(null);
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [errorMsg, setError]    = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowLeft') setLightbox(i => i !== null && i > 0 ? i - 1 : i);
      if (e.key === 'ArrowRight') setLightbox(i => i !== null && i < photos.length - 1 ? i + 1 : i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, photos.length]);

  async function handleFile(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setError('');
    setPhotos([]);

    setPhase('detecting');  await delay(900);
    setPhase('vectorising'); await delay(700);
    setPhase('scanning');

    const form = new FormData();
    form.append('selfie', file);

    let data: { ok?: boolean; error?: string; photos?: Photo[] };
    try {
      const res = await fetch('/api/gallery/find-me', { method: 'POST', body: form });
      data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Search failed'); setPhase('error'); return; }
    } catch {
      setError('Network error. Please try again.'); setPhase('error'); return;
    }

    await delay(500);
    setPhase('matching');
    await delay(450);
    setPhotos(data.photos ?? []);
    setPhase('done');
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPhase('idle'); setPreview(null); setPhotos([]); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function downloadAll() {
    const res = await fetch('/api/faces/search/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: photos.map(p => p.id) }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-event-photos.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const searching = ['detecting', 'vectorising', 'scanning', 'matching'].includes(phase);

  return (
    <div className="space-y-4 pb-24">
      <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* Main card */}
      <div className="rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm">
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#FF7A00,#FF4F87,#A855F7)' }} />

        <div className="px-5 py-5">
          <AnimatePresence mode="wait">

            {/* ── Idle ── */}
            {phase === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-4 py-2">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
                    <ScanFace size={36} className="text-white" />
                  </div>
                  <motion.div className="absolute -inset-1 rounded-2xl border-2 border-brand-400/30"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.1, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity }} />
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-lg">Find Me in Photos</h2>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    AI scans all {' '}
                    <span className="font-bold text-slate-600">event photos</span> to find the ones you appear in — instantly.
                  </p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)', boxShadow: '0 8px 24px rgba(255,122,0,0.3)' }}
                >
                  <Camera size={20} /> Take Selfie
                </button>
                <p className="text-xs text-slate-400">Your selfie is used only for matching — never stored</p>
              </motion.div>
            )}

            {/* ── Searching ── */}
            {searching && (
              <motion.div key="scanning" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Selfie preview with scan overlay */}
                <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-900 mx-auto"
                  style={{ maxWidth: 180 }}>
                  {preview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={preview} alt="" className="w-full h-full object-cover opacity-75" />
                  )}
                  <ScanOverlay />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <span className="text-[10px] font-bold text-green-400 bg-black/60 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      AI Scanning
                    </span>
                  </div>
                </div>
                <AISteps phase={phase} />
              </motion.div>
            )}

            {/* ── Error ── */}
            {phase === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 py-2">
                {preview && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={preview} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto opacity-60 grayscale" />
                )}
                <div className="flex items-start gap-3 bg-red-50 rounded-2xl px-4 py-3">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                </div>
                <button onClick={reset} className="w-full py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50">
                  <RefreshCw size={14} /> Try Again
                </button>
              </motion.div>
            )}

            {/* ── Done ── */}
            {phase === 'done' && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3">
                  {preview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={preview} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 border-2 border-brand-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    {photos.length > 0
                      ? <>
                          <p className="font-extrabold text-slate-900">Found {photos.length} photos! 🎉</p>
                          <p className="text-xs text-slate-500 mt-0.5">All event photos where you appear</p>
                        </>
                      : <>
                          <p className="font-extrabold text-slate-700">No matches yet</p>
                          <p className="text-xs text-slate-400 mt-0.5">Photos may not have been tagged yet</p>
                        </>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {photos.length > 0 && (
                    <button onClick={downloadAll}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
                      <Download size={14} /> Download All
                    </button>
                  )}
                  <button onClick={reset} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-50">
                    <Camera size={14} /> New Search
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Photo grid */}
      <AnimatePresence>
        {phase === 'done' && photos.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Photos ({photos.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo, i) => (
                <motion.button
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 280 }}
                  onClick={() => setLightbox(i)}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnail_url ?? photo.url} alt="" loading="lazy"
                    className="w-full h-full object-cover group-active:scale-105 transition-transform" />
                  {/* AI badge */}
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                    <CheckCircle2 size={11} className="text-white" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-2 px-2">
                    <p className="text-white text-[10px] font-semibold truncate">{photo.caption || 'Event photo'}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/95 flex flex-col"
            onClick={() => setLightbox(null)}
          >
            <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
              <p className="text-white/60 text-sm">{lightbox + 1} / {photos.length}</p>
              <button onClick={() => setLightbox(null)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <X size={18} className="text-white" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center px-6 min-h-0" onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[lightbox]?.url} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
            </div>
            <div className="flex items-center justify-center gap-3 py-4 shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => setLightbox(i => i !== null && i > 0 ? i - 1 : i)}
                disabled={lightbox === 0}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30 transition">
                <ChevronLeft size={22} className="text-white" />
              </button>
              <button onClick={async () => {
                  const p = photos[lightbox];
                  const res = await fetch(p.url);
                  const blob = await res.blob();
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = `event-photo-${p.id}.jpg`; a.click(); URL.revokeObjectURL(a.href);
                }}
                className="px-5 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold flex items-center gap-1.5 hover:bg-white/90 transition">
                <Download size={14} /> Save
              </button>
              <button onClick={() => setLightbox(i => i !== null && i < photos.length - 1 ? i + 1 : i)}
                disabled={lightbox === photos.length - 1}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30 transition">
                <ChevronRight size={22} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'done' && photos.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 text-slate-400 gap-3">
          <ImageOff size={40} strokeWidth={1} />
          <p className="text-sm font-semibold text-slate-500">No photos found yet</p>
          <p className="text-xs text-center max-w-xs text-slate-400">
            Make sure your profile photo is uploaded and the admin has run face tagging.
          </p>
        </motion.div>
      )}
    </div>
  );
}
