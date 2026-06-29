'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { GripVertical, Pencil, Trash2, MapPin, Plus, X } from 'lucide-react';
import type { EventInfoItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SECTIONS = ['venue', 'parking', 'contacts', 'faq', 'instructions', 'other'];
const MAPS_SECTIONS = ['venue', 'parking'];

const SECTION_LABELS: Record<string, string> = {
  venue: '📍 Venue',
  parking: '🅿️ Parking',
  contacts: '📞 Contacts',
  faq: '❓ FAQ',
  instructions: '📋 Instructions',
  other: '📌 Other',
};

const EMPTY = { section: 'venue', title: '', body: '', maps_url: '', sort_order: 0 };

const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white';

/* ── Drag-to-sort list ───────────────────────────────────── */
function DraggableList({
  items,
  onReorder,
  onEdit,
  onDelete,
}: {
  items: EventInfoItem[];
  onReorder: (ids: number[]) => void;
  onEdit: (item: EventInfoItem) => void;
  onDelete: (id: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver]         = useState<number | null>(null);
  const localOrder = useRef<number[]>(items.map((i) => i.id));

  // Keep ref in sync when items change from server
  if (localOrder.current.join(',') !== items.map((i) => i.id).join(',')) {
    localOrder.current = items.map((i) => i.id);
  }

  const orderedItems = localOrder.current
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as EventInfoItem[];

  function handleDragStart(id: number) {
    setDragging(id);
  }

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (id !== over) setOver(id);
  }

  function handleDrop(targetId: number) {
    if (dragging == null || dragging === targetId) { reset(); return; }
    const ids = [...localOrder.current];
    const from = ids.indexOf(dragging);
    const to   = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragging);
    localOrder.current = ids;
    onReorder(ids);
    reset();
  }

  function reset() { setDragging(null); setOver(null); }

  if (orderedItems.length === 0) {
    return (
      <p className="text-center text-slate-400 py-10 text-sm">
        No info items yet. Add venue details, FAQs, and emergency contacts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {orderedItems.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(item.id)}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDrop={() => handleDrop(item.id)}
          onDragEnd={reset}
          className={`group flex items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-all select-none ${
            dragging === item.id
              ? 'opacity-40 scale-[0.98] border-brand-300 shadow-md'
              : over === item.id
                ? 'border-brand-400 bg-brand-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mt-0.5 shrink-0 pt-0.5">
            <GripVertical size={16} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {SECTION_LABELS[item.section] ?? item.section}
              </span>
              {item.maps_url && (
                <span className="text-[10px] font-bold text-brand-500 flex items-center gap-0.5">
                  <MapPin size={9} />Maps
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-900 text-sm leading-snug">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line leading-relaxed">{item.body}</p>
          </div>

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main module ─────────────────────────────────────────── */
export default function EventInfoModule() {
  const { data, mutate } = useSWR('/api/admin/event-info', fetcher);
  const items: EventInfoItem[] = data?.items ?? [];

  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  async function callApi(body: object) {
    await fetch('/api/admin/event-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    mutate();
  }

  function startEdit(item: EventInfoItem) {
    setForm({ section: item.section, title: item.title, body: item.body, maps_url: item.maps_url ?? '', sort_order: item.sort_order });
    setEditing(item.id);
    // scroll form into view
    setTimeout(() => document.getElementById('event-info-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function startNew() {
    setForm({ ...EMPTY, sort_order: items.length });
    setEditing('new');
    setTimeout(() => document.getElementById('event-info-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await callApi({
      action: 'upsert',
      id: editing === 'new' ? null : editing,
      ...form,
      sortOrder: form.sort_order,
      mapsUrl: form.maps_url.trim() || null,
    });
    setSaving(false);
    setEditing(null);
  }

  async function del(id: number) {
    if (!confirm('Delete this item?')) return;
    await callApi({ action: 'delete', id });
  }

  async function handleReorder(ids: number[]) {
    await callApi({ action: 'reorder', ids });
  }

  const showMapsField = MAPS_SECTIONS.includes(form.section);

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

      {/* ── Left: item list ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">{items.length} info items</p>
            <p className="text-xs text-slate-400 mt-0.5">Drag rows to reorder — order is preserved for attendees</p>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
          >
            <Plus size={14} />Add item
          </button>
        </div>

        <DraggableList
          items={items}
          onReorder={handleReorder}
          onEdit={startEdit}
          onDelete={del}
        />
      </div>

      {/* ── Right: form ─────────────────────────────────── */}
      <div className="lg:sticky lg:top-6" id="event-info-form">
        {editing !== null ? (
          <form
            onSubmit={submit}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900">{editing === 'new' ? 'Add item' : 'Edit item'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Section</label>
              <select className={inp} value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>{SECTION_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Title *</label>
              <input
                required
                className={inp}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Venue Address"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Content *</label>
              <textarea
                required
                rows={5}
                className={inp}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Address, contact info, FAQ answer, parking details…"
              />
            </div>

            {showMapsField && (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Google Maps URL
                  <span className="font-normal text-slate-400 ml-1">— optional</span>
                </label>
                <input
                  type="url"
                  className={inp}
                  value={form.maps_url}
                  onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                />
                <p className="text-[11px] text-slate-400 mt-1">Google Maps → Share → Copy link</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-60 transition"
              >
                {saving ? 'Saving…' : editing === 'new' ? 'Add' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-slate-400 text-sm">Select an item to edit,<br />or click <strong>Add item</strong> to create one.</p>
            <button
              onClick={startNew}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition mx-auto"
            >
              <Plus size={14} />Add item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
