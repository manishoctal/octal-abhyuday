'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Eye, X, CheckCircle2, Loader2, CreditCard, Camera } from 'lucide-react';
import Image from 'next/image';

interface AadharCard { front_url: string | null; back_url: string | null; uploaded_at: string }
interface Props { initial: AadharCard | null; useS3: boolean }

type Side = 'front' | 'back';

interface SlotState {
  url: string | null;
  preview: string | null;
  uploading: boolean;
  err: string;
}

/* ── Crop Modal ───────────────────────────────────────────── */
function CropModal({ src, side, onDone, onCancel }: {
  src: string;
  side: Side;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Initialise crop centred covering most of the image
  useEffect(() => {
    if (!loaded || !imgRef.current) return;
    const { offsetWidth: W, offsetHeight: H } = imgRef.current;
    const cw = W * 0.84;
    const ch = H * 0.84;
    setCrop({ x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch });
  }, [loaded]);

  // Drag ref — avoids setState during every pointer move
  const drag = useRef<{
    type: 'move' | 'tl' | 'tr' | 'bl' | 'br';
    startX: number; startY: number;
    ox: number; oy: number; ow: number; oh: number;
  } | null>(null);

  function getXY(e: React.MouseEvent | React.TouchEvent) {
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  }

  function startDrag(type: typeof drag.current extends null ? never : NonNullable<typeof drag.current>['type'],
                     e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    if (!crop) return;
    const { x, y } = getXY(e);
    drag.current = { type, startX: x, startY: y, ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drag.current || !imgRef.current) return;
    const { x, y } = getXY(e);
    const dx = x - drag.current.startX;
    const dy = y - drag.current.startY;
    const { type, ox, oy, ow, oh } = drag.current;
    const W = imgRef.current.offsetWidth;
    const H = imgRef.current.offsetHeight;
    const MIN = 60;

    let cx = ox, cy = oy, cw = ow, ch = oh;

    if (type === 'move') {
      cx = Math.max(0, Math.min(W - cw, ox + dx));
      cy = Math.max(0, Math.min(H - ch, oy + dy));
    } else if (type === 'br') {
      cw = Math.max(MIN, Math.min(W - ox, ow + dx));
      ch = Math.max(MIN, Math.min(H - oy, oh + dy));
    } else if (type === 'bl') {
      const nw = Math.max(MIN, ow - dx);
      const nx = ox + ow - nw;
      if (nx >= 0) { cx = nx; cw = nw; }
      ch = Math.max(MIN, Math.min(H - oy, oh + dy));
    } else if (type === 'tr') {
      cw = Math.max(MIN, Math.min(W - ox, ow + dx));
      const nh = Math.max(MIN, oh - dy);
      const ny = oy + oh - nh;
      if (ny >= 0) { cy = ny; ch = nh; }
    } else if (type === 'tl') {
      const nw = Math.max(MIN, ow - dx);
      const nx = ox + ow - nw;
      if (nx >= 0) { cx = nx; cw = nw; }
      const nh = Math.max(MIN, oh - dy);
      const ny = oy + oh - nh;
      if (ny >= 0) { cy = ny; ch = nh; }
    }

    setCrop({ x: cx, y: cy, w: cw, h: ch });
  }

  function endDrag() { drag.current = null; }

  function applyCrop() {
    if (!crop || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const sx = (crop.x / img.offsetWidth)  * img.naturalWidth;
    const sy = (crop.y / img.offsetHeight) * img.naturalHeight;
    const sw = (crop.w / img.offsetWidth)  * img.naturalWidth;
    const sh = (crop.h / img.offsetHeight) * img.naturalHeight;
    const canvas = canvasRef.current;
    canvas.width  = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob(blob => {
      if (blob) onDone(new File([blob], `aadhar-${side}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  const HANDLE_POS = {
    tl: { top: -8,  left: -8  },
    tr: { top: -8,  right: -8 },
    bl: { bottom: -8, left: -8  },
    br: { bottom: -8, right: -8 },
  } as const;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col select-none"
      style={{ touchAction: 'none' }}
      onMouseMove={onPointerMove}
      onMouseUp={endDrag}
      onTouchMove={onPointerMove}
      onTouchEnd={endDrag}
    >
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(0,0,0,0.85)', paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onCancel}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
        <p className="text-white font-bold text-sm">
          Crop — Aadhar {side === 'front' ? 'Front' : 'Back'}
        </p>
        <button
          onClick={applyCrop}
          disabled={!loaded || !crop}
          className="px-4 py-1.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
        >
          Use Photo
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="max-h-[72vh] max-w-full block"
            style={{ userSelect: 'none' }}
          />

          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          )}

          {/* Crop box — box-shadow creates the dim overlay */}
          {crop && (
            <div
              className="absolute border-2 border-white"
              style={{
                left: crop.x, top: crop.y, width: crop.w, height: crop.h,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                cursor: 'move',
              }}
              onMouseDown={e => startDrag('move', e)}
              onTouchStart={e => startDrag('move', e)}
            >
              {/* Rule-of-thirds lines */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: [
                  'linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)',
                  'linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)',
                ].join(', '),
                backgroundSize: '33.33% 33.33%',
              }} />

              {/* Corner handles */}
              {(['tl', 'tr', 'bl', 'br'] as const).map(h => (
                <div
                  key={h}
                  className="absolute w-5 h-5 bg-white rounded-sm shadow-lg"
                  style={{ ...HANDLE_POS[h], cursor: `${h}-resize` }}
                  onMouseDown={e => startDrag(h, e)}
                  onTouchStart={e => startDrag(h, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="shrink-0 py-3 text-center text-white/40 text-[11px]"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        Drag box to move · corners to resize
      </p>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function AadharUploadClient({ initial, useS3 }: Props) {
  const [slots, setSlots] = useState<Record<Side, SlotState>>({
    front: { url: initial?.front_url ?? null, preview: null, uploading: false, err: '' },
    back:  { url: initial?.back_url  ?? null, preview: null, uploading: false, err: '' },
  });
  const [viewSide,  setViewSide]  = useState<Side | null>(null);
  const [cropState, setCropState] = useState<{ side: Side; src: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const frontFileRef   = useRef<HTMLInputElement>(null);
  const backFileRef    = useRef<HTMLInputElement>(null);
  const frontCamRef    = useRef<HTMLInputElement>(null);
  const backCamRef     = useRef<HTMLInputElement>(null);

  const fileRef = (side: Side) => side === 'front' ? frontFileRef : backFileRef;
  const camRef  = (side: Side) => side === 'front' ? frontCamRef  : backCamRef;

  function setSlot(side: Side, patch: Partial<SlotState>) {
    setSlots(s => ({ ...s, [side]: { ...s[side], ...patch } }));
  }

  function openCrop(side: Side, file: File) {
    if (!file.type.startsWith('image/')) { setSlot(side, { err: 'Please select an image file.' }); return; }
    if (file.size > 10 * 1024 * 1024)   { setSlot(side, { err: 'File too large (max 10 MB).' });  return; }
    setCropState({ side, src: URL.createObjectURL(file) });
  }

  async function handleFile(side: Side, file: File) {
    const preview = URL.createObjectURL(file);
    setSlot(side, { preview, uploading: true, err: '' });
    setSaved(false);

    try {
      if (useS3) {
        const ct = 'image/jpeg';
        const res = await fetch('/api/me/aadhar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: `aadhar-${side}.jpg`, contentType: ct, side }),
        });
        if (!res.ok) throw new Error('Presign failed');
        const { presignedUrl, publicUrl } = await res.json();
        await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
        await fetch('/api/me/aadhar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [`${side}_url`]: publicUrl }),
        });
        setSlot(side, { url: publicUrl, uploading: false });
      } else {
        const fd = new FormData();
        fd.append(side, file);
        const res = await fetch('/api/me/aadhar', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        setSlot(side, { uploading: false });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSlot(side, { uploading: false, err: 'Upload failed. Please try again.' });
    }
  }

  function onCropDone(file: File) {
    if (!cropState) return;
    const { side, src } = cropState;
    URL.revokeObjectURL(src);
    setCropState(null);
    handleFile(side, file);
  }

  function onCropCancel() {
    if (cropState) URL.revokeObjectURL(cropState.src);
    setCropState(null);
  }

  function handleDrop(side: Side, e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) openCrop(side, file);
  }

  const displayUrl = (side: Side) => slots[side].preview || slots[side].url;

  return (
    <>
      {cropState && (
        <CropModal
          src={cropState.src}
          side={cropState.side}
          onDone={onCropDone}
          onCancel={onCropCancel}
        />
      )}

      <div className="card mt-4 px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            <CreditCard size={18} className="text-white" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-[15px]">Aadhar Card</p>
            <p className="text-xs text-slate-400">Upload or capture front & back · auto-cropped</p>
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
            const s   = slots[side];
            const img = displayUrl(side);

            return (
              <div key={side}>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {side === 'front' ? 'Front' : 'Back'}
                </p>

                {/* Card slot */}
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 aspect-[3/2] transition group"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(side, e)}
                >
                  {img ? (
                    <>
                      <Image src={img} alt={`Aadhar ${side}`} fill className="object-cover" unoptimized />

                      {/* Overlay actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setViewSide(side)}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow active:scale-90 transition"
                          title="View full size"
                        >
                          <Eye size={15} className="text-slate-700" />
                        </button>
                        <button
                          onClick={() => fileRef(side).current?.click()}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow active:scale-90 transition"
                          title="Replace from gallery"
                        >
                          <Upload size={15} className="text-slate-700" />
                        </button>
                        <button
                          onClick={() => camRef(side).current?.click()}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow active:scale-90 transition"
                          title="Capture with camera"
                        >
                          <Camera size={15} className="text-slate-700" />
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Empty state — two action buttons */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      {s.uploading ? (
                        <Loader2 size={22} className="animate-spin text-indigo-500" />
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => camRef(side).current?.click()}
                              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 active:scale-95 transition"
                            >
                              <Camera size={20} className="text-indigo-500" />
                              <span className="text-[10px] font-bold text-indigo-600">Capture</span>
                            </button>
                            <button
                              onClick={() => fileRef(side).current?.click()}
                              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white active:scale-95 transition"
                            >
                              <Upload size={20} className="text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500">Upload</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-300">or drag & drop</p>
                        </>
                      )}
                    </div>
                  )}

                  {s.uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 size={22} className="animate-spin text-indigo-500" />
                    </div>
                  )}
                </div>

                {s.err && <p className="text-[11px] text-red-500 mt-1">{s.err}</p>}

                {/* Gallery picker */}
                <input
                  ref={fileRef(side)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) openCrop(side, f); e.target.value = ''; }}
                />
                {/* Camera capture */}
                <input
                  ref={camRef(side)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) openCrop(side, f); e.target.value = ''; }}
                />
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          Images are securely stored and only shared with hotel for room allocation.
        </p>
      </div>

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
              <Image
                src={displayUrl(viewSide)!}
                alt={`Aadhar ${viewSide}`}
                width={400} height={267}
                className="rounded-2xl w-full object-cover"
                unoptimized
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
