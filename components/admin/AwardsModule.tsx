'use client';

import { useState } from 'react';
import type { AwardCategory, AwardNominee } from '@/lib/db';

interface Props { initial: AwardCategory[] }

export default function AdminAwardsModule({ initial }: Props) {
  const [cats, setCats] = useState<AwardCategory[]>(initial);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [nomineeInputs, setNomineeInputs] = useState<Record<number, { name: string; dept: string }>>({});

  async function api(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch('/api/awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    return res.json();
  }

  async function refresh() {
    const d = await fetch('/api/awards').then(r => r.json());
    setCats(d.categories ?? []);
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    await api('create_category', { name: newCatName.trim(), description: newCatDesc.trim() || null, sort_order: cats.length });
    setNewCatName(''); setNewCatDesc('');
    await refresh();
  }

  async function deleteCategory(id: number) {
    if (!confirm('Delete this category and all its nominees?')) return;
    await api('delete_category', { id });
    await refresh();
  }

  async function addNominee(catId: number) {
    const inp = nomineeInputs[catId];
    if (!inp?.name?.trim()) return;
    await api('add_nominee', { category_id: catId, name: inp.name.trim(), department: inp.dept?.trim() || null });
    setNomineeInputs(prev => ({ ...prev, [catId]: { name: '', dept: '' } }));
    await refresh();
  }

  async function deleteNominee(id: number) {
    await api('delete_nominee', { id });
    await refresh();
  }

  async function announceWinner(catId: number, nomineeId: number) {
    await api('announce_winner', { category_id: catId, nominee_id: nomineeId });
    await refresh();
  }

  async function clearWinner(catId: number) {
    await api('clear_winner', { category_id: catId });
    await refresh();
  }

  return (
    <div className="space-y-6">
      {/* Create category */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h3 className="font-extrabold text-slate-700 mb-3">New Award Category</h3>
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Category name (e.g. Best Team Player)"
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Description (optional)"
          value={newCatDesc}
          onChange={e => setNewCatDesc(e.target.value)}
        />
        <button
          onClick={createCategory}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm active:scale-95 transition-transform"
        >
          + Add Category
        </button>
      </div>

      {/* Categories */}
      {cats.map(cat => (
        <div key={cat.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setExpanded(prev => prev === cat.id ? null : cat.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="text-xl">{cat.winner ? '🏆' : '🏅'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800">{cat.name}</p>
              {cat.description && <p className="text-xs text-slate-400 truncate">{cat.description}</p>}
            </div>
            {cat.winner && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Winner set</span>}
            <span className="text-slate-400">{expanded === cat.id ? '▲' : '▼'}</span>
          </button>

          {expanded === cat.id && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
              {/* Nominees */}
              <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">Nominees</p>
                {(cat.nominees ?? []).length === 0 && (
                  <p className="text-sm text-slate-400">No nominees yet</p>
                )}
                {(cat.nominees ?? []).map((n: AwardNominee) => (
                  <div key={n.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-700">{n.name}</p>
                      {n.department && <p className="text-xs text-slate-400">{n.department}</p>}
                    </div>
                    {cat.winner?.id === n.id ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Winner 🏆</span>
                    ) : (
                      <button
                        onClick={() => announceWinner(cat.id, n.id)}
                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-bold hover:bg-green-100"
                      >
                        Set as Winner
                      </button>
                    )}
                    <button
                      onClick={() => deleteNominee(n.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-1.5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add nominee */}
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Name"
                  value={nomineeInputs[cat.id]?.name ?? ''}
                  onChange={e => setNomineeInputs(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], name: e.target.value } }))}
                />
                <input
                  className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Dept"
                  value={nomineeInputs[cat.id]?.dept ?? ''}
                  onChange={e => setNomineeInputs(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], dept: e.target.value } }))}
                />
                <button
                  onClick={() => addNominee(cat.id)}
                  className="px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold shrink-0"
                >
                  +
                </button>
              </div>

              {/* Clear winner */}
              {cat.winner && (
                <button onClick={() => clearWinner(cat.id)} className="text-xs text-amber-600 hover:text-amber-800 font-semibold">
                  Clear winner
                </button>
              )}

              {/* Delete category */}
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold"
              >
                Delete category
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
