'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2 } from 'lucide-react';

interface Props {
  name:            string;
  email:           string;
  profilePhotoUrl: string | null;
  required?:       boolean;
  useS3:           boolean;
}

/* ── XHR PUT for S3 presigned upload ── */
function xhrPut(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

export default function ProfileClient({ name, email, profilePhotoUrl, required, useS3 }: Props) {
  const router                          = useRouter();
  const [preview, setPreview]           = useState<string | null>(profilePhotoUrl);
  const [file, setFile]                 = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null); // null = not uploading
  const [saved, setSaved]               = useState(false);
  const [photoErr, setPhotoErr]         = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setSaved(false);
    setPhotoErr(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (required && !preview) { setPhotoErr(true); return; }
    setSaving(true);
    setSaved(false);
    setPhotoProgress(null);

    try {
      let finalPhotoUrl: string | null = null;

      if (file && useS3) {
        /* ── S3: presign → XHR PUT → send CloudFront URL ── */
        setPhotoProgress(0);
        const presignRes = await fetch('/api/upload/presign', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: file.name, contentType: file.type || 'image/jpeg', context: 'profile' }),
        });
        if (!presignRes.ok) throw new Error('Failed to get upload URL');
        const { presignedUrl, publicUrl } = await presignRes.json();

        await xhrPut(presignedUrl, file, file.type || 'image/jpeg', pct => setPhotoProgress(pct));
        finalPhotoUrl = publicUrl;
        setPhotoProgress(100);

        const res = await fetch('/api/profile', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ photoUrl: finalPhotoUrl }),
        });
        if (!res.ok) throw new Error('Failed to save profile');
      } else {
        /* ── Local: FormData upload ── */
        const fd = new FormData();
        if (file) fd.append('photo', file);
        const res = await fetch('/api/profile', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Failed to save profile');
      }

      if (required) {
        // Hard redirect — bypasses Next.js router cache so the fresh
        // profile_photo_url is read server-side before the gate check fires.
        window.location.href = '/';
      } else {
        setSaved(true);
        setFile(null);
        setPhotoProgress(null);
        router.refresh();
      }
    } catch {
      /* keep form visible, user can retry */
    } finally {
      setSaving(false);
    }
  }

  const initial = name.charAt(0).toUpperCase();
  const isUploadingPhoto = photoProgress !== null && photoProgress < 100;

  return (
    <form onSubmit={save} className="space-y-4 pb-4">
      {/* Required mode banner */}
      {required && (
        <div className="rounded-3xl px-5 py-4 text-center" style={{ background: '#FFF4E8' }}>
          <p className="text-2xl mb-1">👋</p>
          <p className="font-bold text-slate-900">Welcome to ABHYUDAY!</p>
          <p className="text-sm text-slate-500 mt-1">
            Add your photo so your teammates can recognise you.
          </p>
        </div>
      )}

      {/* Avatar */}
      <div className="card px-5 py-6 flex flex-col items-center">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative active:scale-95 transition-transform">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-orange-100" />
          ) : (
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white ring-4 ${photoErr ? 'ring-red-300' : 'ring-slate-100'}`}
              style={{ background: '#0F172A' }}
            >
              {initial}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow"
            style={{ background: '#FE9234' }}>
            <Camera size={14} strokeWidth={1.8} color="white" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*,.jfif,.jpe,.jif,.jfi" className="hidden" onChange={pick} />

        {photoErr && <p className="text-xs text-red-500 font-medium mt-2">Please add a profile photo to continue</p>}

        {/* Photo upload progress bar */}
        {photoProgress !== null && (
          <div className="w-full mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-500">{photoProgress >= 100 ? 'Photo uploaded' : 'Uploading photo…'}</span>
              <span style={{ color: photoProgress >= 100 ? '#22C55E' : '#FE9234' }}>{photoProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
              <div className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${photoProgress}%`,
                  background: photoProgress >= 100 ? '#22C55E' : 'linear-gradient(90deg, #FE9234, #FFAD5E)',
                }}
              />
            </div>
          </div>
        )}

        {!required && (
          <>
            <p className="font-semibold text-slate-900 text-lg mt-4">{name}</p>
            <p className="text-sm text-slate-400">{email}</p>
          </>
        )}

        {required && (
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-4 text-sm font-semibold" style={{ color: '#FE9234' }}>
            {preview ? 'Change photo' : 'Add profile photo'}
          </button>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium" style={{ background: '#DCFCE7', color: '#15803D' }}>
          <CheckCircle2 size={16} strokeWidth={2} />
          Profile saved
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {isUploadingPhoto ? `Uploading photo… ${photoProgress}%` :
         saving           ? 'Saving…' :
         required         ? 'Continue to ABHYUDAY →' :
                            'Save Profile'}
      </button>
    </form>
  );
}
