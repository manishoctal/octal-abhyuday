'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X, Trophy, Medal, Plus, Trash2, Crown } from 'lucide-react';
import type { AwardCategory, AwardNominee } from '@/lib/db';

interface Employee { id: number; name: string; email: string; department: string | null; profile_photo_url: string | null }
interface Props { initial: AwardCategory[] }

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt="" className={`${sz} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0`}
      style={{ background: 'linear-gradient(135deg,#FE9234,#F97316)' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function EmployeePicker({ employees, onSelect, excluded }: {
  employees: Employee[];
  onSelect: (e: Employee) => void;
  excluded: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const filtered = employees
    .filter(e => !excluded.includes(e.name))
    .filter(e =>
      !query ||
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.department ?? '').toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-white cursor-text"
        onClick={() => setOpen(true)}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
          placeholder="Search employee by name or dept…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {filtered.map(emp => (
            <button
              key={emp.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 text-left transition-colors"
              onMouseDown={e => { e.preventDefault(); onSelect(emp); setQuery(''); setOpen(false); }}
            >
              <Avatar name={emp.name} url={emp.profile_photo_url} size={8} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                {emp.department && <p className="text-xs text-slate-400 truncate">{emp.department}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm text-slate-400">
          No employees found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

export default function AdminAwardsModule({ initial }: Props) {
  const [cats, setCats]         = useState<AwardCategory[]>(initial);
  const [employees, setEmp]     = useState<Employee[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState('');

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setEmp(d.users ?? []));
  }, []);

  async function api(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch('/api/awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      return data;
    } catch {
      throw new Error(`Awards API error (${res.status}): ${text.slice(0, 200) || 'empty response'}`);
    }
  }

  async function refresh() {
    const d = await fetch('/api/awards').then(r => r.json());
    setCats(d.categories ?? []);
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    setSaving(true);
    await api('create_category', { name: newCatName.trim(), description: newCatDesc.trim() || null, sort_order: cats.length });
    setNewCatName(''); setNewCatDesc('');
    await refresh();
    setSaving(false);
  }

  async function deleteCategory(id: number) {
    if (!confirm('Delete this category and all its nominees?')) return;
    await api('delete_category', { id });
    await refresh();
  }

  async function addNominee(catId: number, emp: Employee) {
    await api('add_nominee', {
      category_id: catId,
      name: emp.name,
      department: emp.department ?? null,
      image_url: emp.profile_photo_url ?? null,
    });
    await refresh();
  }

  async function deleteNominee(id: number) {
    await api('delete_nominee', { id });
    await refresh();
  }

  async function announceWinner(catId: number, nomineeId: number) {
    try {
      await api('announce_winner', { category_id: catId, nominee_id: nomineeId });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set winner');
      setTimeout(() => setError(''), 5000);
    }
  }

  async function clearWinner(catId: number) {
    try {
      await api('clear_winner', { category_id: catId });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear winner');
      setTimeout(() => setError(''), 5000);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">
          ⚠️ {error}
        </div>
      )}
      {/* Create category */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Plus size={16} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-slate-800">New Award Category</h3>
        </div>
        <div className="space-y-2.5">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
            placeholder="Category name (e.g. Best Team Player)"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCategory()}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
            placeholder="Description (optional)"
            value={newCatDesc}
            onChange={e => setNewCatDesc(e.target.value)}
          />
          <button
            onClick={createCategory}
            disabled={saving || !newCatName.trim()}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#FE9234,#F97316)' }}
          >
            {saving ? 'Adding…' : 'Add Category'}
          </button>
        </div>
      </div>

      {cats.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <div className="text-4xl mb-3">🏅</div>
          <p className="font-semibold">No categories yet</p>
          <p className="text-sm mt-1">Add your first award category above</p>
        </div>
      )}

      {/* Category cards */}
      {cats.map(cat => {
        const isOpen = expanded === cat.id;
        const nominees: AwardNominee[] = cat.nominees ?? [];
        const excludedNames = nominees.map(n => n.name);
        return (
          <div key={cat.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Category header */}
            <button
              onClick={() => setExpanded(prev => prev === cat.id ? null : cat.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${cat.winner ? 'bg-amber-50' : 'bg-slate-100'}`}>
                {cat.winner ? '🏆' : '🏅'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{cat.name}</p>
                {cat.description && <p className="text-xs text-slate-400 truncate">{cat.description}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{nominees.length} nominee{nominees.length !== 1 ? 's' : ''}</p>
              </div>
              {cat.winner && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold shrink-0">
                  🏆 Winner set
                </span>
              )}
              <span className="text-slate-300 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-5 pt-4 space-y-5">

                {/* Winner banner */}
                {cat.winner && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)' }}>
                    <Crown size={18} className="text-amber-500 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar name={cat.winner.name} url={cat.winner.image_url} size={8} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Current Winner</p>
                        <p className="font-bold text-slate-900 truncate">{cat.winner.name}</p>
                      </div>
                    </div>
                    <button onClick={() => clearWinner(cat.id)} className="text-xs text-amber-600 hover:text-red-600 font-semibold shrink-0">
                      Clear
                    </button>
                  </div>
                )}

                {/* Nominees */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                    Nominees ({nominees.length})
                  </p>
                  {nominees.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No nominees yet — search to add below</p>
                  ) : (
                    <div className="space-y-2">
                      {nominees.map((n: AwardNominee) => (
                        <div key={n.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            cat.winner?.id === n.id
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <Avatar name={n.name} url={n.image_url} size={10} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">{n.name}</p>
                            {n.department && <p className="text-xs text-slate-400">{n.department}</p>}
                          </div>
                          {cat.winner?.id === n.id ? (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold shrink-0">Winner 🏆</span>
                          ) : (
                            <button
                              onClick={() => announceWinner(cat.id, n.id)}
                              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors shrink-0"
                            >
                              <Trophy size={11} />
                              Set Winner
                            </button>
                          )}
                          <button
                            onClick={() => deleteNominee(n.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add nominee by searching employees */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Add Nominee
                  </p>
                  {employees.length === 0 ? (
                    <p className="text-sm text-slate-400">No employees found. Employees appear here after they log in.</p>
                  ) : (
                    <EmployeePicker
                      employees={employees}
                      onSelect={emp => addNominee(cat.id, emp)}
                      excluded={excludedNames}
                    />
                  )}
                </div>

                {/* Delete category */}
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-semibold transition-colors"
                >
                  <Trash2 size={12} />
                  Delete category
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
