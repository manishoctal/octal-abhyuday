'use client';

import { useState, useRef } from 'react';
import { Camera, Download, Loader2, AlertTriangle, CheckCircle2, ImageOff, RefreshCw } from 'lucide-react';

interface Photo {
  id: number;
  url: string;
  caption: string | null;
  session_tag: string | null;
  uploaded_at: string;
}

type State = 'idle' | 'capturing' | 'searching' | 'done' | 'error';

export default function MyPhotosClient() {
  const [state, setState]       = useState<State>('idle');
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [errorMsg, setError]    = useState('');
  const [message, setMessage]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState('searching');
    setError('');
    setMessage('');

    const form = new FormData();
    form.append('selfie', file);

    try {
      const res = await fetch('/api/gallery/find-me', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Search failed.');
        setState('error');
        return;
      }

      setPhotos(data.photos ?? []);
      setMessage(data.message ?? '');
      setState('done');
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    }
  }

  function openCamera() {
    fileRef.current?.click();
  }

  function reset() {
    setState('idle');
    setPhotos([]);
    setError('');
    setMessage('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function downloadPhoto(url: string, id: number) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `photo-${id}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Hidden file input — capture selfie */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* Hero card */}
      <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-card bg-white">
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#FF7A00,#FF4F87)' }} />
        <div className="px-6 py-6 text-center space-y-3">
          <div className="text-4xl">🤳</div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg">Find Me in Gallery</h2>
            <p className="text-sm text-slate-400 mt-1">
              Take a selfie — we&apos;ll find all event photos you appear in using face matching.
            </p>
          </div>

          {state === 'idle' && (
            <button onClick={openCamera}
              className="w-full py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)', boxShadow: '0 8px 20px rgba(255,122,0,0.28)' }}>
              <Camera size={18} /> Take Selfie
            </button>
          )}

          {state === 'capturing' && (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm font-semibold py-3">
              <Loader2 size={16} className="animate-spin" /> Opening camera…
            </div>
          )}

          {state === 'searching' && (
            <div className="flex flex-col items-center gap-2 py-3">
              <Loader2 size={24} className="animate-spin text-brand-500" />
              <p className="text-sm font-semibold text-slate-600">Scanning gallery for your face…</p>
              <p className="text-xs text-slate-400">This takes 2–3 seconds</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2 text-left"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={reset}
                className="w-full py-3 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50">
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          )}

          {state === 'done' && (
            <div className="space-y-3">
              {photos.length > 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold"
                  style={{ background: '#DCFCE7', color: '#15803D' }}>
                  <CheckCircle2 size={16} />
                  Found {photos.length} photo{photos.length !== 1 ? 's' : ''} with you in them!
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-700 text-sm font-semibold">
                  <ImageOff size={15} />
                  {message || 'No photos found yet. Check back later!'}
                </div>
              )}
              <button onClick={reset}
                className="w-full py-3 rounded-2xl font-bold text-sm border border-slate-200 text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50">
                <Camera size={14} /> Search Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photo grid */}
      {state === 'done' && photos.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Photos</p>
          <div className="columns-2 gap-2 space-y-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative break-inside-avoid rounded-2xl overflow-hidden group border border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption ?? 'Event photo'} className="w-full object-cover" />

                {/* Overlay on hover/touch */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-end p-3">
                  <button
                    onClick={() => downloadPhoto(photo.url, photo.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl w-full justify-center"
                  >
                    <Download size={13} /> Download
                  </button>
                </div>

                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-3 pb-2 pt-6">
                    <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
