'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Plus, Trash2, ChevronUp, ChevronDown, RefreshCw,
  Star, AlignLeft, ListChecks, ThumbsUp, CheckSquare, LayoutList, Eye, EyeOff, Save, X,
} from 'lucide-react';
import type { FeedbackQuestion, FeedbackQuestionType, FeedbackSubmission } from '@/lib/db';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type SubmissionWithUser = FeedbackSubmission & { name: string; email: string };

const TYPE_META: Record<FeedbackQuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  rating:       { label: 'Star Rating',       icon: <Star        size={14}/>, color: '#F59E0B' },
  rating_group: { label: 'Rating Group',      icon: <LayoutList  size={14}/>, color: '#F97316' },
  text:         { label: 'Text Answer',        icon: <AlignLeft   size={14}/>, color: '#3B82F6' },
  choice:       { label: 'Single Choice',      icon: <ListChecks  size={14}/>, color: '#8B5CF6' },
  multiselect:  { label: 'Multi-Select',       icon: <CheckSquare size={14}/>, color: '#EC4899' },
  yesno:        { label: 'Yes / No',           icon: <ThumbsUp    size={14}/>, color: '#10B981' },
};

const EMPTY_FORM = {
  title: '', subtitle: '', type: 'rating' as FeedbackQuestionType,
  options: '', allowOther: false, required: false, active: true,
};

