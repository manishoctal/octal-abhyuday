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
    setErr(''); setUploading(true); setUploadPct(0); setSaved(false);
    try {
      const fd = new FormData();
      fd.append('file', file);

      // Upload to server disk via XHR for progress tracking
      const { publicUrl } = await new Promise<{ publicUrl: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/apk-upload');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText) as { publicUrl: string });
          } else {
            let msg = `Upload failed (${xhr.status})`;
            try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
      });

      // Auto-save the new URL to DB immediately so /install always serves fresh
      const newForm = { ...form, downloadUrl: publicUrl };
      const saveRes = await fetch('/api/admin/app-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      if (!saveRes.ok) throw new Error('File uploaded but failed to save URL — click Save Release manually');

      setForm(newForm);
      setUploadedName(file.name);
      setSaved(true);
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

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50 transition-colors text-sm font-semibold text-slate-600 hover:text-orange-600 disabled:opacity-50"
          >
            {uploading ? `Uploading… ${uploadPct}%` : '⬆ Upload APK'}
          </button>

          {uploading && (
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}

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

          <p className="text-[11px] text-slate-400">
            Stored on server disk · served with no-cache headers · no CDN involvement
          </p>
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
        {saved && <p className="text-sm text-green-600 font-medium">✓ Saved — /install now serves the latest APK</p>}

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
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-bold">⚠ One-time server setup required</p>
          <p>Add this to your nginx config so large APKs upload correctly:</p>
          <code className="block bg-amber-100 rounded px-2 py-1 font-mono mt-1">
            client_max_body_size 150M;
          </code>
          <p className="text-amber-600 mt-1">Then: <code className="font-mono">sudo nginx -s reload</code></p>
        </div>
      </div>
    </div>
  );
}
