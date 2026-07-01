'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ImagePlus, X, Plus, CheckCircle2, Camera, ChevronLeft, ChevronRight, CloudUpload, AlertCircle, ScanFace, Loader2, Download, Trash2 } from 'lucide-react';
import { useRealtime } from './useRealtime';
import type { Photo } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const MAX_FILES = 10;
const MAX_SIZE  = 5 * 1024 * 1024;

type Filter = 'all' | 'mine';

interface LocalFile { file: File; preview: string }

type FileStatus = 'waiting' | 'uploading' | 'done' | 'error';

interface FileProgress {
  name:     string;
  preview:  string;
  progress: number;
  status:   FileStatus;
}

/* ── date helpers ─────────────────────────────────────────── */
function dayLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diff = now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0);
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

interface PhotoGroup { label: string; photos: Photo[] }

function groupByDay(photos: Photo[]): PhotoGroup[] {
  const map = new Map<string, PhotoGroup>();
  for (const p of photos) {
    const key   = p.uploaded_at ? dayKey(p.uploaded_at) : 'unknown';
    const label = p.uploaded_at ? dayLabel(p.uploaded_at) : 'Earlier';
    if (!map.has(key)) map.set(key, { label, photos: [] });
    map.get(key)!.photos.push(p);
  }
  return Array.from(map.values());
}

/* ── XHR upload helper (tracks progress) ─────────────────── */
function xhrUpload(
  url: string,
  data: File | FormData,
  method: 'PUT' | 'POST',
  contentType: string | null,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open(method, url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(data);
  });
}

/* ── status dot — only shown when admin has hidden the photo ── */
function StatusDot({ approved }: { approved: number }) {
  if (approved !== -1) return null;
  return (
    <div className="absolute inset-0 flex items-end justify-start p-1.5 pointer-events-none">
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700/80 text-white backdrop-blur-sm">Hidden</span>
    </div>
  );
}

