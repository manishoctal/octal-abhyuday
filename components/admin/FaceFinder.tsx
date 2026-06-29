'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, ScanFace, Cpu, Search, CheckCircle2, Download,
  X, RotateCcw, Zap, AlertCircle, ImageIcon,
} from 'lucide-react';

interface MatchedEmployee {
  employee_id: number;
  name: string;
  employee_code: string;
  profile_photo_url: string | null;
  similarity: number;
}

interface Photo {
  id: number;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  uploader_name: string;
}

interface SearchResult {
  faces_detected: number;
  total_indexed: number;
  matches: MatchedEmployee[];
  photos: Photo[];
}

type Phase = 'idle' | 'detecting' | 'vectorising' | 'scanning' | 'matching' | 'done' | 'error';

const STEPS: { phase: Phase; icon: React.ElementType; label: string; sublabel: string }[] = [
  { phase: 'detecting',   icon: ScanFace, label: 'Detecting faces',      sublabel: 'Locating facial landmarks…'        },
  { phase: 'vectorising', icon: Cpu,      label: 'Building face vectors', sublabel: 'Running neural embedding model…'   },
  { phase: 'scanning',    icon: Search,   label: 'Scanning gallery',      sublabel: 'Comparing against all photos…'     },
  { phase: 'matching',    icon: Zap,      label: 'Ranking matches',       sublabel: 'Sorting by confidence score…'      },
];

