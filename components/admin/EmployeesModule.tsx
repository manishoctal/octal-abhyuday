'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Camera, X, Check, UserCheck, UserX, ScanFace, Vote } from 'lucide-react';
import type { Employee } from '@/lib/db';

type EmployeeWithFace = Employee & { face_indexed: boolean };

/* ── XHR PUT for S3 presigned upload ── */
function xhrPut(url: string, file: File, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

function Avatar({ name, url, size = 10 }: { name: string; url?: string | null; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt="" className={`${sz} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0`}
      style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface FormState {
  employee_code: string;
  name: string;
  email: string;
  department: string;
  gender: 'male' | 'female' | '';
  profile_photo_url: string;
  is_active: boolean;
  exclude_from_voting: boolean;
}

const EMPTY: FormState = {
  employee_code: '', name: '', email: '', department: '',
  gender: '', profile_photo_url: '', is_active: true, exclude_from_voting: false,
};

function EmployeeForm({
  initial, onSave, onCancel, uploading, setUploading,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof FormState, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    setUploading(true);
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'image/jpeg', context: 'employee' }),
      });
      if (!presignRes.ok) throw new Error('Failed to get upload URL');
      const { presignedUrl, publicUrl } = await presignRes.json();
      await xhrPut(presignedUrl, file, file.type || 'image/jpeg', pct => setUploadProgress(pct));
      set('profile_photo_url', publicUrl);
      setUploadProgress(100);
    } catch (err) {
      alert('Image upload failed: ' + (err as Error).message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={form.name || '?'} url={form.profile_photo_url} size={14} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow"
            style={{ background: '#FE9234' }}>
            <Camera size={11} color="white" />
          </button>
        </div>
        <div className="flex-1">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="text-sm font-semibold" style={{ color: '#FF7A00' }}>
            {form.profile_photo_url ? 'Change photo' : 'Upload photo'} (S3)
          </button>
          {uploadProgress !== null && (
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 mt-1.5">
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%`, background: uploadProgress >= 100 ? '#22C55E' : '#FF7A00' }} />
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Employee Code *</label>
          <input value={form.employee_code} onChange={e => set('employee_code', e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="e.g. 1423" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white">
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Full Name *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="Manish Prajapati" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Email *</label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="manish@octalsoftware.com" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
        <input value={form.department} onChange={e => set('department', e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="Engineering" />
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => set('is_active', !form.is_active)}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-green-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">Active (can log in)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => set('exclude_from_voting', !form.exclude_from_voting)}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.exclude_from_voting ? 'bg-red-400' : 'bg-green-500'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.exclude_from_voting ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">
            {form.exclude_from_voting ? 'Excluded from popularity voting' : 'Included in popularity voting'}
          </span>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onSave(form)} disabled={uploading}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
          {uploading ? 'Uploading…' : 'Save Employee'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FilterGroup({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pr-1">{label}</span>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
            value === opt.value
              ? 'bg-orange-500 text-white'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function EmployeesModule({ initial }: { initial: EmployeeWithFace[] }) {
  const [employees, setEmployees] = useState<EmployeeWithFace[]>(initial);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'unset'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [votingFilter, setVotingFilter] = useState<'all' | 'included' | 'excluded'>('all');
  const [faceFilter, setFaceFilter] = useState<'all' | 'indexed' | 'missing'>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/employees');
    if (!res.ok) return; // don't wipe list on auth error or server error
    const d = await res.json();
    if (Array.isArray(d.employees)) setEmployees(d.employees);
  }

  async function api(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Request failed');
    return data;
  }

  async function handleCreate(form: FormState) {
    setError('');
    if (!form.employee_code.trim() || !form.name.trim() || !form.email.trim()) {
      setError('Employee code, name, and email are required.'); return;
    }
    setSaving(true);
    try {
      await api({ action: 'create', ...form, gender: form.gender || null });
      await refresh();
      setAdding(false);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleUpdate(id: number, form: FormState) {
    setError('');
    setSaving(true);
    try {
      await api({ action: 'update', id, ...form, gender: form.gender || null });
      await refresh();
      setEditing(null);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove "${name}" from the employee roster?\nThey will no longer be able to log in.`)) return;
    await api({ action: 'delete', id });
    await refresh();
  }

  async function toggleActive(emp: Employee) {
    await api({
      action: 'update', id: emp.id,
      employee_code: emp.employee_code, name: emp.name, email: emp.email,
      department: emp.department, gender: emp.gender,
      profile_photo_url: emp.profile_photo_url, is_active: emp.is_active ? 0 : 1,
      exclude_from_voting: emp.exclude_from_voting,
    });
    await refresh();
  }

  async function toggleVoting(emp: Employee) {
    await api({
      action: 'update', id: emp.id,
      employee_code: emp.employee_code, name: emp.name, email: emp.email,
      department: emp.department, gender: emp.gender,
      profile_photo_url: emp.profile_photo_url, is_active: emp.is_active,
      exclude_from_voting: emp.exclude_from_voting ? 0 : 1,
    });
    await refresh();
  }

  const filtered = employees.filter(e => {
    if (genderFilter === 'male'   && e.gender !== 'male')   return false;
    if (genderFilter === 'female' && e.gender !== 'female') return false;
    if (genderFilter === 'unset'  && e.gender != null)      return false;
    if (statusFilter === 'active'   && !e.is_active)  return false;
    if (statusFilter === 'inactive' && e.is_active)   return false;
    if (votingFilter === 'included' && e.exclude_from_voting)  return false;
    if (votingFilter === 'excluded' && !e.exclude_from_voting) return false;
    if (faceFilter === 'indexed' && !e.face_indexed) return false;
    if (faceFilter === 'missing' && e.face_indexed)  return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex gap-2.5">
        <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
            placeholder="Search by name, code, email, department…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditing(null); setError(''); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
            <Plus size={15} /> Add
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterGroup
          label="Gender"
          value={genderFilter}
          onChange={v => setGenderFilter(v as typeof genderFilter)}
          options={[
            { value: 'all',    label: 'All genders' },
            { value: 'male',   label: '🤵 Male' },
            { value: 'female', label: '👸 Female' },
            { value: 'unset',  label: '⚠️ Not set' },
          ]}
        />
        <FilterGroup
          label="Status"
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'all',      label: 'All' },
            { value: 'active',   label: '✅ Active' },
            { value: 'inactive', label: '🚫 Inactive' },
          ]}
        />
        <FilterGroup
          label="Voting"
          value={votingFilter}
          onChange={v => setVotingFilter(v as typeof votingFilter)}
          options={[
            { value: 'all',      label: 'All' },
            { value: 'included', label: '🗳️ In voting' },
            { value: 'excluded', label: '🚷 Excluded' },
          ]}
        />
        <FilterGroup
          label="Face"
          value={faceFilter}
          onChange={v => setFaceFilter(v as typeof faceFilter)}
          options={[
            { value: 'all',     label: 'All' },
            { value: 'indexed', label: '✅ Face indexed' },
            { value: 'missing', label: '❌ No face' },
          ]}
        />
        {(genderFilter !== 'all' || statusFilter !== 'all' || votingFilter !== 'all' || faceFilter !== 'all' || search) && (
          <button
            onClick={() => { setGenderFilter('all'); setStatusFilter('all'); setVotingFilter('all'); setFaceFilter('all'); setSearch(''); }}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            Clear all
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-white border border-orange-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={16} className="text-orange-500" /> New Employee
          </h3>
          <EmployeeForm
            initial={EMPTY}
            onSave={handleCreate}
            onCancel={() => { setAdding(false); setError(''); }}
            uploading={uploading}
            setUploading={setUploading}
          />
        </div>
      )}

      {/* Count */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-0.5">
        {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ` total`}
      </p>

      {/* Employee list */}
      {filtered.length === 0 && !adding && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-semibold">No employees yet</p>
          <p className="text-sm mt-1">Add employees so they can log in to the app</p>
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map(emp => (
          <div key={emp.id}
            className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all ${
              editing === emp.id ? 'border-orange-300' : 'border-slate-200'
            }`}>
            {editing === emp.id ? (
              <div className="p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Pencil size={14} className="text-orange-500" /> Edit — {emp.name}
                </h3>
                <EmployeeForm
                  initial={{
                    employee_code: emp.employee_code,
                    name: emp.name,
                    email: emp.email,
                    department: emp.department ?? '',
                    gender: (emp.gender as 'male' | 'female' | '') ?? '',
                    profile_photo_url: emp.profile_photo_url ?? '',
                    is_active: !!emp.is_active,
                    exclude_from_voting: !!emp.exclude_from_voting,
                  }}
                  onSave={form => handleUpdate(emp.id, form)}
                  onCancel={() => { setEditing(null); setError(''); }}
                  uploading={uploading}
                  setUploading={setUploading}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar name={emp.name} url={emp.profile_photo_url} size={11} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      #{emp.employee_code}
                    </span>
                    {emp.gender && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        emp.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                      }`}>{emp.gender}</span>
                    )}
                    {!emp.is_active && (
                      <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">inactive</span>
                    )}
                    {!!emp.exclude_from_voting && (
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-500 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Vote size={10} />no vote
                      </span>
                    )}
                    {emp.face_indexed ? (
                      <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <ScanFace size={10} />indexed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <ScanFace size={10} />no face
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                  {emp.department && <p className="text-xs text-slate-400 truncate">{emp.department}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleVoting(emp)}
                    title={emp.exclude_from_voting ? 'Include in voting' : 'Exclude from voting'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-50">
                    <Vote size={15} className={emp.exclude_from_voting ? 'text-purple-400' : 'text-slate-300'} />
                  </button>
                  <button onClick={() => toggleActive(emp)}
                    title={emp.is_active ? 'Deactivate' : 'Activate'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-50">
                    {emp.is_active
                      ? <UserCheck size={15} className="text-green-500" />
                      : <UserX size={15} className="text-slate-400" />}
                  </button>
                  <button onClick={() => { setEditing(emp.id); setAdding(false); setError(''); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-orange-50 transition-colors">
                    <Pencil size={14} className="text-slate-400 hover:text-orange-500" />
                  </button>
                  <button onClick={() => handleDelete(emp.id, emp.name)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                    <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