/* ── lightbox ─────────────────────────────────────────────── */
function Lightbox({
  photos, index, onClose, userId, onDelete,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  userId: number;
  onDelete: (id: number) => void;
}) {
  const [cur, setCur]                     = useState(index);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zoom, setZoom]                   = useState(1);
  const [pan, setPan]                     = useState({ x: 0, y: 0 });
  const p = photos[cur];

  function resetZoom() { setZoom(1); setPan({ x: 0, y: 0 }); }

  useEffect(() => { setConfirmDelete(false); resetZoom(); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (zoom > 1) { if (e.key === 'Escape') resetZoom(); return; }
      if (e.key === 'ArrowLeft')  setCur(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCur(i => Math.min(photos.length - 1, i + 1));
      if (e.key === 'Escape')     onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch state refs
  const touchX   = useRef<number | null>(null);
  const pinchRef = useRef<number | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const lastTap  = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchRef.current = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      return;
    }
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    touchX.current = x;
    panStart.current = { x, y, px: pan.x, py: pan.y };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current !== null) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const ratio = dist / pinchRef.current;
      setZoom(z => { const nz = Math.min(5, Math.max(1, z * ratio)); if (nz <= 1) setPan({ x: 0, y: 0 }); return nz; });
      pinchRef.current = dist;
      return;
    }
    if (e.touches.length === 1 && zoom > 1 && panStart.current) {
      setPan({
        x: panStart.current.px + e.touches[0].clientX - panStart.current.x,
        y: panStart.current.py + e.touches[0].clientY - panStart.current.y,
      });
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    pinchRef.current = null;
    panStart.current = null;
    if (zoom > 1) { touchX.current = null; return; }

    // Double-tap → zoom 2.5×
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoom(2.5);
      lastTap.current = 0;
      touchX.current  = null;
      return;
    }
    lastTap.current = now;

    // Swipe navigation
    if (touchX.current !== null) {
      const dx = e.changedTouches[0].clientX - touchX.current;
      if (dx < -50) setCur(i => Math.min(photos.length - 1, i + 1));
      if (dx >  50) setCur(i => Math.max(0, i - 1));
      touchX.current = null;
    }
  }

  function onWheel(e: React.WheelEvent) {
    const scale = e.deltaY > 0 ? 0.85 : 1.15;
    setZoom(z => { const nz = Math.min(5, Math.max(1, z * scale)); if (nz <= 1) setPan({ x: 0, y: 0 }); return nz; });
  }

  async function download() {
    try {
      const res = await fetch(p.url);
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `photo-${p.id}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
  }

  const isOwn = p.uploader_id === userId;
  const zoomed = zoom > 1;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      style={{ touchAction: 'none' }}
    >
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)', paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span className="text-white/70 text-sm font-medium">{cur + 1} / {photos.length}</span>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 active:scale-90 transition-transform">
          <X size={18} strokeWidth={2} color="white" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={p.id}
            src={p.url}
            alt={p.caption ?? ''}
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: zoomed ? 'none' : 'transform 0.2s ease',
              cursor: zoomed ? 'grab' : 'default',
            }}
          />
        </div>

        {/* Zoom level badge — tap to reset */}
        {zoomed && (
          <button
            onClick={resetZoom}
            className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {Math.round(zoom * 10) / 10}× · tap to reset
          </button>
        )}

        {/* Prev / next — hidden when zoomed */}
        {!zoomed && cur > 0 && (
          <button onClick={() => setCur(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 active:scale-90 transition-transform">
            <ChevronLeft size={20} strokeWidth={2} color="white" />
          </button>
        )}
        {!zoomed && cur < photos.length - 1 && (
          <button onClick={() => setCur(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 active:scale-90 transition-transform">
            <ChevronRight size={20} strokeWidth={2} color="white" />
          </button>
        )}

        {/* Dot indicator */}
        {photos.length > 1 && !zoomed && (
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none">
            {photos.slice(Math.max(0, cur - 3), Math.min(photos.length, cur + 4)).map((_, i) => {
              const actual = Math.max(0, cur - 3) + i;
              return <span key={actual} className="rounded-full transition-all duration-200"
                style={{ width: actual === cur ? 16 : 5, height: 5, background: actual === cur ? 'white' : 'rgba(255,255,255,0.4)' }} />;
            })}
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div
        className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3"
        style={{ background: 'rgba(0,0,0,0.85)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] leading-snug">{p.uploader_name}</p>
          {p.caption && <p className="text-white/60 text-sm mt-0.5 truncate">{p.caption}</p>}
          {p.uploaded_at && (
            <p className="text-white/35 text-xs mt-0.5">
              {new Date(p.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(p.uploaded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwn && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(254,146,52,0.2)', color: '#FE9234', border: '1px solid rgba(254,146,52,0.4)' }}>
              Your photo
            </span>
          )}
          {isOwn && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)' }}
              title="Delete photo"
            >
              <Trash2 size={16} color="#fca5a5" />
            </button>
          )}
          <button
            onClick={download}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/25 transition"
            title="Download photo"
          >
            <Download size={18} color="white" />
          </button>
        </div>
      </div>

      {/* Delete confirm sheet */}
      {confirmDelete && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-4"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Delete this photo?</p>
                <p className="text-sm text-slate-500 mt-1">It will be permanently removed from the gallery.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600">
                Cancel
              </button>
              <button onClick={() => { setConfirmDelete(false); onDelete(p.id); onClose(); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-red-500">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── progress bar ─────────────────────────────────────────── */
function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden bg-slate-100" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${value}%`,
          background: value >= 100 ? '#22C55E' : 'linear-gradient(90deg, #FE9234, #FFAD5E)',
        }}
      />
    </div>
  );
}

