'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { ImagePlus, X, Plus, CheckCircle2, Camera, ChevronLeft, ChevronRight, Clock, Info, CloudUpload, AlertCircle } from 'lucide-react';
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

/* ── status dot overlay ───────────────────────────────────── */
function StatusDot({ approved }: { approved: number }) {
  if (approved === 1) return null;
  return (
    <div className="absolute inset-0 flex items-end justify-start p-1.5 pointer-events-none">
      {approved === -1
        ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/90 text-white backdrop-blur-sm">Rejected</span>
        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/90 text-amber-900 backdrop-blur-sm">Pending</span>
      }
    </div>
  );
}

/* ── lightbox ─────────────────────────────────────────────── */
function Lightbox({ photos, index, onClose }: { photos: Photo[]; index: number; onClose: () => void }) {
  const [cur, setCur]           = useState(index);
  const [showInfo, setShowInfo] = useState(false);
  const p = photos[cur];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  setCur(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCur(i => Math.min(photos.length - 1, i + 1));
      if (e.key === 'Escape')     onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -50) setCur(i => Math.min(photos.length - 1, i + 1));
    if (dx >  50) setCur(i => Math.max(0, i - 1));
    touchX.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-4 pb-8"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:scale-90 transition-transform">
          <X size={18} strokeWidth={2} color="white" />
        </button>
        <span className="text-white/70 text-sm font-medium">{cur + 1} / {photos.length}</span>
        <button onClick={() => setShowInfo(v => !v)} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:scale-90 transition-transform">
          <Info size={16} strokeWidth={2} color="white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={p.id} src={p.url} alt={p.caption ?? ''} className="max-h-full max-w-full object-contain" draggable={false} />
      </div>

      {cur > 0 && (
        <button onClick={() => setCur(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform">
          <ChevronLeft size={20} strokeWidth={2} color="white" />
        </button>
      )}
      {cur < photos.length - 1 && (
        <button onClick={() => setCur(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform">
          <ChevronRight size={20} strokeWidth={2} color="white" />
        </button>
      )}

      <div className="absolute bottom-0 inset-x-0 px-5 pt-10 pb-8 transition-all duration-300"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', opacity: showInfo ? 1 : 0, pointerEvents: showInfo ? 'auto' : 'none' }}>
        <p className="text-white font-semibold text-[15px]">{p.uploader_name}</p>
        {p.caption && <p className="text-white/70 text-sm mt-0.5">{p.caption}</p>}
        {p.uploaded_at && (
          <p className="text-white/40 text-xs mt-1">
            {new Date(p.uploaded_at).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {photos.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1 pointer-events-none">
          {photos.slice(Math.max(0, cur - 3), Math.min(photos.length, cur + 4)).map((_, i) => {
            const actual = Math.max(0, cur - 3) + i;
            return <span key={actual} className="rounded-full transition-all duration-200"
              style={{ width: actual === cur ? 16 : 5, height: 5, background: actual === cur ? 'white' : 'rgba(255,255,255,0.4)' }} />;
          })}
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
            Your photos are pending admin approval and will appear in the gallery shortly.
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
            <button onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-3xl py-12 flex flex-col items-center gap-3 active:scale-[0.99] transition-transform"
              style={{ borderColor: '#FE9234' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#FFF4E8' }}>
                <ImagePlus size={32} strokeWidth={1.6} color="#FE9234" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800 text-[15px]">Tap to select photos</p>
                <p className="text-xs text-slate-400 mt-1">JPEG, PNG, HEIC · max 5 MB each</p>
              </div>
              <span className="px-5 py-2 rounded-full text-sm font-semibold text-white" style={{ background: '#FE9234' }}>
                Choose Photos
              </span>
            </button>
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
  const [filter, setFilter]               = useState<Filter>('all');
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showUpload, setShowUpload]       = useState(false);

  const { data: allData,  mutate: mutateAll  } = useSWR('/api/photos',        fetcher, { fallbackData: { photos: initialApproved }, refreshInterval: 20000 });
  const { data: mineData, mutate: mutateMine } = useSWR('/api/photos?mine=1', fetcher, { fallbackData: { photos: initialMine },    refreshInterval: 20000 });
  useRealtime(['/api/photos']);

  const approved: Photo[] = allData?.photos  ?? initialApproved;
  const mine:     Photo[] = mineData?.photos ?? initialMine;
  const photos            = filter === 'mine' ? mine : approved;
  const pendingCount      = mine.filter(p => p.approved === 0).length;
  const onUploadDone      = useCallback(() => { mutateAll(); mutateMine(); }, [mutateAll, mutateMine]);
  const groups            = groupByDay(photos);

  function openLightbox(groupPhotos: Photo[], idx: number) {
    setLightboxPhotos(groupPhotos);
    setLightboxIndex(idx);
  }

  return (
    <>
      {/* ── Sticky filter bar ── */}
      <div className="sticky top-14 z-30 bg-white border-b border-slate-100 -mx-4 px-4 py-2 flex gap-2">
        {(['all', 'mine'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={filter === f ? { background: '#0F172A', color: 'white' } : { background: '#F1F5F9', color: '#64748B' }}>
            {f === 'all' ? 'Photos' : 'My Photos'}
            {f === 'mine' && mine.length > 0 && <span className="ml-1.5 text-[10px] font-bold opacity-70">{mine.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Pending notice ── */}
      {filter === 'mine' && pendingCount > 0 && (
        <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>
          <Clock size={13} strokeWidth={2} />
          {pendingCount} photo{pendingCount > 1 ? 's' : ''} awaiting admin approval
        </div>
      )}

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
                    <img src={p.url} alt={p.caption ?? ''} className="w-full h-full object-cover" loading="lazy"
                      style={p.approved !== 1 ? { filter: 'brightness(0.65)' } : undefined} />
                    {filter === 'mine' && <StatusDot approved={p.approved} />}
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
        <Lightbox photos={lightboxPhotos} index={lightboxIndex} onClose={() => setLightboxPhotos(null)} />
      )}

      {showUpload && (
        <UploadSheet onClose={() => setShowUpload(false)} onDone={onUploadDone} useS3={useS3} />
      )}
    </>
  );
}
