'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hotel, Plus, Trash2, X, Users, Download, Upload, CheckCircle2,
  Loader2, AlertTriangle, Search, UserPlus, FileImage, Eye, ScanLine, Pencil, Check,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */
interface Occupant { id: number; name: string; employee_code: string; profile_photo_url: string | null }
interface Room     { id: number; room_number: string; notes: string | null; employees: Occupant[] }
interface Employee { id: number; name: string; employee_code: string; department: string | null; profile_photo_url: string | null }
interface AadharRow {
  employee_id: number; name: string; employee_code: string; department: string | null;
  profile_photo_url: string | null; room_number: string | null;
  front_url: string | null; back_url: string | null; uploaded_at: string | null;
}

/* ─── Small helpers ──────────────────────────────────────── */
function Avatar({ url, name, size = 8 }: { url: string | null; name: string; size?: number }) {
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover shrink-0`} />
  );
  return (
    <div className={`w-${size} h-${size} rounded-full bg-brand-100 flex items-center justify-center shrink-0 text-brand-600 font-bold text-xs`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

/* ─── Aadhar upload modal ────────────────────────────────── */
function AadharUploadModal({
  emp, useS3, onClose, onSaved,
}: { emp: AadharRow; useS3: boolean; onClose: () => void; onSaved: () => void }) {
  const [front, setFront]         = useState<File | null>(null);
  const [back, setBack]           = useState<File | null>(null);
  const [frontPrev, setFrontPrev] = useState<string | null>(emp.front_url);
  const [backPrev, setBackPrev]   = useState<string | null>(emp.back_url);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef  = useRef<HTMLInputElement>(null);

  function pickFile(file: File | null, side: 'front' | 'back') {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') { setFront(file); setFrontPrev(url); }
    else                  { setBack(file);  setBackPrev(url);  }
  }

  async function save() {
    if (!front && !back && frontPrev === emp.front_url && backPrev === emp.back_url) { onClose(); return; }
    setSaving(true); setErr('');
    try {
      if (useS3) {
        const uploadS3 = async (file: File | null, side: 'front' | 'back'): Promise<string | null> => {
          if (!file) return null;
          const pr = await fetch('/api/admin/aadhar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type, employee_id: emp.employee_id, side }),
          });
          if (!pr.ok) throw new Error('Presign failed');
          const { presignedUrl, publicUrl } = await pr.json();
          const up = await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          if (!up.ok) throw new Error('S3 upload failed');
          return publicUrl;
        };
        const [fu, bu] = await Promise.all([uploadS3(front, 'front'), uploadS3(back, 'back')]);
        await fetch('/api/admin/aadhar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: emp.employee_id, front_url: fu, back_url: bu }),
        });
      } else {
        const fd = new FormData();
        fd.append('employee_id', String(emp.employee_id));
        if (front) fd.append('front', front);
        if (back)  fd.append('back', back);
        const res = await fetch('/api/admin/aadhar', { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Upload failed'); }
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally { setSaving(false); }
  }

  function DropZone({ side, preview, fileRef }: { side: 'front' | 'back'; preview: string | null; fileRef: React.RefObject<HTMLInputElement> }) {
    const [drag, setDrag] = useState(false);
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {side === 'front' ? '🪪 Front Side' : '🔁 Back Side'}
        </p>
        <div
          className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-all cursor-pointer ${drag ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-400'}`}
          style={{ minHeight: 140 }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0] ?? null, side); }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={side} className="w-full h-36 object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center h-36 gap-2 text-slate-400">
              <FileImage size={28} strokeWidth={1.2} />
              <p className="text-xs font-semibold">{drag ? 'Drop here' : 'Click or drag to upload'}</p>
            </div>
          )}
          {preview && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <p className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full">Replace</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { pickFile(e.target.files?.[0] ?? null, side); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <ScanLine size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900">{emp.name}</p>
            <p className="text-xs text-slate-400">{emp.employee_code}{emp.room_number ? ` · Room ${emp.room_number}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DropZone side="front" preview={frontPrev} fileRef={frontRef} />
            <DropZone side="back"  preview={backPrev}  fileRef={backRef}  />
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> {err}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><CheckCircle2 size={14} />Save Aadhar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── View Aadhar modal ──────────────────────────────────── */
function AadharViewModal({ emp, onClose }: { emp: AadharRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <Avatar url={emp.profile_photo_url} name={emp.name} size={9} />
          <div>
            <p className="font-extrabold text-slate-900">{emp.name}</p>
            <p className="text-xs text-slate-400">{emp.employee_code}{emp.room_number ? ` · Room ${emp.room_number}` : ''}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[{ label: '🪪 Front', url: emp.front_url }, { label: '🔁 Back', url: emp.back_url }].map(({ label, url }) => (
            <div key={label} className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              {url
                ? /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt={label} className="w-full rounded-xl border border-slate-100 object-cover" />
                : <div className="h-40 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm">Not uploaded</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Add-member search popup ────────────────────────────── */
function AddMemberPopup({
  roomId, allEmployees, occupantIds, onAdd, onClose,
}: { roomId: number; allEmployees: Employee[]; occupantIds: Set<number>; onAdd: (emp: Employee) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState<number | null>(null);
  const unassigned = allEmployees.filter(e =>
    !occupantIds.has(e.id) &&
    (e.name.toLowerCase().includes(q.toLowerCase()) || e.employee_code.toLowerCase().includes(q.toLowerCase()))
  );

  async function assign(emp: Employee) {
    setAdding(emp.id);
    await fetch('/api/admin/rooms/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, employee_id: emp.id }),
    });
    onAdd(emp);
    setAdding(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Search size={14} className="text-slate-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search employee…"
            className="flex-1 text-sm outline-none text-slate-800 placeholder:text-slate-400" />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700"><X size={14} /></button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
          {unassigned.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No unassigned employees{q ? ' matching search' : ''}</p>
          )}
          {unassigned.map(emp => (
            <button key={emp.id} onClick={() => assign(emp)}
              disabled={adding === emp.id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left disabled:opacity-50">
              <Avatar url={emp.profile_photo_url} name={emp.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                <p className="text-xs text-slate-400">{emp.employee_code}{emp.department ? ` · ${emp.department}` : ''}</p>
              </div>
              {adding === emp.id ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <UserPlus size={14} className="text-slate-300" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Room card ──────────────────────────────────────────── */
function RoomCard({
  room, allEmployees, onRefresh,
}: { room: Room; allEmployees: Employee[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editNum, setEditNum]   = useState(room.room_number);
  const [editNotes, setEditNotes] = useState(room.notes ?? '');
  const [saving, setSaving]     = useState(false);

  const occupantIds = new Set(room.employees.map(e => e.id));

  async function remove(emp: Occupant) {
    setRemoving(emp.id);
    await fetch('/api/admin/rooms/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: emp.id }),
    });
    setRemoving(null);
    onRefresh();
  }

  async function deleteRoom() {
    if (!confirm(`Delete Room ${room.room_number}? All assignments will be removed.`)) return;
    setDeleting(true);
    await fetch('/api/admin/rooms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: room.id }),
    });
    onRefresh();
  }

  async function saveEdit() {
    if (!editNum.trim()) return;
    setSaving(true);
    await fetch('/api/admin/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: room.id, room_number: editNum.trim(), notes: editNotes.trim() || null }),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  function cancelEdit() {
    setEditNum(room.room_number);
    setEditNotes(room.notes ?? '');
    setEditing(false);
  }

  return (
    <>
      {showAdd && (
        <AddMemberPopup
          roomId={room.id}
          allEmployees={allEmployees}
          occupantIds={occupantIds}
          onAdd={() => onRefresh()}
          onClose={() => setShowAdd(false)}
        />
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-orange-400 flex items-center justify-center shadow-sm shrink-0">
            <Hotel size={18} className="text-white" />
          </div>
          {editing ? (
            <div className="flex-1 min-w-0 space-y-1">
              <input
                value={editNum}
                onChange={e => setEditNum(e.target.value)}
                placeholder="Room number"
                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <input
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-slate-900">Room {room.room_number}</p>
              {room.notes && <p className="text-xs text-slate-400 truncate">{room.notes}</p>}
            </div>
          )}
          {editing ? (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={saveEdit} disabled={saving || !editNum.trim()}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition disabled:opacity-40">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={cancelEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition">
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                {room.employees.length} / 3
              </span>
              <button onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-brand-500 hover:bg-brand-50 transition">
                <Pencil size={13} />
              </button>
              <button onClick={deleteRoom} disabled={deleting}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </>
          )}
        </div>

        {/* Occupants */}
        <div className="p-4 space-y-2">
          {room.employees.map(emp => (
            <div key={emp.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
              <Avatar url={emp.profile_photo_url} name={emp.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{emp.name}</p>
                <p className="text-xs text-slate-400">{emp.employee_code}</p>
              </div>
              <button onClick={() => remove(emp)} disabled={removing === emp.id}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 transition disabled:opacity-40">
                {removing === emp.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              </button>
            </div>
          ))}

          {room.employees.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">No one assigned yet</p>
          )}

          {room.employees.length < 3 && (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-200 rounded-xl py-2.5 text-xs font-semibold text-slate-400 hover:border-brand-300 hover:text-brand-500 transition">
              <UserPlus size={13} /> Add Person
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Rooms Tab ──────────────────────────────────────────── */
function RoomsTab({ useS3 }: { useS3: boolean }) {
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [roomNum, setRoomNum]       = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  useS3; // acknowledged — not used in rooms tab but passed for future

  async function load() {
    setLoading(true);
    const [r, e] = await Promise.all([
      fetch('/api/admin/rooms').then(r => r.json()),
      fetch('/api/admin/employees').then(r => r.json()),
    ]);
    setRooms(r.rooms ?? []);
    setEmployees(e.employees ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createRoom() {
    if (!roomNum.trim()) return;
    setSaving(true); setErr('');
    const res = await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number: roomNum.trim(), notes: notes.trim() || undefined }),
    });
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Failed'); setSaving(false); return; }
    setRoomNum(''); setNotes(''); setCreating(false);
    await load();
    setSaving(false);
  }

  const unassignedCount = employees.filter(e => !rooms.some(r => r.employees.some(o => o.id === e.id))).length;

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
      {/* Sidebar */}
      <div className="space-y-4 lg:sticky lg:top-6">
        {/* Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Summary</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Rooms', value: rooms.length, icon: '🏨' },
              { label: 'Assigned', value: rooms.reduce((n, r) => n + r.employees.length, 0), icon: '✅' },
              { label: 'Unassigned', value: unassignedCount, icon: '⏳' },
              { label: 'Employees', value: employees.length, icon: '👥' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg">{s.icon}</p>
                <p className="font-extrabold text-slate-900 text-lg leading-none mt-1">{s.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add room form */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button onClick={() => setCreating(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition">
            <Plus size={15} className="text-brand-500" />
            <span className="font-bold text-slate-900 text-sm">Add Room</span>
          </button>
          {creating && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Room Number *</label>
                <input
                  value={roomNum} onChange={e => setRoomNum(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  placeholder="e.g. 101, 205A"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Notes (optional)</label>
                <input
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Floor, wing, etc."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              {err && <p className="text-xs text-red-500">{err}</p>}
              <button onClick={createRoom} disabled={saving || !roomNum.trim()}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#FE9234,#FF6B35)' }}>
                {saving ? <><Loader2 size={13} className="animate-spin" />Creating…</> : <><Plus size={13} />Create Room</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Room grid */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <Hotel size={40} strokeWidth={1} className="mb-3" />
            <p className="font-bold text-slate-600">No rooms yet</p>
            <p className="text-sm mt-1">Add your first room using the panel on the left</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rooms.map(room => (
              <RoomCard key={room.id} room={room} allEmployees={employees} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Aadhar Tab ─────────────────────────────────────────── */
function AadharTab({ useS3 }: { useS3: boolean }) {
  const [cards, setCards]           = useState<AadharRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState<AadharRow | null>(null);
  const [viewing, setViewing]       = useState<AadharRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [q, setQ]                   = useState('');
  const [roomFilter, setRoomFilter] = useState('');

  async function load() {
    setLoading(true);
    const d = await fetch('/api/admin/aadhar').then(r => r.json());
    setCards(d.cards ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadZip() {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/aadhar/zip', { method: 'POST' });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `aadhar-cards-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setDownloading(false); }
  }

  const rooms = Array.from(new Set(cards.map(c => c.room_number).filter(Boolean) as string[])).sort();
  const filtered = cards.filter(c =>
    (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.employee_code.toLowerCase().includes(q.toLowerCase())) &&
    (!roomFilter || c.room_number === roomFilter)
  );

  const uploaded   = cards.filter(c => c.front_url || c.back_url).length;
  const complete   = cards.filter(c => c.front_url && c.back_url).length;
  const missing    = cards.length - uploaded;

  return (
    <>
      {uploading && <AadharUploadModal emp={uploading} useS3={useS3} onClose={() => setUploading(null)} onSaved={load} />}
      {viewing   && <AadharViewModal  emp={viewing}   onClose={() => setViewing(null)}  />}

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee…"
              className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400" />
          </div>
          {rooms.length > 0 && (
            <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none">
              <option value="">All rooms</option>
              {rooms.map(r => <option key={r} value={r}>Room {r}</option>)}
              <option value="">Unassigned</option>
            </select>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2 shrink-0">
            <CheckCircle2 size={12} className="text-green-500" /> {complete} complete
            <span className="text-slate-300">·</span>
            <AlertTriangle size={12} className="text-amber-500" /> {missing} missing
          </div>
          <button onClick={downloadZip} disabled={downloading || uploaded === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 shrink-0"
            style={{ background: 'linear-gradient(135deg,#0F172A,#334155)' }}>
            {downloading ? <><Loader2 size={13} className="animate-spin" />Zipping…</> : <><Download size={13} />Download ZIP</>}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Room</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Front</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Back</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No employees found</td></tr>
                  )}
                  {filtered.map(card => (
                    <tr key={card.employee_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar url={card.profile_photo_url} name={card.name} />
                          <div>
                            <p className="font-semibold text-slate-900">{card.name}</p>
                            <p className="text-xs text-slate-400">{card.employee_code}{card.department ? ` · ${card.department}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {card.room_number
                          ? <span className="text-xs font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Room {card.room_number}</span>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {card.front_url
                          ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          : <span className="text-slate-300 text-lg leading-none">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {card.back_url
                          ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          : <span className="text-slate-300 text-lg leading-none">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(card.front_url || card.back_url) && (
                            <button onClick={() => setViewing(card)}
                              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition">
                              <Eye size={12} /> View
                            </button>
                          )}
                          <button onClick={() => setUploading(card)}
                            className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                            <Upload size={11} />
                            {card.front_url || card.back_url ? 'Update' : 'Upload'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Main module ────────────────────────────────────────── */
export default function RoomsModule({ useS3 }: { useS3: boolean }) {
  const [tab, setTab] = useState<'rooms' | 'aadhar'>('rooms');

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {([
          { key: 'rooms',  label: 'Room Allocation', icon: Hotel    },
          { key: 'aadhar', label: 'Aadhar Cards',     icon: ScanLine },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
              tab === key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'rooms'  && <RoomsTab  useS3={useS3} />}
      {tab === 'aadhar' && <AadharTab useS3={useS3} />}
    </div>
  );
}
