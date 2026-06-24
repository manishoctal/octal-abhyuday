'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  name: string;
  email: string;
  department: string | null;
  profilePhotoUrl: string | null;
  required?: boolean; // true = first-time completion gate
}

export default function ProfileClient({ name, email, department, profilePhotoUrl, required }: Props) {
  const router = useRouter();
  const [dept, setDept]       = useState(department ?? '');
  const [preview, setPreview] = useState<string | null>(profilePhotoUrl);
  const [file, setFile]       = useState<File | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [photoErr, setPhotoErr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    try {
      const fd = new FormData();
      fd.append('department', dept);
      if (file) fd.append('photo', file);
      const res = await fetch('/api/profile', { method: 'POST', body: fd });
      if (res.ok) {
        if (required) {
          router.push('/');
        } else {
          setSaved(true);
          setFile(null);
          router.refresh();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const initial = name.charAt(0).toUpperCase();

  return (
    <form onSubmit={save} className="space-y-4 pb-4">
      {/* Required mode banner */}
      {required && (
        <div className="rounded-3xl px-5 py-4 text-center" style={{ background: '#FFF4E8' }}>
          <p className="text-2xl mb-1">👋</p>
          <p className="font-bold text-slate-900">Welcome to ABHYUDAY!</p>
          <p className="text-sm text-slate-500 mt-1">
            Add your photo and department so your teammates can recognise you.
          </p>
        </div>
      )}

      {/* Avatar */}
      <div className="card px-5 py-6 flex flex-col items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative active:scale-95 transition-transform"
        >
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
          <span
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow"
            style={{ background: '#FE9234' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="2" stroke="white" strokeWidth="1.2"/>
              <circle cx="7" cy="7.5" r="2" stroke="white" strokeWidth="1.2"/>
              <path d="M5 3l.7-1.5h2.6L9 3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*,.jfif,.jpe,.jif,.jfi" className="hidden" onChange={pick} />

        {photoErr && (
          <p className="text-xs text-red-500 font-medium mt-2">Please add a profile photo to continue</p>
        )}

        {!required && (
          <>
            <p className="font-semibold text-slate-900 text-lg mt-4">{name}</p>
            <p className="text-sm text-slate-400">{email}</p>
          </>
        )}

        {required && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 text-sm font-semibold"
            style={{ color: '#FE9234' }}
          >
            {preview ? 'Change photo' : 'Add profile photo'}
          </button>
        )}
      </div>

      {/* Department */}
      <div className="card px-5 py-4">
        <label htmlFor="dept" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Department <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="dept"
          type="text"
          placeholder="e.g. Engineering, HR, Sales"
          value={dept}
          onChange={e => { setDept(e.target.value); setSaved(false); }}
          className="input"
        />
        <p className="text-[11px] text-slate-400 mt-1.5">
          Used for your event badge and department-targeted announcements.
        </p>
      </div>

      {saved && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ background: '#DCFCE7', color: '#15803D' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Profile saved
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : required ? 'Continue to ABHYUDAY →' : 'Save Profile'}
      </button>
    </form>
  );
}
