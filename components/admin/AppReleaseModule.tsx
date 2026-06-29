'use client';

import { useState } from 'react';

interface Release {
  downloadUrl:    string;
  versionName:    string;
  versionCode:    string;
  minVersionCode: string;
  releaseNotes:   string;
}

export default function AppReleaseModule({ initial }: { readonly initial: Release }) {
  const [form, setForm]     = useState<Release>(initial);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState('');

  const set =
    (k: keyof Release) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

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
    typeof globalThis.window !== 'undefined'
      ? `${globalThis.window.location.origin}/install`
      : '/install';

  return (
    <div className="space-y-6 max-w-lg">
      {/* ── Release Details ── */}
      <div className="card px-5 py-5 space-y-4">
        <h2 className="font-black text-slate-900 text-lg">Android App Release</h2>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            APK Download URL
          </span>
          <input
            value={form.downloadUrl}
            onChange={set('downloadUrl')}
            placeholder="https://…"
            className="input w-full"
          />
          <p className="text-xs text-slate-400">
            Direct link to the APK (Google Drive share, Firebase App Distribution, S3 pre-signed URL, etc.)
          </p>
        </label>

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
