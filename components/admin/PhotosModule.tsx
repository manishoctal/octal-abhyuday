'use client';

import { useState } from 'react';
import { ScanFace, Users, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { Photo } from '@/lib/db';

function FaceMatchingPanel() {
  const [regStatus, setRegStatus]   = useState<string>('');
  const [tagStatus, setTagStatus]   = useState<string>('');
  const [regLoading, setRegLoading] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  async function registerAll() {
    setRegLoading(true); setRegStatus('');
    try {
      const res = await fetch('/api/faces/register-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setRegStatus(`Error: ${d.error}`); return; }
      setRegStatus(`Done — ${d.registered} registered, ${d.skipped} no face detected, ${d.failed} failed (of ${d.total} employees with photos)`);
    } finally { setRegLoading(false); }
  }

  async function tagAll() {
    setTagLoading(true); setTagStatus('');
    try {
      const res = await fetch('/api/faces/tag-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setTagStatus(`Error: ${d.error}`); return; }
      setTagStatus(`Done — ${d.tags_written} tags written across ${d.photos_processed} photos (${d.no_face} had no faces, ${d.failed} failed)`);
    } finally { setTagLoading(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace size={16} className="text-slate-400" />
        <h2 className="font-bold text-slate-900">Face Matching Setup</h2>
      </div>
      <p className="text-xs text-slate-500">
        Run these once to process existing employees and photos. New saves auto-register going forward.
      </p>

      <div className="space-y-2">
        {/* Step 1 */}
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Users size={12} /> Step 1 — Register all employee faces</p>
          <p className="text-[11px] text-slate-400">Downloads each employee&apos;s profile photo from S3 and saves their 512-dim face embedding.</p>
          <button onClick={registerAll} disabled={regLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            {regLoading ? <><Loader2 size={14} className="animate-spin" /> Registering…</> : 'Register All Employee Faces'}
          </button>
          {regStatus && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${regStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {regStatus.startsWith('Error') ? <AlertTriangle size={11} className="inline mr-1" /> : <CheckCircle2 size={11} className="inline mr-1" />}
              {regStatus}
            </p>
          )}
        </div>

        {/* Step 2 */}
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ScanFace size={12} /> Step 2 — Tag all approved photos</p>
          <p className="text-[11px] text-slate-400">Scans every approved gallery photo, detects faces, and links matched employees. Run after Step 1.</p>
          <button onClick={tagAll} disabled={tagLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
            {tagLoading ? <><Loader2 size={14} className="animate-spin" /> Tagging photos…</> : 'Tag All Approved Photos'}
          </button>
          {tagStatus && (
            <p className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${tagStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {tagStatus.startsWith('Error') ? <AlertTriangle size={11} className="inline mr-1" /> : <CheckCircle2 size={11} className="inline mr-1" />}
              {tagStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPhotosModule({ initial }: { initial: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);

  async function refresh() {
    const d = await fetch('/api/photos?all=1').then(r => r.json());
    setPhotos(d.photos ?? []);
  }

  async function moderate(id: number, action: 'approve' | 'reject') {
    await fetch('/api/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    await refresh();
  }

  const pending = photos.filter(p => !p.approved);
  const approved = photos.filter(p => p.approved);

  return (
    <div className="space-y-6">
      <FaceMatchingPanel />
      <div className="flex gap-4 text-sm font-semibold text-slate-500">
        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">{pending.length} pending</span>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">{approved.length} approved</span>
      </div>

      {pending.length > 0 && (
        <div>
          <h3 className="font-extrabold text-slate-700 mb-3">Pending Review</h3>
          <div className="grid grid-cols-2 gap-3">
            {pending.map(p => (
              <PhotoCard key={p.id} photo={p} onApprove={() => moderate(p.id, 'approve')} onReject={() => moderate(p.id, 'reject')} />
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <h3 className="font-extrabold text-slate-700 mb-3">Approved</h3>
          <div className="grid grid-cols-2 gap-3">
            {approved.map(p => (
              <div key={p.id} className="rounded-xl overflow-hidden border border-green-200 relative">
                <img src={p.url} alt="" className="w-full h-32 object-cover" />
                <div className="p-2">
                  <p className="text-xs font-semibold text-slate-600">{p.uploader_name}</p>
                  {p.caption && <p className="text-xs text-slate-400 truncate">{p.caption}</p>}
                </div>
                <button
                  onClick={() => moderate(p.id, 'reject')}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="text-5xl mb-3">📷</span>
          <p className="font-bold">No photos uploaded yet</p>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ photo, onApprove, onReject }: { photo: Photo; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden border border-yellow-200 bg-yellow-50">
      <img src={photo.url} alt="" className="w-full h-32 object-cover" />
      <div className="p-2">
        <p className="text-xs font-semibold text-slate-700">{photo.uploader_name}</p>
        {photo.caption && <p className="text-xs text-slate-400 truncate">{photo.caption}</p>}
      </div>
      <div className="flex border-t border-yellow-200">
        <button
          onClick={onApprove}
          className="flex-1 py-2 text-xs font-extrabold text-green-700 hover:bg-green-50 transition"
        >
          ✓ Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-2 text-xs font-extrabold text-red-600 hover:bg-red-50 transition border-l border-yellow-200"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}
