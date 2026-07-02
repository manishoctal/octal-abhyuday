'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanFace, Users, CheckCircle2, Loader2, AlertTriangle, Trash2, X,
  ChevronLeft, ChevronRight, Upload, ImagePlus, Sparkles, TriangleAlert,
  Eye, EyeOff, ChevronDown, ChevronUp, FilterX,
} from 'lucide-react';
import type { Photo } from '@/lib/db';
import FaceFinder from './FaceFinder';

/* ── Lightbox ────────────────────────────────────────────── */
function Lightbox({ photos, index, onClose, onPrev, onNext, onDelete }: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (id: number) => void;
}) {
  const photo = photos[index];
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-white font-semibold">{photo.uploader_name}</p>
          {photo.caption && <p className="text-white/50 text-sm">{photo.caption}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDelete(photo.id)}
            className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500 flex items-center justify-center transition-colors group">
            <Trash2 size={15} className="text-red-400 group-hover:text-white" />
          </button>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-16 min-h-0" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? ''} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
      </div>

      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors backdrop-blur-sm">
          <ChevronLeft size={24} className="text-white" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors backdrop-blur-sm">
          <ChevronRight size={24} className="text-white" />
        </button>
      )}
      <p className="text-center text-white/30 text-xs py-3 shrink-0">{index + 1} / {photos.length}</p>
    </div>
  );
}

/* ── Confirm delete dialog ───────────────────────────────── */
function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Delete Photo?</p>
            <p className="text-sm text-slate-500 mt-1">This permanently removes the photo from the gallery.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-2xl font-bold text-sm text-white bg-red-500 hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ── Processing sidebar panel ────────────────────────────── */
interface ThumbStats { missing: number }
interface FaceRegStats { total_with_photo: number; registered: number }
interface FaceTagStats { approved_photos: number; photo_tags: number; untagged: number; failed: number }

function StatusPill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
      {children}
    </span>
  );
}

