'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { ScheduleSession, ScheduleSessionType } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPES: { value: ScheduleSessionType; label: string; icon: string }[] = [
  { value: 'session', label: 'Session / Talk', icon: '🎤' },
  { value: 'meal', label: 'Meal', icon: '🍽️' },
  { value: 'break', label: 'Tea / Break', icon: '☕' },
  { value: 'activity', label: 'Activity', icon: '🎯' },
  { value: 'ceremony', label: 'Ceremony', icon: '🏆' },
];

const EMPTY = {
  title: '',
  start_time: '',
  end_time: '',
  location: '',
  speaker: '',
  type: 'session' as ScheduleSessionType,
  description: '',
  sort_order: 0,
};

type Form = typeof EMPTY;

function SessionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Form;
  onSave: (data: Form) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  return (
    <form onSubmit={submit} className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 block mb-1">Title *</label>
          <input required className={inp} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Opening Ceremony" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Type</label>
          <select className={inp} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Location</label>
          <input className={inp} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Main Hall" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Start *</label>
          <input required type="datetime-local" className={inp} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">End</label>
          <input type="datetime-local" className={inp} value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 block mb-1">Speaker / Host</label>
          <input className={inp} value={form.speaker} onChange={(e) => set('speaker', e.target.value)} placeholder="Name (optional)" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 block mb-1">Notes</label>
          <textarea rows={2} className={inp} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Additional details (optional)" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function ScheduleModule() {
  const { data, mutate } = useSWR('/api/admin/schedule', fetcher, { refreshInterval: 0 });
  const sessions: ScheduleSession[] = data?.sessions ?? [];
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  async function callApi(body: object) {
    await fetch('/api/admin/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    mutate();
  }

  function formData(s: ScheduleSession): Form {
    return {
      title: s.title,
      start_time: s.start_time.slice(0, 16),
      end_time: s.end_time?.slice(0, 16) ?? '',
      location: s.location ?? '',
      speaker: s.speaker ?? '',
      type: s.type,
      description: s.description ?? '',
      sort_order: s.sort_order,
    };
  }

  async function save(data: Form, id?: number) {
    await callApi({ action: id ? 'update' : 'create', id, data });
    setEditing(null);
  }

  async function del(id: number) {
    if (!confirm('Delete this session?')) return;
    await callApi({ action: 'delete', id });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{sessions.length} sessions</p>
        <button
          onClick={() => setEditing('new')}
          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
        >
          + Add session
        </button>
      </div>

      {editing === 'new' && (
        <SessionForm
          initial={{ ...EMPTY, sort_order: sessions.length }}
          onSave={(d) => save(d)}
          onCancel={() => setEditing(null)}
        />
      )}

      {sessions.length === 0 && editing !== 'new' && (
        <p className="text-center text-slate-400 py-8 text-sm">No sessions yet — add the first one.</p>
      )}

      <ol className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id}>
            {editing === s.id ? (
              <SessionForm
                initial={formData(s)}
                onSave={(d) => save(d, s.id)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-white">
                <span className="text-xl mt-0.5">
                  {TYPES.find((t) => t.value === s.type)?.icon ?? '🎤'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {s.end_time && ` – ${new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    {s.location && ` · ${s.location}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(s.id)} className="text-xs text-brand-600 font-semibold hover:underline">Edit</button>
                  <button onClick={() => del(s.id)} className="text-xs text-red-500 font-semibold hover:underline">Delete</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
