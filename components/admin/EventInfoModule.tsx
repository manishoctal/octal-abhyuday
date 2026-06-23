'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { EventInfoItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SECTIONS = ['venue', 'parking', 'contacts', 'faq', 'instructions'];

const EMPTY = { section: 'venue', title: '', body: '', sort_order: 0 };

export default function EventInfoModule() {
  const { data, mutate } = useSWR('/api/admin/event-info', fetcher);
  const items: EventInfoItem[] = data?.items ?? [];
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  async function callApi(body: object) {
    await fetch('/api/admin/event-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    mutate();
  }

  function startEdit(item: EventInfoItem) {
    setForm({ section: item.section, title: item.title, body: item.body, sort_order: item.sort_order });
    setEditing(item.id);
  }

  function startNew() {
    setForm({ ...EMPTY, sort_order: items.length });
    setEditing('new');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await callApi({
      action: 'upsert',
      id: editing === 'new' ? null : editing,
      ...form,
      sortOrder: form.sort_order,
    });
    setSaving(false);
    setEditing(null);
  }

  async function del(id: number) {
    if (!confirm('Delete this item?')) return;
    await callApi({ action: 'delete', id });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} info items across {new Set(items.map((i) => i.section)).size} sections</p>
        <button onClick={startNew} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition">
          + Add item
        </button>
      </div>

      {(editing === 'new' || editing !== null) && (
        <form onSubmit={submit} className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Section</label>
              <select className={inp} value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}>
                {SECTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Title *</label>
              <input required className={inp} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Venue Address" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Content *</label>
              <textarea required rows={4} className={inp} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Details, address, contact info, FAQ answer…" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && editing === null && (
        <p className="text-center text-slate-400 py-8 text-sm">No info items yet. Add venue details, FAQs, and emergency contacts here.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-white">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.section}</p>
              <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line">{item.body}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-brand-600 font-semibold hover:underline">Edit</button>
              <button onClick={() => del(item.id)} className="text-xs text-red-500 font-semibold hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
