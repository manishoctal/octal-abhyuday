'use client';

import { useRef, useState } from 'react';

interface Release {
  downloadUrl:    string;
  versionName:    string;
  versionCode:    string;
  minVersionCode: string;
  releaseNotes:   string;
}

export default function AppReleaseModule({ initial }: { readonly initial: Release }) {
  const [form, setForm]         = useState<Release>(initial);
  const [saving, setSaving]     = useState(false);
  const [saved,  setSaved]      = useState(false);
  const [err,    setErr]        = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadedName, setUploadedName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set =
    (k: keyof Release) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleApkFile(file: File) {
    setErr(''); setUploading(true); setUploadPct(0);
    try {
      // 1. Get presigned upload URL
      const presignRes = await fetch('/api/admin/apk-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!presignRes.ok) {
        const { error } = (await presignRes.json()) as { error?: string };
        throw new Error(error ?? 'Could not get upload URL');
      }
      const { presignedUrl, publicUrl } = (await presignRes.json()) as {
        presignedUrl: string;
        publicUrl: string;
      };

      // 2. Upload directly to S3 using XHR so we get progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload  = () => (xhr.status === 200 ? resolve() : reject(new Error(`S3 error ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      setForm(f => ({ ...f, downloadUrl: publicUrl }));
      setUploadedName(file.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const res = await fetch('/api/admin/app-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaved(true);
      else setErr(((await res.json()) as { error?: string }).error ?? 'Save failed');
    } catch {
      setErr('Network error');
    } finally {
      setSaving(false);
    }
  }

  const installUrl =
    globalThis.window?.location.origin
      ? `${globalThis.window.location.origin}/install`
      : '/install';

  return (
    <div className="space-y-6 max-w-lg">
      {/* ── Release Details ── */}
      <div className="card px-5 py-5 space-y-4">
        <h2 className="font-black text-slate-900 text-lg">Android App Release</h2>

        {/* ── APK Upload ── */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            APK File
          </span>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleApkFile(file);
              e.target.value = '';
            }}
          />

          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50 transition-colors text-sm font-semibold text-slate-600 hover:text-orange-600 disabled:opacity-50"
          >
            {uploading ? `Uploading… ${uploadPct}%` : '⬆ Upload APK'}
          </button>

          {/* Progress bar */}
          {uploading && (
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}

          {/* Current URL (read-only after upload, or existing saved URL) */}
          {form.downloadUrl && (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="text-green-600 text-sm mt-0.5">✓</span>
              <div className="flex-1 min-w-0">
                {uploadedName && (
                  <p className="text-xs font-semibold text-slate-700 truncate">{uploadedName}</p>
                )}
                <p className="text-xs text-slate-400 truncate">{form.downloadUrl}</p>
              </div>
              <a
                href={form.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-500 hover:underline shrink-0"
              >
                Test ↗
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Version Name
            </span>
            <input
              value={form.versionName}
              onChange={set('versionName')}
              placeholder="1.0.0"
              className="input w-full"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Version Code
            </span>
            <input
              type="number"
              min={1}
              value={form.versionCode}
              onChange={set('versionCode')}
              placeholder="1"
              className="input w-full"
            />
          </label>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Version code must match <code className="bg-slate-100 px-1 rounded">versionCode</code> in{' '}
          <code className="bg-slate-100 px-1 rounded">android/app/build.gradle</code>
        </p>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Min Version Code — Force Update
          </span>
          <input
            type="number"
            min={0}
            value={form.minVersionCode}
            onChange={set('minVersionCode')}
            placeholder="Leave blank to disable"
            className="input w-full"
          />
          <p className="text-xs text-slate-400">
            Users on a lower version will see a blocking update screen. Leave blank to disable.
          </p>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Release Notes (optional)
          </span>
          <textarea
            value={form.releaseNotes}
            onChange={set('releaseNotes')}
            rows={3}
            placeholder="What's new in this version…"
            className="input w-full resize-none"
          />
        </label>

        {err   && <p className="text-sm text-red-600 font-medium">{err}</p>}
        {saved && <p className="text-sm text-green-600 font-medium">✓ Saved</p>}

        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save Release'}
        </button>
      </div>

      {/* ── Install Page Link ── */}
      <div className="card px-5 py-4 space-y-3">
        <h3 className="font-bold text-slate-800">📲 Install Page</h3>
        <p className="text-sm text-slate-500">
          Share this link (or display the QR code) so employees can download the app:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-slate-50 rounded-xl px-3 py-2.5 text-slate-700 break-all">
            {installUrl}
          </code>
          <a
            href="/install"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-bold text-orange-500 hover:text-orange-600 px-3 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            Open ↗
          </a>
        </div>
        <p className="text-xs text-slate-400">
          The install page shows a QR code of the APK URL and a download button.
        </p>
      </div>
    </div>
  );
}
