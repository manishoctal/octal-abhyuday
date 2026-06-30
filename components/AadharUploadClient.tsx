'use client';

import { useState, useRef } from 'react';
import { Upload, Eye, X, CheckCircle2, Loader2, CreditCard } from 'lucide-react';
import Image from 'next/image';

interface AadharCard { front_url: string | null; back_url: string | null; uploaded_at: string }
interface Props { initial: AadharCard | null; useS3: boolean }

type Side = 'front' | 'back';

interface SlotState {
  url: string | null;
  preview: string | null; // local object URL for instant preview
  uploading: boolean;
  err: string;
}

export default function AadharUploadClient({ initial, useS3 }: Props) {
  const [slots, setSlots] = useState<Record<Side, SlotState>>({
    front: { url: initial?.front_url ?? null, preview: null, uploading: false, err: '' },
    back:  { url: initial?.back_url  ?? null, preview: null, uploading: false, err: '' },
  });
  const [viewSide, setViewSide] = useState<Side | null>(null);
  const [saved, setSaved] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef  = useRef<HTMLInputElement>(null);

  const ref = (side: Side) => side === 'front' ? frontRef : backRef;

  function setSlot(side: Side, patch: Partial<SlotState>) {
    setSlots(s => ({ ...s, [side]: { ...s[side], ...patch } }));
  }

  async function handleFile(side: Side, file: File) {
    if (!file.type.startsWith('image/')) { setSlot(side, { err: 'Please select an image file.' }); return; }
    if (file.size > 10 * 1024 * 1024) { setSlot(side, { err: 'File too large (max 10 MB).' }); return; }

    const preview = URL.createObjectURL(file);
    setSlot(side, { preview, uploading: true, err: '' });
    setSaved(false);

    try {
      let url: string;

      if (useS3) {
        const ct = file.type || 'image/jpeg';
        const res = await fetch('/api/me/aadhar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: ct, side }),
        });
        if (!res.ok) throw new Error('Presign failed');
        const { presignedUrl, publicUrl } = await res.json();
        const putRes = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
        if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);
        url = publicUrl;
        await fetch('/api/me/aadhar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [`${side}_url`]: url }),
        });
      } else {
        const fd = new FormData();
        fd.append(side, file);
        const res = await fetch('/api/me/aadhar', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        url = preview; // use local preview; server has the file
      }

      setSlot(side, { url: useS3 ? url : url, uploading: false });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSlot(side, { uploading: false, err: 'Upload failed. Please try again.' });
    }
  }

  function handleDrop(side: Side, e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(side, file);
  }

  const displayUrl = (side: Side) => slots[side].preview || slots[side].url;

  return (
    <div className="card mt-4 px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
          <CreditCard size={18} className="text-white" />
        </div>
        <div>
          <p className="font-extrabold text-slate-900 text-[15px]">Aadhar Card</p>
          <p className="text-xs text-slate-400">Upload front & back for hotel check-in</p>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-1 text-green-600 text-xs font-bold">
            <CheckCircle2 size={13} /> Saved
          </div>
        )}
      </div>

      {/* Upload slots */}
      <div className="grid grid-cols-2 gap-3">
        {(['front', 'back'] as Side[]).map(side => {
          const s = slots[side];
          const img = displayUrl(side);
          return (
            <div key={side}>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {side === 'front' ? 'Front' : 'Back'}
              </p>
              <div
                className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 aspect-[3/2] cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition group"
                onClick={() => !s.uploading && ref(side).current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(side, e)}
              >
                {img ? (
                  <>
                    <Image src={img} alt={`Aadhar ${side}`} fill className="object-cover" unoptimized />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={e => { e.stopPropagation(); setViewSide(side); }}
                        className="p-2 rounded-full bg-white/90 text-slate-700 hover:bg-white transition"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); ref(side).current?.click(); }}
                        className="p-2 rounded-full bg-white/90 text-slate-700 hover:bg-white transition"
                      >
                        <Upload size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
                    {s.uploading
                      ? <Loader2 size={20} className="animate-spin text-indigo-500" />
                      : <><Upload size={18} className="group-hover:text-indigo-400 transition" />
                        <span className="text-[10px] font-semibold group-hover:text-indigo-500 transition">Tap to upload</span></>
                    }
                  </div>
                )}
                {s.uploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                  </div>
                )}
              </div>
              {s.err && <p className="text-[11px] text-red-500 mt-1">{s.err}</p>}
              <input ref={ref(side)} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(side, f); e.target.value = ''; }} />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Images are securely stored and only shared with hotel for room allocation.
      </p>

      {/* Full-size preview modal */}
      {viewSide && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewSide(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewSide(null)}
              className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white">
              <X size={20} />
            </button>
            <p className="text-white text-sm font-bold text-center mb-3">
              Aadhar {viewSide === 'front' ? 'Front' : 'Back'}
            </p>
            {displayUrl(viewSide) && (
              <Image src={displayUrl(viewSide)!} alt={`Aadhar ${viewSide}`}
                width={400} height={267} className="rounded-2xl w-full object-cover" unoptimized />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