function ProcessingPanel({ onRefresh }: { onRefresh?: () => void }) {
  const [thumbStats,   setThumbStats]   = useState<ThumbStats | null>(null);
  const [regStats,     setRegStats]     = useState<FaceRegStats | null>(null);
  const [tagStats,     setTagStats]     = useState<FaceTagStats | null>(null);
  const [actionMsg,       setActionMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [regLoading,      setRegLoading]      = useState(false);
  const [tagLoading,      setTagLoading]      = useState(false);
  const [thumbLoading,    setThumbLoading]    = useState(false);
  const [pendingLoading,  setPendingLoading]  = useState(false);
  const [expanded,        setExpanded]        = useState(true);

  async function loadStats() {
    const [t, r, g] = await Promise.all([
      fetch('/api/admin/photos/thumbnails').then(r => r.ok ? r.json() : null),
      fetch('/api/faces/register-all').then(r => r.ok ? r.json() : null),
      fetch('/api/faces/tag-all').then(r => r.ok ? r.json() : null),
    ]);
    if (t) setThumbStats({ missing: t.missing });
    if (r) setRegStats(r);
    if (g) setTagStats(g);
  }

  useEffect(() => { loadStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function notify(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 5000);
  }

  async function generateThumbs() {
    setThumbLoading(true);
    try {
      const res = await fetch('/api/admin/photos/thumbnails', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { notify(`Error: ${d.error}`, false); return; }
      notify(d.queued > 0 ? `Generating ${d.queued} thumbnails in background…` : 'All thumbnails up to date.', true);
      setTimeout(loadStats, 3000);
    } finally { setThumbLoading(false); }
  }

  async function registerAll() {
    setRegLoading(true);
    try {
      const res = await fetch('/api/faces/register-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { notify(`Error: ${d.error}`, false); return; }
      notify(`Done — ${d.registered} indexed, ${d.skipped} no face, ${d.failed} failed`, true);
      await loadStats();
    } finally { setRegLoading(false); }
  }

  async function tagAll() {
    setTagLoading(true);
    try {
      const res = await fetch('/api/faces/tag-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { notify(`Error: ${d.error}`, false); return; }
      notify(`Done — ${d.tags_written} tags across ${d.photos_processed} photos`, true);
      await loadStats();
    } finally { setTagLoading(false); }
  }

  async function retagPending() {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/faces/tag-pending', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { notify(`Error: ${d.error}`, false); return; }
      const msg = d.processed === 0
        ? 'All photos already tagged.'
        : `Done — ${d.tagged} match${d.tagged !== 1 ? 'es' : ''} in ${d.processed} photo${d.processed !== 1 ? 's' : ''}${d.failed ? ` · ${d.failed} still failed` : ''}${d.lastError ? ` — ${d.lastError}` : ''}`;
      notify(msg, d.failed === 0);
      await Promise.all([loadStats(), onRefresh?.()]);
    } finally { setPendingLoading(false); }
  }

  const thumbOk   = thumbStats?.missing === 0;
  const regOk     = regStats != null && regStats.registered >= regStats.total_with_photo && regStats.total_with_photo > 0;
  const tagOk     = tagStats != null && tagStats.photo_tags > 0;
  const pendingOk = tagStats != null && (tagStats.untagged + tagStats.failed) === 0;
  const allOk     = thumbOk && regOk && tagOk && pendingOk;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <ScanFace size={15} className="text-slate-500" />
          <span className="font-bold text-slate-900 text-sm">Processing</span>
          {!allOk && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>
        {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400">Run once for existing photos. New uploads process automatically.</p>

          {actionMsg && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 ${actionMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {actionMsg.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{actionMsg.text}
            </p>
          )}

          {/* Step 1: Thumbnails */}
          <div className="rounded-xl border border-slate-100 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Thumbnails</span>
              </div>
              {thumbStats == null
                ? <span className="text-[11px] text-slate-400">…</span>
                : thumbOk
                  ? <StatusPill ok>All done</StatusPill>
                  : <StatusPill ok={false}>{thumbStats.missing} missing</StatusPill>}
            </div>
            <button
              onClick={generateThumbs}
              disabled={thumbLoading || thumbOk}
              className="w-full py-2 rounded-lg font-bold text-xs text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {thumbLoading ? <><Loader2 size={12} className="animate-spin" />Queuing…</> : `Generate${thumbStats?.missing ? ` (${thumbStats.missing})` : ''}`}
            </button>
          </div>

          {/* Step 2: Index faces */}
          <div className="rounded-xl border border-slate-100 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Index Faces</span>
              </div>
              {regStats == null
                ? <span className="text-[11px] text-slate-400">…</span>
                : regOk
                  ? <StatusPill ok>All {regStats.registered}</StatusPill>
                  : <StatusPill ok={false}>{regStats.registered}/{regStats.total_with_photo}</StatusPill>}
            </div>
            <p className="text-[11px] text-slate-400">Build embeddings from employee profile photos.</p>
            <button
              onClick={registerAll}
              disabled={regLoading}
              className="w-full py-2 rounded-lg font-bold text-xs text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {regLoading ? <><Loader2 size={12} className="animate-spin" />Indexing…</> : 'Index All'}
            </button>
          </div>

          {/* Step 3: Tag photos */}
          <div className="rounded-xl border border-slate-100 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ScanFace size={12} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Tag Photos</span>
              </div>
              {tagStats == null
                ? <span className="text-[11px] text-slate-400">…</span>
                : tagStats.approved_photos === 0
                  ? <StatusPill ok>No photos yet</StatusPill>
                  : tagOk && pendingOk
                    ? <StatusPill ok>{tagStats.photo_tags} tags</StatusPill>
                    : <StatusPill ok={false}>0 tagged</StatusPill>}
            </div>
            {/* Show big button only when tagging is actually needed */}
            {!(tagOk && pendingOk) && (
              <button
                onClick={tagAll}
                disabled={tagLoading}
                className="w-full py-2 rounded-lg font-bold text-xs text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}
              >
                {tagLoading ? <><Loader2 size={12} className="animate-spin" />Tagging…</> : 'Tag All Photos'}
              </button>
            )}
            {/* When all done — small secondary re-tag link */}
            {tagOk && pendingOk && tagStats != null && tagStats.approved_photos > 0 && (
              <button
                onClick={tagAll}
                disabled={tagLoading}
                className="w-full py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-1 disabled:opacity-40"
              >
                {tagLoading ? <><Loader2 size={10} className="animate-spin" />Re-tagging…</> : <><ScanFace size={10} />Re-tag All</>}
              </button>
            )}
          </div>

          {/* Step 4: Pending / failed photos */}
          {tagStats != null && (tagStats.untagged > 0 || tagStats.failed > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <span className="text-xs font-semibold text-amber-800">Needs Tagging</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {tagStats.untagged > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {tagStats.untagged} pending
                    </span>
                  )}
                  {tagStats.failed > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      {tagStats.failed} failed
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                These photos were uploaded but face tagging was skipped or failed. &ldquo;Find Me&rdquo; will miss them until re-tagged.
              </p>
              <button
                onClick={retagPending}
                disabled={pendingLoading}
                className="w-full py-2 rounded-lg font-bold text-xs text-white disabled:opacity-50 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 transition"
              >
                {pendingLoading
                  ? <><Loader2 size={12} className="animate-spin" />Re-tagging…</>
                  : <><ScanFace size={12} />Re-tag {tagStats.untagged + tagStats.failed} Photos</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── XHR upload with progress ────────────────────────────── */
function xhrUpload(url: string, data: File | FormData, method: 'PUT' | 'POST', contentType: string | null, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => xhr.status < 400 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open(method, url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(data);
  });
}

const CONCURRENCY    = 6;
const BULK_THRESHOLD = 20;

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';
type FileState  = { file: File; preview: string; status: FileStatus; progress: number; error?: string };

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, i: number) => Promise<void>) {
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    await worker(items[i], i);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

/* ── Upload panel ────────────────────────────────────────── */
function UploadPanel({ useS3, onDone }: { useS3: boolean; onDone: () => void }) {
  const inputRef                    = useRef<HTMLInputElement>(null);
  const [files, setFiles]           = useState<FileState[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [doneCount, setDoneCount]   = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [finished, setFinished]     = useState(false);
  const [dragging, setDragging]     = useState(false);

  const isBulk = files.length > BULK_THRESHOLD;

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const next: FileState[] = Array.from(incoming).map(f => ({
      file: f, preview: URL.createObjectURL(f), status: 'pending', progress: 0,
    }));
    setFiles(prev => [...prev, ...next]);
    setFinished(false); setDoneCount(0); setErrorCount(0);
  }, []);

  function clearAll() {
    setFiles(prev => { prev.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); }); return []; });
    setFinished(false); setDoneCount(0); setErrorCount(0);
  }

  function patch(idx: number, update: Partial<FileState>) {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, ...update } : f));
    if (update.status === 'done')  setDoneCount(c => c + 1);
    if (update.status === 'error') setErrorCount(c => c + 1);
  }

  async function upload() {
    if (!files.length || uploading) return;
    setUploading(true); setDoneCount(0); setErrorCount(0);

    try {
      if (useS3) {
        const urls: (string | null)[] = new Array(files.length).fill(null);

        await runPool(files, CONCURRENCY, async (fs_, i) => {
          patch(i, { status: 'uploading' });
          try {
            const presignRes = await fetch('/api/upload/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: fs_.file.name, contentType: fs_.file.type || 'image/jpeg', context: 'gallery' }),
            });
            if (!presignRes.ok) throw new Error('Presign failed');
            const { presignedUrl, publicUrl } = await presignRes.json();
            await xhrUpload(presignedUrl, fs_.file, 'PUT', fs_.file.type || 'image/jpeg', pct => patch(i, { progress: pct }));
            urls[i] = publicUrl;
            patch(i, { status: 'done', progress: 100 });
          } catch (e: unknown) {
            patch(i, { status: 'error', error: e instanceof Error ? e.message : 'Failed' });
          }
        });

        const successUrls = urls.filter(Boolean) as string[];
        for (let start = 0; start < successUrls.length; start += 100) {
          await fetch('/api/admin/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: successUrls.slice(start, start + 100) }),
          });
        }
      } else {
        const BATCH = 20;
        for (let start = 0; start < files.length; start += BATCH) {
          const batch = files.slice(start, start + BATCH);
          batch.forEach((_, j) => patch(start + j, { status: 'uploading' }));
          const fd = new FormData();
          batch.forEach(fs_ => fd.append('files', fs_.file));
          try {
            await xhrUpload('/api/admin/photos', fd, 'POST', null, pct => {
              batch.forEach((_, j) => patch(start + j, { progress: pct }));
            });
            batch.forEach((_, j) => patch(start + j, { status: 'done', progress: 100 }));
          } catch (e: unknown) {
            batch.forEach((_, j) => patch(start + j, { status: 'error', error: e instanceof Error ? e.message : 'Failed' }));
          }
        }
      }

      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setFinished(true);
      onDone();
    } finally { setUploading(false); }
  }

  const pendingCount   = files.filter(f => f.status === 'pending').length;
  const overallPct     = files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Upload size={15} className="text-slate-400" />
        <span className="font-bold text-slate-900 text-sm">Upload Photos</span>
        <span className="ml-auto text-[11px] text-slate-400">Auto-approved</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Drop zone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={`w-full border-2 border-dashed rounded-2xl py-7 flex flex-col items-center gap-2 transition-all ${
            dragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <ImagePlus size={26} className={dragging ? 'text-brand-500' : 'text-slate-300'} />
          <p className="text-sm font-semibold text-slate-500">
            {dragging ? 'Drop to upload' : 'Click or drag & drop'}
          </p>
          <p className="text-xs text-slate-400">Up to 1,000 photos · JPG / PNG / WEBP</p>
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        {/* Bulk summary */}
        {files.length > 0 && isBulk && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-800">{files.length} photos selected</span>
              {!uploading && <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-500">Clear</button>}
            </div>
            {uploading && (
              <>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{doneCount}/{files.length} done{errorCount > 0 ? ` · ${errorCount} errors` : ''}</span>
                  <span>{overallPct}%</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Per-file list (small batches) */}
        {files.length > 0 && !isBulk && (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {files.map((fs_, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fs_.preview} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{fs_.file.name}</p>
                  {fs_.status === 'uploading' && (
                    <div className="h-1 bg-slate-200 rounded-full mt-1">
                      <div className="h-1 bg-green-500 rounded-full transition-all" style={{ width: `${fs_.progress}%` }} />
                    </div>
                  )}
                  {fs_.status === 'done'  && <p className="text-[10px] text-green-600 font-semibold">Uploaded ✓</p>}
                  {fs_.status === 'error' && <p className="text-[10px] text-red-500 font-semibold">{fs_.error}</p>}
                </div>
                {fs_.status === 'pending' && (
                  <button onClick={() => { URL.revokeObjectURL(fs_.preview); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                    className="text-slate-400 hover:text-red-500 shrink-0"><X size={13} /></button>
                )}
                {fs_.status === 'uploading' && <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />}
                {fs_.status === 'done'      && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
              </div>
            ))}
          </div>
        )}

        {finished && (
          <p className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 size={13} /> {doneCount} photo{doneCount !== 1 ? 's' : ''} published to gallery
          </p>
        )}

        {files.length > 0 && !finished && (
          <button
            onClick={upload}
            disabled={uploading || pendingCount === 0}
            className="w-full py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#0F172A,#334155)' }}
          >
            {uploading
              ? <><Loader2 size={14} className="animate-spin" />{doneCount}/{files.length} uploaded…</>
              : <><Upload size={14} />Upload {files.length} photo{files.length !== 1 ? 's' : ''}</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Photo grid card ─────────────────────────────────────── */
function PhotoCard({ photo, onClick, onToggle, onDelete, isHidden, toggling, deleting, onRetag, retagging }: {
  photo: Photo;
  onClick: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isHidden: boolean;
  toggling: boolean;
  deleting: boolean;
  onRetag: () => void;
  retagging: boolean;
}) {
  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer">
      <button className="absolute inset-0 w-full h-full" onClick={onClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnail_url ?? photo.url}
          alt={photo.caption ?? ''}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </button>

      {/* Top-right actions (visible on hover) */}
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          disabled={toggling}
          title={isHidden ? 'Make visible' : 'Hide photo'}
          className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition disabled:opacity-50"
        >
          {toggling
            ? <Loader2 size={13} className="animate-spin text-white" />
            : isHidden ? <Eye size={13} className="text-white" /> : <EyeOff size={13} className="text-white" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          title="Delete photo"
          className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500 transition disabled:opacity-50"
        >
          {deleting
            ? <Loader2 size={13} className="animate-spin text-white" />
            : <Trash2 size={13} className="text-white" />}
        </button>
      </div>

      {/* Bottom gradient + uploader name (on hover) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-white text-[11px] font-semibold truncate">{photo.uploader_name}</p>
        {photo.caption && <p className="text-white/60 text-[10px] truncate">{photo.caption}</p>}
      </div>

      {/* Hidden badge */}
      {isHidden && (
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
          <EyeOff size={10} className="text-white/70" />
          <span className="text-[10px] text-white/70 font-semibold">Hidden</span>
        </div>
      )}

      {/* Pending tag badge */}
      {!isHidden && (photo.face_tag_status === null || photo.face_tag_status === 'failed') && (
        <button
          onClick={e => { e.stopPropagation(); onRetag(); }}
          disabled={retagging}
          title={photo.face_tag_status === 'failed' ? 'Face tagging failed — click to retry' : 'Not yet face-tagged — click to tag'}
          className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm transition disabled:opacity-50"
          style={{ background: photo.face_tag_status === 'failed' ? 'rgba(239,68,68,0.85)' : 'rgba(245,158,11,0.85)' }}
        >
          {retagging
            ? <Loader2 size={9} className="animate-spin text-white" />
            : <ScanFace size={9} className="text-white" />}
          <span className="text-[9px] text-white font-bold">
            {photo.face_tag_status === 'failed' ? 'Failed' : 'Pending'}
          </span>
        </button>
      )}
    </div>
  );
}

/* ── Main module ─────────────────────────────────────────── */
export default function AdminPhotosModule({ initial, useS3 }: { initial: Photo[]; useS3: boolean }) {
  const [photos, setPhotos]               = useState<Photo[]>(initial);
  const [tab, setTab]                     = useState<'visible' | 'hidden'>('visible');
  const [confirmId, setConfirmId]         = useState<number | null>(null);
  const [deleting, setDeleting]           = useState<number | null>(null);
  const [toggling, setToggling]           = useState<number | null>(null);
  const [lightbox, setLightbox]           = useState<{ list: Photo[]; idx: number } | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState('');
  const [deletingAll, setDeletingAll]     = useState(false);
  const [faceFilterIds, setFaceFilterIds] = useState<number[] | null>(null);
  const [retagging,     setRetagging]     = useState<number | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'failed-tag' | 'no-thumb'>('all');

  async function refresh() {
    const d = await fetch('/api/photos?all=1').then(r => r.json());
    setPhotos(d.photos ?? []);
  }

  async function toggleVisibility(id: number, currentlyVisible: boolean) {
    setToggling(id);
    await fetch('/api/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: currentlyVisible ? 'disable' : 'enable' }),
    });
    setToggling(null);
    await refresh();
  }

  async function doDelete(id: number) {
    setConfirmId(null);
    setLightbox(null);
    setDeleting(id);
    await fetch('/api/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeleting(null);
    await refresh();
  }

  async function retagPhoto(id: number) {
    setRetagging(id);
    try {
      await fetch('/api/faces/tag-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: id }),
      });
      await refresh();
    } finally { setRetagging(null); }
  }

  async function doDeleteAll() {
    setDeletingAll(true);
    await fetch('/api/admin/photos/all', { method: 'DELETE' });
    setDeletingAll(false);
    setShowDeleteAll(false);
    setDeleteAllInput('');
    await refresh();
  }

  const visible  = photos.filter(p => p.approved !== -1);
  const hidden   = photos.filter(p => p.approved === -1);
  const baseList = tab === 'visible' ? visible : hidden;
  const faceFiltered = faceFilterIds ? baseList.filter(p => faceFilterIds.includes(p.id)) : baseList;
  const tabList = statusFilter === 'failed-tag'
    ? faceFiltered.filter(p => p.face_tag_status === 'failed')
    : statusFilter === 'no-thumb'
      ? faceFiltered.filter(p => !p.thumbnail_url)
      : faceFiltered;

  const failedCount  = baseList.filter(p => p.face_tag_status === 'failed').length;
  const noThumbCount = baseList.filter(p => !p.thumbnail_url).length;

  return (
    <>
      {confirmId !== null && (
        <ConfirmDialog onConfirm={() => doDelete(confirmId)} onCancel={() => setConfirmId(null)} />
      )}

      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl p-2 bg-red-100 shrink-0">
                <TriangleAlert size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900">Delete All Photos?</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Permanently deletes all {photos.length} photos and clears all face tags. Cannot be undone.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Type <span className="font-black text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text" value={deleteAllInput}
                onChange={e => setDeleteAllInput(e.target.value)}
                placeholder="DELETE"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteAll(false); setDeleteAllInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={doDeleteAll}
                disabled={deleteAllInput !== 'DELETE' || deletingAll}
                className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-40 flex items-center justify-center gap-1.5 bg-red-600"
              >
                {deletingAll ? <><Loader2 size={13} className="animate-spin" />Deleting…</> : <><Trash2 size={13} />Delete All</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <Lightbox
          photos={lightbox.list}
          index={lightbox.idx}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(l => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l)}
          onNext={() => setLightbox(l => l && l.idx < l.list.length - 1 ? { ...l, idx: l.idx + 1 } : l)}
          onDelete={id => setConfirmId(id)}
        />
      )}

      {/* ── 2-column layout ─────────────────────────────── */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">

        {/* ── Left sidebar ──────────────────────────────── */}
        <div className="space-y-4">
          <UploadPanel useS3={useS3} onDone={refresh} />
          <ProcessingPanel onRefresh={refresh} />

          {/* Danger zone */}
          {photos.length > 0 && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-2">
              <p className="text-[11px] font-extrabold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                <TriangleAlert size={11} /> Danger Zone
              </p>
              <p className="text-[11px] text-red-400 leading-relaxed">
                Start fresh — removes all {photos.length} photos and clears face tags.
              </p>
              <button
                onClick={() => setShowDeleteAll(true)}
                className="w-full py-2 rounded-xl border border-red-200 text-red-600 text-xs font-extrabold hover:bg-red-100 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} /> Delete All Photos
              </button>
            </div>
          )}
        </div>

        {/* ── Right: AI search + gallery ────────────────── */}
        <div className="space-y-4">
          {/* AI Face Search (full width, above gallery) */}
          <FaceFinder onResults={ids => { setFaceFilterIds(ids); if (ids) { setTab('visible'); setStatusFilter('all'); } }} />

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
              {(['visible', 'hidden'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setFaceFilterIds(null); setStatusFilter('all'); }}
                  className={`px-4 py-2 text-sm font-bold transition-colors ${
                    tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {t === 'visible' ? `Visible` : `Hidden`}
                  <span className={`ml-1.5 text-[11px] font-black rounded-full px-1.5 py-0.5 ${
                    tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t === 'visible' ? visible.length : hidden.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Status filter chips */}
            {failedCount > 0 && (
              <button
                onClick={() => setStatusFilter(f => f === 'failed-tag' ? 'all' : 'failed-tag')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  statusFilter === 'failed-tag'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                }`}
              >
                <AlertTriangle size={12} />
                {failedCount} Tag Failed
              </button>
            )}
            {noThumbCount > 0 && (
              <button
                onClick={() => setStatusFilter(f => f === 'no-thumb' ? 'all' : 'no-thumb')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  statusFilter === 'no-thumb'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Sparkles size={12} />
                {noThumbCount} No Thumb
              </button>
            )}

            {/* Active face filter banner */}
            {faceFilterIds && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5">
                <ScanFace size={13} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-indigo-700">
                  AI filter: {tabList.length} match{tabList.length !== 1 ? 'es' : ''} in gallery
                </span>
                <button
                  onClick={() => setFaceFilterIds(null)}
                  className="ml-1 text-indigo-400 hover:text-indigo-700 transition"
                  title="Clear filter"
                >
                  <FilterX size={13} />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400 ml-auto">Click photo to view · hover for actions</p>
          </div>

          {/* Empty state */}
          {tabList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-100">
              {statusFilter === 'failed-tag' ? (
                <>
                  <span className="text-5xl mb-4">✅</span>
                  <p className="font-bold text-slate-600">No failed tags</p>
                  <p className="text-sm mt-1">All photos tagged successfully</p>
                  <button onClick={() => setStatusFilter('all')} className="mt-4 text-sm font-semibold text-red-600 hover:underline flex items-center gap-1">
                    <FilterX size={13} /> Clear filter
                  </button>
                </>
              ) : statusFilter === 'no-thumb' ? (
                <>
                  <span className="text-5xl mb-4">✅</span>
                  <p className="font-bold text-slate-600">All thumbnails generated</p>
                  <p className="text-sm mt-1">Every photo has a thumbnail</p>
                  <button onClick={() => setStatusFilter('all')} className="mt-4 text-sm font-semibold text-amber-600 hover:underline flex items-center gap-1">
                    <FilterX size={13} /> Clear filter
                  </button>
                </>
              ) : faceFilterIds ? (
                <>
                  <span className="text-5xl mb-4">🔍</span>
                  <p className="font-bold text-slate-600">No gallery matches found</p>
                  <p className="text-sm mt-1">Run "Tag All Photos" if this is unexpected, or the person may not appear in this gallery</p>
                  <button onClick={() => setFaceFilterIds(null)} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                    <FilterX size={13} /> Clear filter
                  </button>
                </>
              ) : (
                <>
                  <span className="text-5xl mb-4">{tab === 'visible' ? '📷' : '🙈'}</span>
                  <p className="font-bold text-slate-600">{tab === 'visible' ? 'No photos yet' : 'No hidden photos'}</p>
                  <p className="text-sm mt-1">{tab === 'visible' ? 'Upload photos using the panel on the left' : 'Hidden photos appear here'}</p>
                </>
              )}
            </div>
          )}

          {/* Google Photos-style grid */}
          {tabList.length > 0 && (
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5">
              {tabList.map((p, i) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  isHidden={tab === 'hidden'}
                  toggling={toggling === p.id}
                  deleting={deleting === p.id}
                  retagging={retagging === p.id}
                  onClick={() => setLightbox({ list: tabList, idx: i })}
                  onToggle={() => toggleVisibility(p.id, tab === 'visible')}
                  onDelete={() => setConfirmId(p.id)}
                  onRetag={() => retagPhoto(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
