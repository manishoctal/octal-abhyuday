'use client';

import { useState, useRef, useCallback } from 'react';
import { ScanFace, Users, CheckCircle2, Loader2, AlertTriangle, Trash2, X, ChevronLeft, ChevronRight, Upload, ImagePlus, Sparkles, TriangleAlert } from 'lucide-react';
import type { Photo } from '@/lib/db';

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
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-white font-semibold text-sm">{photo.uploader_name}</p>
          {photo.caption && <p className="text-white/50 text-xs">{photo.caption}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDelete(photo.id)}
            className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500 flex items-center justify-center transition-colors">
            <Trash2 size={16} className="text-red-400 hover:text-white" />
          </button>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-12 min-h-0" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? ''} className="max-h-full max-w-full object-contain rounded-xl" />
      </div>

      {/* Nav arrows */}
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <ChevronLeft size={22} className="text-white" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <ChevronRight size={22} className="text-white" />
        </button>
      )}

      {/* Counter */}
      <p className="text-center text-white/40 text-xs py-3 shrink-0">{index + 1} / {photos.length}</p>
    </div>
  );
}

/* ── Confirmation dialog ─────────────────────────────────── */
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
            <p className="text-sm text-slate-500 mt-1">This will permanently delete the photo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-2xl font-bold text-sm text-white bg-red-500">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Face Matching + Thumbnail panel ────────────────────── */