/* ── upload sheet ─────────────────────────────────────────── */
function UploadSheet({ onClose, onDone, useS3 }: { onClose: () => void; onDone: () => void; useS3: boolean }) {
  const [files, setFiles]                   = useState<LocalFile[]>([]);
  const [error, setError]                   = useState('');
  const [done, setDone]                     = useState(false);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const uploading                           = fileProgresses.length > 0 && !done;
  const inputRef                            = useRef<HTMLInputElement>(null);
  const cameraRef                           = useRef<HTMLInputElement>(null);

  function pickFiles(raw: FileList | null) {
    if (!raw) return;
    setError('');
    const arr = Array.from(raw);
    if (files.length + arr.length > MAX_FILES) { setError(`Max ${MAX_FILES} photos allowed`); return; }
    const oversized = arr.find(f => f.size > MAX_SIZE);
    if (oversized) { setError(`"${oversized.name}" is over 5 MB`); return; }
    setFiles(prev => [...prev, ...arr.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
  }

  function remove(i: number) {
    setFiles(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i); });
  }

  function patchProg(index: number, patch: Partial<FileProgress>) {
    setFileProgresses(prev => prev.map((fp, i) => i === index ? { ...fp, ...patch } : fp));
  }

  async function upload() {
    if (!files.length) return;
    setError('');

    setFileProgresses(files.map(lf => ({ name: lf.file.name, preview: lf.preview, progress: 0, status: 'waiting' })));

    try {
      if (useS3) {
        /* ── S3: presign each file → XHR PUT → register CloudFront URLs ── */
        const uploadedUrls: string[] = new Array(files.length);

        await Promise.all(files.map(async (lf, i) => {
          patchProg(i, { status: 'uploading' });

          const presignRes = await fetch('/api/upload/presign', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ filename: lf.file.name, contentType: lf.file.type || 'image/jpeg', context: 'gallery' }),
          });
          if (!presignRes.ok) throw new Error('Failed to get upload URL');
          const { presignedUrl, publicUrl } = await presignRes.json();

          await xhrUpload(presignedUrl, lf.file, 'PUT', lf.file.type || 'image/jpeg', pct => {
            patchProg(i, { progress: pct });
          });

          uploadedUrls[i] = publicUrl;
          patchProg(i, { status: 'done', progress: 100 });
        }));

        const res = await fetch('/api/photos', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ urls: uploadedUrls }),
        });
        if (!res.ok) throw new Error('Failed to save photos');
      } else {
        /* ── Local: single FormData POST via XHR ── */
        setFileProgresses(prev => prev.map(fp => ({ ...fp, status: 'uploading' })));
        const fd = new FormData();
        files.forEach(lf => fd.append('files', lf.file));
        await xhrUpload('/api/photos', fd, 'POST', null, pct => {
          setFileProgresses(prev => prev.map(fp => ({ ...fp, progress: pct })));
        });
        setFileProgresses(prev => prev.map(fp => ({ ...fp, status: 'done', progress: 100 })));
      }

      files.forEach(lf => URL.revokeObjectURL(lf.preview));
      setDone(true);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setFileProgresses([]);
    }
  }

  const overallProgress = fileProgresses.length
    ? Math.round(fileProgresses.reduce((s, fp) => s + fp.progress, 0) / fileProgresses.length)
    : 0;
  const doneCount = fileProgresses.filter(fp => fp.status === 'done').length;

  /* ── Success ── */
  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#DCFCE7' }}>
            <CheckCircle2 size={40} strokeWidth={1.8} color="#16A34A" />
          </div>
          <p className="font-bold text-slate-900 text-2xl">Uploaded!</p>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            Your photos are now live in the gallery.
          </p>
          <button onClick={onClose} className="btn-primary mt-7">Back to Gallery</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={!uploading ? onClose : undefined}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-24 pt-2 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900 text-xl">
                {uploading ? 'Uploading…' : 'Add Photos'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {uploading
                  ? `${doneCount} of ${files.length} done`
                  : `Up to ${MAX_FILES} photos · 5 MB each${useS3 ? ' · Cloud' : ''}`
                }
              </p>
            </div>
            {!uploading && (
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors">
                <X size={16} strokeWidth={2} className="text-slate-500" />
              </button>
            )}
            {uploading && useS3 && (
              <div className="w-9 h-9 flex items-center justify-center">
                <CloudUpload size={20} strokeWidth={1.6} style={{ color: '#FE9234' }} />
              </div>
            )}
          </div>

          {/* ── Uploading: progress UI ── */}
          {uploading && (
            <div className="space-y-5">
              {/* Overall bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Overall progress</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: overallProgress >= 100 ? '#22C55E' : '#FE9234' }}>
                    {overallProgress}%
                  </span>
                </div>
                <ProgressBar value={overallProgress} height={8} />
              </div>

              {/* Per-file rows */}
              <div className="space-y-3">
                {fileProgresses.map((fp, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fp.preview} alt="" className="w-full h-full object-cover" />
                      {fp.status === 'done' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/40">
                          <CheckCircle2 size={14} strokeWidth={2.5} color="white" />
                        </div>
                      )}
                      {fp.status === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/40">
                          <AlertCircle size={14} strokeWidth={2.5} color="white" />
                        </div>
                      )}
                    </div>

                    {/* Name + bar */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-[12px] font-medium text-slate-700 truncate leading-none">{fp.name}</p>
                      {fp.status === 'waiting'
                        ? <p className="text-[11px] text-slate-300 leading-none">Waiting…</p>
                        : fp.status === 'error'
                        ? <p className="text-[11px] text-red-500 leading-none font-medium">Failed</p>
                        : <ProgressBar value={fp.progress} height={5} />
                      }
                    </div>

                    {/* Right label */}
                    <span className={`text-[11px] font-bold shrink-0 w-8 text-right tabular-nums ${
                      fp.status === 'done'    ? 'text-green-500' :
                      fp.status === 'error'   ? 'text-red-500'   :
                      fp.status === 'waiting' ? 'text-slate-200'  :
                      'text-slate-400'
                    }`}>
                      {fp.status === 'done' ? '✓' : fp.status === 'error' ? '✕' : fp.status === 'waiting' ? '—' : `${fp.progress}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pre-upload: drop zone ── */}
          {!uploading && files.length === 0 && (
            <div className="space-y-3">
              {/* Camera capture button */}
              <button onClick={() => cameraRef.current?.click()}
                className="w-full border-2 rounded-3xl py-5 flex items-center justify-center gap-3 active:scale-[0.99] transition-transform"
                style={{ borderColor: '#FE9234', background: '#FFF4E8' }}>
                <Camera size={22} strokeWidth={1.8} color="#FE9234" />
                <span className="font-semibold text-[15px]" style={{ color: '#FE9234' }}>Take a Photo</span>
              </button>

              {/* Gallery picker */}
              <button onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed rounded-3xl py-10 flex flex-col items-center gap-3 active:scale-[0.99] transition-transform"
                style={{ borderColor: '#CBD5E1' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <ImagePlus size={32} strokeWidth={1.6} className="text-slate-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700 text-[15px]">Choose from Gallery</p>
                <p className="text-xs text-slate-400 mt-1">JPEG, PNG, HEIC · max 5 MB each</p>
              </div>
              <span className="px-5 py-2 rounded-full text-sm font-semibold text-white" style={{ background: '#FE9234' }}>
                Browse Photos
              </span>
            </button>
            </div>
          )}

          {/* ── Pre-upload: file grid ── */}
          {!uploading && files.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {files.map((lf, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lf.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => remove(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                      <X size={9} strokeWidth={2.5} color="white" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button onClick={() => inputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                    <Plus size={18} strokeWidth={2} className="text-slate-400" />
                    <span className="text-[9px] text-slate-400 font-medium">Add more</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">{files.length}/{MAX_FILES} selected · tap ✕ to remove</p>
            </>
          )}

          <input ref={inputRef} type="file" accept="image/*,.jfif,.jpe,.jif,.jfi" multiple className="hidden"
            onChange={e => pickFiles(e.target.files)} />
          {/* Camera capture — opens native camera directly */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => pickFiles(e.target.files)} />

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-red-50">
              <AlertCircle size={14} strokeWidth={2} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!uploading && (
            <button onClick={upload} disabled={!files.length} className="btn-primary">
              {files.length
                ? `Upload ${files.length} photo${files.length > 1 ? 's' : ''}${useS3 ? ' to Cloud' : ''}`
                : 'Select photos first'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────── */
export default function GalleryClient({
  initialApproved, initialMine, userId, useS3,
}: { initialApproved: Photo[]; initialMine: Photo[]; userId: number; useS3: boolean }) {
  const router = useRouter();
  const [filter, setFilter]               = useState<Filter>('all');
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showUpload, setShowUpload]       = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId]           = useState<number | null>(null);

  const { data: allData,  mutate: mutateAll  } = useSWR('/api/photos',        fetcher, { fallbackData: { photos: initialApproved }, refreshInterval: 20000 });
  const { data: mineData, mutate: mutateMine } = useSWR('/api/photos?mine=1', fetcher, { fallbackData: { photos: initialMine },    refreshInterval: 20000 });
  useRealtime(['/api/photos']);

  const approved: Photo[] = allData?.photos  ?? initialApproved;
  const mine:     Photo[] = mineData?.photos ?? initialMine;
  const photos            = filter === 'mine' ? mine : approved;
  const onUploadDone = useCallback(() => { mutateAll(); mutateMine(); }, [mutateAll, mutateMine]);
  const groups = groupByDay(photos);

  async function deletePhoto(id: number) {
    setConfirmDeleteId(null);
    setDeletingId(id);
    await fetch('/api/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    mutateMine();
    mutateAll();
  }

  function openLightbox(groupPhotos: Photo[], idx: number) {
    setLightboxPhotos(groupPhotos);
    setLightboxIndex(idx);
  }

  return (
    <>
      {/* ── Delete confirmation ── */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <X size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Delete Photo?</p>
                <p className="text-sm text-slate-500 mt-1">This will permanently remove it from the gallery and S3. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600">
                Cancel
              </button>
              <button onClick={() => deletePhoto(confirmDeleteId)}
                className="flex-1 py-2.5 rounded-2xl font-bold text-sm text-white bg-red-500">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-14 z-30 bg-white border-b border-slate-100 -mx-4 px-4 py-2 flex gap-2">
        {(['all', 'mine'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={filter === f ? { background: '#0F172A', color: 'white' } : { background: '#F1F5F9', color: '#64748B' }}>
            {f === 'all' ? 'Photos' : 'My Uploads'}
            {f === 'mine' && mine.length > 0 && <span className="ml-1.5 text-[10px] font-bold opacity-70">{mine.length}</span>}
          </button>
        ))}
        <button onClick={() => router.push('/my-photos')}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)', color: 'white' }}>
          <ScanFace size={14} /> Find Me
        </button>
      </div>


      {/* ── Empty state ── */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
            <Camera size={34} strokeWidth={1.4} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 text-base">
            {filter === 'mine' ? 'No photos uploaded yet' : 'No photos yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filter === 'mine' ? 'Tap + to share a moment' : 'Be the first to share a moment'}
          </p>
        </div>
      )}

      {/* ── Photo grid — edge-to-edge, date grouped ── */}
      {groups.length > 0 && (
        <div className="-mx-4 mt-3 pb-24">
          {groups.map(group => (
            <div key={group.label}>
              <div className="px-4 py-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-800">{group.label}</p>
                <p className="text-[11px] text-slate-400">{group.photos.length} photo{group.photos.length > 1 ? 's' : ''}</p>
              </div>
              <div className="grid grid-cols-3 gap-[2px]">
                {group.photos.map((p, i) => (
                  <button key={p.id} onClick={() => openLightbox(group.photos, i)}
                    className="relative aspect-square overflow-hidden bg-slate-100 active:opacity-80 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnail_url ?? p.url} alt={p.caption ?? ''} className="w-full h-full object-cover" loading="lazy"
                      style={p.approved === -1 ? { filter: 'brightness(0.5) grayscale(0.5)' } : undefined} />
                    <StatusDot approved={p.approved} />
                    {/* Delete button — visible for own photos in any filter */}
                    {p.uploader_id === userId && (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                        disabled={deletingId === p.id}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-40"
                      >
                        {deletingId === p.id
                          ? <Loader2 size={13} color="white" className="animate-spin" />
                          : <X size={13} color="white" strokeWidth={2.5} />}
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={() => setShowUpload(true)}
        className="fixed right-5 bottom-20 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: '#FE9234' }} aria-label="Add photos">
        <Camera size={24} strokeWidth={1.8} color="white" />
      </button>

      {lightboxPhotos && (
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
          userId={userId}
          onDelete={id => { setLightboxPhotos(null); deletePhoto(id); }}
        />
      )}

      {showUpload && (
        <UploadSheet onClose={() => setShowUpload(false)} onDone={onUploadDone} useS3={useS3} />
      )}
    </>
  );
}