/* ── Animated scan line ─────────────────────────────────── */
function ScanOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      {/* Corner brackets */}
      {[['top-2 left-2', 'border-t-2 border-l-2'],
        ['top-2 right-2', 'border-t-2 border-r-2'],
        ['bottom-2 left-2', 'border-b-2 border-l-2'],
        ['bottom-2 right-2', 'border-b-2 border-r-2']].map(([pos, border]) => (
        <div key={pos} className={`absolute ${pos} w-6 h-6 ${border} border-green-400 rounded-sm`} />
      ))}
      {/* Moving scan line */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-80"
        animate={{ top: ['10%', '90%', '10%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      {/* Pulsing center dot */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-16 h-16 rounded-full border-2 border-green-400/40" />
      </motion.div>
    </div>
  );
}

/* ── Animated step list ─────────────────────────────────── */
function StepProgress({ phase, photoCount }: { phase: Phase; photoCount: number }) {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (phase !== 'scanning') { setCounter(0); return; }
    let n = 0;
    const iv = setInterval(() => {
      n = Math.min(n + Math.ceil(photoCount / 40), photoCount);
      setCounter(n);
      if (n >= photoCount) clearInterval(iv);
    }, 50);
    return () => clearInterval(iv);
  }, [phase, photoCount]);

  const currentIdx = STEPS.findIndex(s => s.phase === phase);

  return (
    <div className="space-y-3 py-4">
      {STEPS.map((step, i) => {
        const done    = currentIdx > i;
        const active  = currentIdx === i;
        const pending = currentIdx < i;
        const Icon    = step.icon;

        return (
          <motion.div
            key={step.phase}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: pending ? 0.3 : 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              done   ? 'bg-green-500 text-white' :
              active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
                       'bg-slate-100 text-slate-400'
            }`}>
              {done
                ? <CheckCircle2 size={16} />
                : active
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                      <Icon size={16} />
                    </motion.div>
                  : <Icon size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${done ? 'text-green-600' : active ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.label}
                {active && step.phase === 'scanning' && photoCount > 0 && (
                  <span className="ml-2 font-mono text-indigo-600">{counter}/{photoCount}</span>
                )}
              </p>
              {active && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-slate-500 mt-0.5"
                >
                  {step.sublabel}
                </motion.p>
              )}
            </div>
            {done && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-500">
                <CheckCircle2 size={14} />
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Match card ─────────────────────────────────────────── */
function MatchCard({ match }: { match: MatchedEmployee }) {
  const pct = Math.round(match.similarity * 100);
  const color = pct >= 85 ? 'text-green-600 bg-green-50' : pct >= 70 ? 'text-amber-600 bg-amber-50' : 'text-orange-600 bg-orange-50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3"
    >
      {match.profile_photo_url
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={match.profile_photo_url} alt={match.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-500 font-bold text-sm">
            {match.name[0]}
          </div>}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">{match.name}</p>
        <p className="text-xs text-slate-400">{match.employee_code}</p>
      </div>
      <div className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-full ${color}`}>
        {pct}% match
      </div>
    </motion.div>
  );
}

/* ── Main FaceFinder ─────────────────────────────────────── */
export default function FaceFinder({ onResults }: { onResults?: (photoIds: number[] | null) => void }) {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [preview, setPreview]       = useState<string | null>(null);
  const [result, setResult]         = useState<SearchResult | null>(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [downloading, setDownloading] = useState(false);
  const [lightbox, setLightbox]     = useState<number | null>(null);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [dragging, setDragging]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview(null);
    setResult(null);
    setErrorMsg('');
    setTotalPhotos(0);
    onResults?.(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [onResults]);

  async function runSearch(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg('');

    // Simulate multi-step progress
    setPhase('detecting');
    await delay(900);
    setPhase('vectorising');
    await delay(700);
    setPhase('scanning');

    const form = new FormData();
    form.append('photo', file);

    let data: SearchResult & { error?: string };
    try {
      const res = await fetch('/api/faces/search', { method: 'POST', body: form });
      data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? 'Search failed'); setPhase('error'); return; }
    } catch {
      setErrorMsg('Network error — check face service is running.');
      setPhase('error');
      return;
    }

    setTotalPhotos(data.total_indexed ?? 0);
    await delay(600); // let counter animation finish
    setPhase('matching');
    await delay(500);
    setResult(data);
    setPhase('done');
    onResults?.(data.photos.map(p => p.id));
  }

  function handleFile(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    runSearch(file);
  }

  async function downloadZip() {
    if (!result || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/faces/search/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: result.photos.map(p => p.id) }),
      });
      if (!res.ok) throw new Error('ZIP failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `face-match-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  const searching = ['detecting', 'vectorising', 'scanning', 'matching'].includes(phase);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
          <ScanFace size={18} className="text-white" />
        </div>
        <div>
          <p className="font-extrabold text-slate-900">AI Face Search</p>
          <p className="text-xs text-slate-500">Upload any photo — find all matching gallery images instantly</p>
        </div>
        {phase !== 'idle' && (
          <button onClick={reset} className="ml-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition">
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">

          {/* ── Idle: upload zone ── */}
          {phase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0] ?? null); }}
                className={`w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-all ${
                  dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                <motion.div
                  animate={{ y: dragging ? -4 : 0 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center"
                >
                  <ScanFace size={28} className="text-indigo-500" />
                </motion.div>
                <div className="text-center">
                  <p className="font-bold text-slate-700">{dragging ? 'Drop to search' : 'Upload a photo to search'}</p>
                  <p className="text-sm text-slate-400 mt-1">Group photos, selfies, event shots — any image with a face</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full font-semibold">
                  <Zap size={11} />
                  Powered by AI face recognition
                </div>
              </button>
            </motion.div>
          )}

          {/* ── Searching: photo preview + steps ── */}
          {(searching || phase === 'error') && (
            <motion.div key="searching" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid sm:grid-cols-[200px_1fr] gap-5"
            >
              {/* Photo with scan overlay */}
              <div className="relative w-full sm:w-48 h-48 rounded-2xl overflow-hidden bg-slate-900 shrink-0 mx-auto sm:mx-0">
                {preview && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={preview} alt="" className="w-full h-full object-cover opacity-70" />
                )}
                {searching && <ScanOverlay />}
                {phase === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/60">
                    <AlertCircle size={28} className="text-red-400" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                {searching && <StepProgress phase={phase} photoCount={totalPhotos} />}
                {phase === 'error' && (
                  <div className="space-y-3 py-4">
                    <p className="text-red-600 font-bold flex items-center gap-2">
                      <AlertCircle size={16} /> Search failed
                    </p>
                    <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>
                    <button onClick={reset} className="text-sm font-semibold text-indigo-600 hover:underline">
                      ← Try again
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Done: results ── */}
          {phase === 'done' && result && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Summary banner */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white flex items-center gap-4"
              >
                {preview && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={preview} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border-2 border-white/30" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-lg">
                    {result.photos.length === 0
                      ? 'No matching photos found'
                      : `${result.photos.length} photo${result.photos.length !== 1 ? 's' : ''} found!`}
                  </p>
                  <p className="text-white/70 text-sm mt-0.5">
                    {result.faces_detected} face{result.faces_detected !== 1 ? 's' : ''} detected ·{' '}
                    {result.matches.length} employee{result.matches.length !== 1 ? 's' : ''} matched ·{' '}
                    {result.total_indexed} faces in index
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {result.photos.length > 0 && (
                    <button
                      onClick={downloadZip}
                      disabled={downloading}
                      className="flex items-center gap-1.5 bg-white text-indigo-700 font-bold text-sm px-3 py-2 rounded-xl hover:bg-indigo-50 transition disabled:opacity-60"
                    >
                      <Download size={14} />
                      {downloading ? 'Zipping…' : `ZIP (${result.photos.length})`}
                    </button>
                  )}
                  <button onClick={reset} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition">
                    <RotateCcw size={14} />
                  </button>
                </div>
              </motion.div>

              {/* Matched employees */}
              {result.matches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Matched Employees</p>
                  {result.matches.map((m, i) => (
                    <motion.div key={m.employee_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                      <MatchCard match={m} />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Photo grid */}
              {result.photos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Matching Photos — click to enlarge
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-1.5">
                    {result.photos.map((p, i) => (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03, type: 'spring', stiffness: 300 }}
                        onClick={() => setLightbox(i)}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.thumbnail_url ?? p.url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        {/* AI verified badge */}
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <CheckCircle2 size={11} className="text-white" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <p className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-semibold truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.uploader_name}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {result.photos.length === 0 && (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-3">
                  <ImageIcon size={40} strokeWidth={1} />
                  <p className="text-sm font-semibold">No tagged photos yet</p>
                  <p className="text-xs text-center max-w-xs">
                    Run "Tag All Photos" in the Processing panel first so the AI can link faces to gallery images.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/95 flex flex-col"
            onClick={() => setLightbox(null)}
          >
            <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
              <p className="text-white font-semibold">{result.photos[lightbox]?.uploader_name}</p>
              <button onClick={() => setLightbox(null)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X size={18} className="text-white" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center px-10 min-h-0" onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.photos[lightbox]?.url} alt="" className="max-h-full max-w-full object-contain rounded-xl shadow-2xl" />
            </div>
            <div className="flex items-center justify-center gap-4 py-4 shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => setLightbox(i => i !== null && i > 0 ? i - 1 : i)}
                disabled={lightbox === 0}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold disabled:opacity-30 transition">
                ← Prev
              </button>
              <p className="text-white/40 text-sm">{lightbox + 1} / {result.photos.length}</p>
              <button onClick={() => setLightbox(i => i !== null && i < result.photos.length - 1 ? i + 1 : i)}
                disabled={lightbox === result.photos.length - 1}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold disabled:opacity-30 transition">
                Next →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