function FaceMatchingPanel() {
  const [regStatus,   setRegStatus]   = useState('');
  const [tagStatus,   setTagStatus]   = useState('');
  const [thumbStatus, setThumbStatus] = useState('');
  const [regLoading,  setRegLoading]  = useState(false);
  const [tagLoading,  setTagLoading]  = useState(false);
  const [thumbLoading,setThumbLoading]= useState(false);

  async function registerAll() {
    setRegLoading(true); setRegStatus('');
    try {
      const res = await fetch('/api/faces/register-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setRegStatus(`Error: ${d.error}`); return; }
      setRegStatus(`Done — ${d.registered} registered, ${d.skipped} no face, ${d.failed} failed (of ${d.total})`);
    } finally { setRegLoading(false); }
  }

  async function tagAll() {
    setTagLoading(true); setTagStatus('');
    try {
      const res = await fetch('/api/faces/tag-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setTagStatus(`Error: ${d.error}`); return; }
      setTagStatus(`Done — ${d.tags_written} tags across ${d.photos_processed} photos`);
    } finally { setTagLoading(false); }
  }

  async function generateThumbs() {
    setThumbLoading(true); setThumbStatus('');
    try {
      const res = await fetch('/api/admin/photos/thumbnails', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setThumbStatus(`Error: ${d.error}`); return; }
      setThumbStatus(d.queued > 0 ? `Generating thumbnails for ${d.queued} photos in background…` : 'All photos already have thumbnails.');
    } finally { setThumbLoading(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace size={16} className="text-slate-400" />
        <h2 className="font-bold text-slate-900">Processing</h2>
      </div>
      <p className="text-xs text-slate-500">Run once for existing photos. New uploads process automatically.</p>
      <div className="space-y-2">
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Sparkles size={12} /> Thumbnails — faster gallery loading</p>
          <button onClick={generateThumbs} disabled={thumbLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 bg-slate-700">
            {thumbLoading ? <><Loader2 size={14} className="animate-spin" />Queuing…</> : 'Generate Thumbnails for All Photos'}
          </button>
          {thumbStatus && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-lg flex items-center gap-1 ${thumbStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
              {thumbStatus.startsWith('Error') ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{thumbStatus}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Users size={12} /> One-time setup — index employee profile photos</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">Builds face embeddings from employee profile photos. Runs automatically for new employees — only needed once for existing ones.</p>
          <button onClick={registerAll} disabled={regLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            {regLoading ? <><Loader2 size={14} className="animate-spin" />Registering…</> : 'Index All Employee Faces'}
          </button>
          {regStatus && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-lg flex items-center gap-1 ${regStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {regStatus.startsWith('Error') ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{regStatus}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ScanFace size={12} /> Face matching — Step 2</p>
          <button onClick={tagAll} disabled={tagLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
            {tagLoading ? <><Loader2 size={14} className="animate-spin" />Tagging…</> : 'Tag All Approved Photos'}
          </button>
          {tagStatus && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-lg flex items-center gap-1 ${tagStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {tagStatus.startsWith('Error') ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{tagStatus}
            </p>
          )}
        </div>
      </div>
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

const CONCURRENCY = 6; // simultaneous S3 uploads
const BULK_THRESHOLD = 20; // switch to summary UI above this count

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

/* ── Admin Upload Panel ──────────────────────────────────── */
function AdminUploadPanel({ useS3, onDone }: { useS3: boolean; onDone: () => void }) {
  const inputRef                  = useRef<HTMLInputElement>(null);
  const [files, setFiles]         = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [finished, setFinished]   = useState(false);

  const isBulk = files.length > BULK_THRESHOLD;

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const next: FileState[] = Array.from(incoming).map(f => ({
      file: f, preview: URL.createObjectURL(f), status: 'pending', progress: 0,
    }));
    setFiles(prev => [...prev, ...next]);
    setFinished(false);
    setDoneCount(0);
    setErrorCount(0);
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

        // Register all successfully uploaded URLs in chunks of 100
        const successUrls = urls.filter(Boolean) as string[];
        for (let start = 0; start < successUrls.length; start += 100) {
          await fetch('/api/admin/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: successUrls.slice(start, start + 100) }),
          });
        }
      } else {
        // Local: send in batches of 20 (avoid giant FormData bodies)
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
    } finally {
      setUploading(false);
    }
  }

  const pendingCount   = files.filter(f => f.status === 'pending').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const overallPct     = files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-slate-400" />
        <h2 className="font-bold text-slate-900">Upload Photos</h2>
        <span className="ml-auto text-xs text-slate-400">Auto-approved · visible immediately</span>
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="w-full border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl py-8 flex flex-col items-center gap-2 transition-colors"
      >
        <ImagePlus size={28} className="text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Tap to select or drag & drop</p>
        <p className="text-xs text-slate-400">Up to 1,000 photos · JPG / PNG / WEBP</p>
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

      {/* ── Bulk summary view ── */}
      {files.length > 0 && isBulk && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800">{files.length} photos selected</span>
            {!uploading && <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-500">Clear all</button>}
          </div>
          {uploading && (
            <>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-2 bg-green-500 rounded-full transition-all duration-300" style={{ width: `${overallPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{doneCount} / {files.length} done{errorCount > 0 ? ` · ${errorCount} errors` : ''}</span>
                <span>{overallPct}%</span>
              </div>
            </>
          )}
          {errorCount > 0 && !uploading && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
              {errorCount} photo{errorCount > 1 ? 's' : ''} failed — rest uploaded successfully.
            </p>
          )}
        </div>
      )}

      {/* ── Per-file list (small batches only) ── */}
      {files.length > 0 && !isBulk && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {files.map((fs_, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fs_.preview} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{fs_.file.name}</p>
                {fs_.status === 'uploading' && (
                  <div className="h-1 bg-slate-200 rounded-full mt-1">
                    <div className="h-1 bg-green-500 rounded-full transition-all" style={{ width: `${fs_.progress}%` }} />
                  </div>
                )}
                {fs_.status === 'done'  && <p className="text-[10px] text-green-600 font-semibold">Uploaded</p>}
                {fs_.status === 'error' && <p className="text-[10px] text-red-500 font-semibold">{fs_.error}</p>}
              </div>
              {fs_.status === 'pending'   && <button onClick={() => { URL.revokeObjectURL(fs_.preview); setFiles(prev => prev.filter((_, j) => j !== i)); }} className="text-slate-400 hover:text-red-500 shrink-0"><X size={14} /></button>}
              {fs_.status === 'uploading' && <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />}
              {fs_.status === 'done'      && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {finished && (
        <p className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-xl flex items-center gap-1">
          <CheckCircle2 size={13} /> {doneCount} photo{doneCount !== 1 ? 's' : ''} published to gallery.
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
            ? <><Loader2 size={15} className="animate-spin" />{doneCount}/{files.length} uploaded…</>
            : <><Upload size={15} />Upload {files.length} photo{files.length !== 1 ? 's' : ''}</>}
        </button>
      )}
    </div>
  );
}

/* ── Main module ─────────────────────────────────────────── */
export default function AdminPhotosModule({ initial, useS3 }: { initial: Photo[]; useS3: boolean }) {
  const [photos, setPhotos]           = useState<Photo[]>(initial);
  const [tab, setTab]                 = useState<'visible' | 'hidden'>('visible');
  const [confirmId, setConfirmId]     = useState<number | null>(null);
  const [deleting, setDeleting]       = useState<number | null>(null);
  const [toggling, setToggling]       = useState<number | null>(null);
  const [lightbox, setLightbox]       = useState<{ list: Photo[]; idx: number } | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);

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
  const tabList  = tab === 'visible' ? visible : hidden;

  return (
    <div className="space-y-5">
      {confirmId !== null && (
        <ConfirmDialog
          onConfirm={() => doDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Delete-all confirmation modal */}
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
                  This will permanently delete all {photos.length} photos from the gallery and storage. Face tags will also be cleared. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Type <span className="font-black text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteAllInput}
                onChange={e => setDeleteAllInput(e.target.value)}
                placeholder="DELETE"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteAll(false); setDeleteAllInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >Cancel</button>
              <button
                onClick={doDeleteAll}
                disabled={deleteAllInput !== 'DELETE' || deletingAll}
                className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: '#DC2626' }}
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

      <AdminUploadPanel useS3={useS3} onDone={refresh} />

      <FaceMatchingPanel />

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-100 pb-0">
        {(['visible', 'hidden'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-colors ${tab === t ? 'bg-white border border-b-white border-slate-200 -mb-px text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
            {t === 'visible' ? `Visible (${visible.length})` : `Hidden (${hidden.length})`}
          </button>
        ))}
      </div>

      {tabList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <span className="text-4xl mb-3">{tab === 'visible' ? '📷' : '🙈'}</span>
          <p className="font-bold text-sm">{tab === 'visible' ? 'No photos yet' : 'No hidden photos'}</p>
        </div>
      )}

      {tabList.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {tabList.map((p, i) => (
            <div key={p.id} className="rounded-xl overflow-hidden border border-slate-200 bg-white relative">
              <button className="w-full" onClick={() => setLightbox({ list: tabList, idx: i })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail_url ?? p.url} alt="" className="w-full h-32 object-cover" loading="lazy" />
              </button>
              <div className="p-2">
                <p className="text-xs font-semibold text-slate-700 truncate">{p.uploader_name}</p>
                {p.caption && <p className="text-xs text-slate-400 truncate">{p.caption}</p>}
              </div>
              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => toggleVisibility(p.id, tab === 'visible')}
                  disabled={toggling === p.id}
                  className={`flex-1 py-2 text-xs font-extrabold transition flex items-center justify-center gap-1 disabled:opacity-40 ${tab === 'visible' ? 'text-slate-500 hover:bg-slate-50' : 'text-green-600 hover:bg-green-50'}`}
                >
                  {toggling === p.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : tab === 'visible' ? 'Hide' : 'Make Visible'}
                </button>
                <button
                  onClick={() => setConfirmId(p.id)}
                  disabled={deleting === p.id}
                  className="px-3 py-2 text-red-400 hover:bg-red-50 transition border-l border-slate-100 disabled:opacity-40"
                >
                  {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Danger Zone ── */}
      {photos.length > 0 && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-2">
          <p className="text-xs font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
            <TriangleAlert size={12} /> Danger Zone
          </p>
          <p className="text-xs text-red-500">Start fresh — removes all {photos.length} photos from gallery and storage, and clears all face tags.</p>
          <button
            onClick={() => setShowDeleteAll(true)}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-extrabold hover:bg-red-100 transition flex items-center justify-center gap-1.5"
          >
            <Trash2 size={13} /> Delete All Photos
          </button>
        </div>
      )}
    </div>
  );
}
