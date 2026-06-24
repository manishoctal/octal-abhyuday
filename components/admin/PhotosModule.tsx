'use client';

import { useState } from 'react';
import type { Photo } from '@/lib/db';

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