/* ── Question builder form ── */
function QuestionForm({
  initial, onSave, onCancel, saving,
}: {
  initial: typeof EMPTY_FORM & { id?: number };
  onSave: (data: typeof EMPTY_FORM & { id?: number }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Question *</label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. How would you rate the food?"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Subtitle (optional)</label>
        <input
          value={form.subtitle}
          onChange={e => set('subtitle', e.target.value)}
          placeholder="Short description shown below the question"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(TYPE_META) as [FeedbackQuestionType, typeof TYPE_META[FeedbackQuestionType]][]).map(([key, meta]) => (
            <button key={key} type="button"
              onClick={() => set('type', key)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition"
              style={{
                background:   form.type === key ? `${meta.color}15` : 'white',
                borderColor:  form.type === key ? meta.color : '#E2E8F0',
                color:        form.type === key ? meta.color : '#64748B',
              }}>
              <span style={{ color: meta.color }}>{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      {(form.type === 'choice' || form.type === 'multiselect') && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Options (comma-separated)
            </label>
            <input
              value={form.options}
              onChange={e => set('options', e.target.value)}
              placeholder="e.g. Excellent, Good, Average, Poor"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.allowOther} onChange={e => set('allowOther', e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500" />
            <span className="text-sm font-semibold text-slate-700">
              Include <span className="text-orange-500">"Other (Please Specify)"</span> option
            </span>
          </label>
        </div>
      )}
      {form.type === 'rating_group' && (
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Sub-items (one per line)
          </label>
          <textarea
            rows={6}
            value={form.options}
            onChange={e => set('options', e.target.value)}
            placeholder={'e.g.\nEvent Planning & Management\nStage & Decorations\nAudio & Lighting\nFood Quality'}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">Each line becomes a separate row with a 1–5 star rating.</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.required} onChange={e => set('required', e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500" />
          <span className="text-sm font-semibold text-slate-700">Required</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none ml-4">
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500" />
          <span className="text-sm font-semibold text-slate-700">Active</span>
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition"
          style={{ background: 'linear-gradient(135deg,#FE9234,#FF6B35)' }}>
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? 'Saving…' : 'Save Question'}
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Responses viewer ── */
function ResponsesTab({ questions }: { questions: FeedbackQuestion[] }) {
  const { data } = useSWR<{ submissions: SubmissionWithUser[]; questions: FeedbackQuestion[] }>(
    '/api/feedback?admin=1', fetcher, { refreshInterval: 30000 }
  );
  const submissions = data?.submissions ?? [];
  const activeQs = questions.filter(q => q.active).sort((a, b) => a.sort_order - b.sort_order);

  function exportCsv() {
    if (!submissions.length) return;
    const headers = ['#', ...activeQs.map(q => `"${q.title}"`), 'Submitted'];
    const rows = submissions.map((s, i) => {
      const ans = JSON.parse(s.answers) as Record<string, unknown>;
      return [
        i + 1,
        ...activeQs.map(q => {
          const v = ans[String(q.id)];
          if (q.type === 'rating_group' && v && typeof v === 'object') {
            const text = Object.entries(v as Record<string,number>).map(([k,n]) => `${k}:${n}`).join('; ');
            return `"${text.replace(/"/g, '""')}"`;
          }
          return `"${String(v ?? '').replace(/"/g, '""')}"`;
        }),
        `"${new Date(s.submitted_at).toLocaleString()}"`,
      ].join(',');
    });
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'feedback.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-semibold">{submissions.length} response{submissions.length !== 1 ? 's' : ''}</p>
        {submissions.length > 0 && (
          <button onClick={exportCsv}
            className="text-xs font-bold border px-3 py-1.5 rounded-full hover:bg-slate-50 transition"
            style={{ color: '#FE9234', borderColor: '#FED7AA' }}>
            ↓ Export CSV
          </button>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="text-5xl mb-3">📋</span>
          <p className="font-bold">No responses yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide w-10">#</th>
                {activeQs.map(q => (
                  <th key={q.id} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[160px]">
                    <span className="block truncate" title={q.title}>{q.title}</span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => {
                const ans = JSON.parse(s.answers) as Record<string, unknown>;
                return (
                  <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-3 py-2.5 text-slate-400 font-semibold text-xs">{idx + 1}</td>
                    {activeQs.map(q => {
                      const val = ans[String(q.id)];
                      return (
                        <td key={q.id} className="px-3 py-2.5 max-w-[180px]">
                          {!val ? (
                            <span className="text-slate-300 text-xs">—</span>
                          ) : (q.type === 'rating') ? (
                            <span className="text-amber-500 font-bold text-xs whitespace-nowrap">
                              {'⭐'.repeat(Number(val))}{'☆'.repeat(5 - Number(val))}
                              <span className="text-slate-400 font-normal ml-1">({String(val)}/5)</span>
                            </span>
                          ) : q.type === 'rating_group' ? (
                            <div className="space-y-0.5">
                              {Object.entries(val as Record<string, number>).map(([item, n]) => (
                                <div key={item} className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={item}>{item}</span>
                                  <span className="text-[10px] text-amber-500 font-bold shrink-0">{'⭐'.repeat(n)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-700 text-xs line-clamp-2" title={String(val)}>{String(val)}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(s.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Main admin module ── */
export default function AdminFeedbackModule({ initialQuestions }: { initialQuestions: FeedbackQuestion[] }) {
  const { data, mutate } = useSWR<{ questions: FeedbackQuestion[] }>(
    '/api/admin/feedback-questions', fetcher,
    { fallbackData: { questions: initialQuestions } }
  );
  const questions = data?.questions ?? initialQuestions;

  const [tab, setTab]             = useState<'responses' | 'questions'>('responses');
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  async function save(form: typeof EMPTY_FORM & { id?: number }) {
    setSaving(true);
    await fetch('/api/admin/feedback-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        options: (() => {
          if (form.type === 'rating_group' && form.options)
            return JSON.stringify(form.options.split('\n').map(s => s.trim()).filter(Boolean));
          if ((form.type === 'choice' || form.type === 'multiselect') && form.options)
            return JSON.stringify([
              ...form.options.split(',').map(s => s.trim()).filter(Boolean),
              ...(form.allowOther ? ['__other__'] : []),
            ]);
          return null;
        })(),
        required: form.required ? 1 : 0,
        active:   form.active   ? 1 : 0,
      }),
    });
    await mutate();
    setSaving(false);
    setAdding(false);
    setEditingId(null);
  }

  async function del(id: number) {
    setDelConfirm(null);
    await fetch('/api/admin/feedback-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    await mutate();
  }

  async function move(id: number, dir: -1 | 1) {
    const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(q => q.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    await fetch('/api/admin/feedback-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', ids: sorted.map(q => q.id) }),
    });
    await mutate();
  }

  async function toggleActive(q: FeedbackQuestion) {
    await fetch('/api/admin/feedback-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, title: q.title, subtitle: q.subtitle, type: q.type,
        options: q.options, required: q.required, sort_order: q.sort_order, active: q.active ? 0 : 1 }),
    });
    await mutate();
  }

  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
        {(['responses', 'questions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition capitalize ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t === 'questions' ? '⚙️ Manage Questions' : '📋 Responses'}</button>
        ))}
      </div>

      {/* ── Responses tab ── */}
      {tab === 'responses' && <ResponsesTab questions={questions} />}

      {/* ── Questions tab ── */}
      {tab === 'questions' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-medium px-0.5">
            Configure what employees see on the feedback form. Changes apply immediately.
          </p>

          {sorted.map((q, idx) => {
            const meta = TYPE_META[q.type as FeedbackQuestionType] ?? TYPE_META.text;
            const isEditing = editingId === q.id;
            return (
              <div key={q.id} className={`bg-white border rounded-2xl overflow-hidden transition ${
                q.active ? 'border-slate-200' : 'border-slate-100 opacity-60'
              }`}>
                {isEditing ? (
                  <div className="p-4">
                    <QuestionForm
                      initial={{
                        id: q.id, title: q.title, subtitle: q.subtitle ?? '',
                        type: q.type as FeedbackQuestionType,
                        options: q.options
                          ? q.type === 'rating_group'
                            ? (JSON.parse(q.options) as string[]).join('\n')
                            : (JSON.parse(q.options) as string[]).filter(o => o !== '__other__').join(', ')
                          : '',
                        allowOther: (q.type === 'choice' || q.type === 'multiselect') && q.options
                          ? (JSON.parse(q.options) as string[]).includes('__other__')
                          : false,
                        required: q.required === 1, active: q.active === 1,
                      }}
                      onSave={save} onCancel={() => setEditingId(null)} saving={saving}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={() => move(q.id, -1)} disabled={idx === 0}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-20 transition">
                        <ChevronUp size={13}/>
                      </button>
                      <button onClick={() => move(q.id, 1)} disabled={idx === sorted.length - 1}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-20 transition">
                        <ChevronDown size={13}/>
                      </button>
                    </div>

                    {/* Type badge */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}18`, color: meta.color }}>
                      {meta.icon}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{q.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {meta.label}
                        {q.required === 1 && <span className="ml-1 text-red-400 font-semibold">· Required</span>}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => toggleActive(q)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-slate-100"
                        title={q.active ? 'Hide from form' : 'Show on form'}>
                        {q.active ? <Eye size={14} className="text-green-600"/> : <EyeOff size={14} className="text-slate-400"/>}
                      </button>
                      <button onClick={() => { setEditingId(q.id); setAdding(false); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition text-slate-500">
                        ✏️
                      </button>
                      {delConfirm === q.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => del(q.id)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-500 text-white hover:bg-red-600 transition">
                            Delete
                          </button>
                          <button onClick={() => setDelConfirm(null)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDelConfirm(q.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition text-red-400">
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {adding ? (
            <QuestionForm
              initial={{ ...EMPTY_FORM }}
              onSave={save} onCancel={() => setAdding(false)} saving={saving}
            />
          ) : (
            <button onClick={() => { setAdding(true); setEditingId(null); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-500 transition text-sm font-semibold">
              <Plus size={16}/> Add Question
            </button>
          )}
        </div>
      )}
    </div>
  );
}
