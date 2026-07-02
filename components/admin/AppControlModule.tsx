'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Bell, BellOff, RefreshCw,
  CalendarDays, Trophy, ImageIcon, Vote, MessageSquare, BarChart3,
  QrCode, MapPin, Star, CheckCircle2, AlertTriangle, Wifi, WifiOff,
  ShieldCheck, ShieldPlus, ShieldOff, X, Crown, ChevronUp, ChevronDown, GripVertical,
  Timer, Save, ScanFace,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

/* ── Module metadata ──────────────────────────────────────── */
type ModuleKey = 'schedule'|'awards'|'gallery'|'vote'|'qna'|'leaderboard'|'badge'|'venue'|'feedback';

const MODULE_META: Record<ModuleKey, { label: string; icon: React.ReactNode; color: string }> = {
  schedule:    { label: 'Schedule',    icon: <CalendarDays  size={16}/>, color: '#2563EB' },
  awards:      { label: 'Awards',      icon: <Trophy        size={16}/>, color: '#D97706' },
  gallery:     { label: 'Gallery',     icon: <ImageIcon     size={16}/>, color: '#7C3AED' },
  vote:        { label: 'Vote',        icon: <Vote          size={16}/>, color: '#EA580C' },
  qna:         { label: 'Q&A',         icon: <MessageSquare size={16}/>, color: '#059669' },
  leaderboard: { label: 'Rankings',    icon: <BarChart3     size={16}/>, color: '#DB2777' },
  badge:       { label: 'My Badge',    icon: <QrCode        size={16}/>, color: '#0284C7' },
  venue:       { label: 'Venue',       icon: <MapPin        size={16}/>, color: '#0F766E' },
  feedback:    { label: 'Feedback',    icon: <Star          size={16}/>, color: '#9F1239' },
};

const MODULE_ORDER: ModuleKey[] = ['schedule','awards','gallery','vote','qna','leaderboard','badge','venue','feedback'];

/* ── Reset targets ────────────────────────────────────────── */
interface ResetTarget {
  key: string; label: string; desc: string; color: string;
}
const RESET_TARGETS: ResetTarget[] = [
  { key:'votes',        label:'Voting data',       desc:'All cast votes and vote counts',              color:'#EA580C' },
  { key:'attendance',   label:'Attendance',         desc:'All check-in records',                        color:'#059669' },
  { key:'points',       label:'Points & ranking',   desc:'All earned points and leaderboard scores',    color:'#DB2777' },
  { key:'feedback',     label:'Feedback',           desc:'All submitted event feedback',                color:'#9F1239' },
  { key:'gallery',      label:'Gallery & photos',   desc:'All uploaded photos, tags, and face data',    color:'#7C3AED' },
  { key:'rooms',        label:'Room allocations',   desc:'All employee-room assignments (keeps rooms)', color:'#D97706' },
  { key:'aadhar',       label:'Aadhar cards',       desc:'All uploaded Aadhar card images',             color:'#0284C7' },
  { key:'award_winners',label:'Award winners',      desc:'All declared award winners',                  color:'#D97706' },
  { key:'push_subs',    label:'Push subscriptions', desc:'All device notification registrations',       color:'#6B7280' },
];

/* ── Component ────────────────────────────────────────────── */
interface ConfigData {
  moduleConfig: {
    visibility: Record<ModuleKey, boolean>;
    enabled:    Record<ModuleKey, boolean>;
  };
  moduleOrder: string[];
  pushStats: { web: number; android: number; ios: number; total: number };
  pushConfig: { vapid: boolean; fcm: boolean };
  authConfig: { otp_email_enabled: boolean; smtp_ready: boolean; static_otp_code: string };
  faceSearchEnabled: boolean;
  uploadEnabled: boolean;
}

type AdminEntry = { code: string; name: string | null; department: string | null };
type AdminsData = {
  isRootAdmin: boolean;
  rootAdmin: AdminEntry;
  admins: AdminEntry[];
};

export default function AppControlModule() {
  const { data, mutate }             = useSWR<ConfigData>('/api/admin/app-control', fetcher);
  const { data: adminData, mutate: mutateAdmins } = useSWR<AdminsData>('/api/admin/admins', fetcher);
  const { data: settingsData, mutate: mutateSettings } = useSWR<{ eventName: string; eventDate: string; totalRounds: number }>('/api/admin/settings', fetcher);
  const [tab, setTab]         = useState<'homepage'|'access'|'reset'|'push'|'login'|'admins'>('homepage');
  const [otpToggling, setOtpToggling]         = useState(false);
  const [faceSearchToggling, setFaceSearchToggling] = useState(false);
  const [uploadToggling, setUploadToggling]         = useState(false);
  const [saving, setSaving]   = useState(false);

  // Event settings state
  const [evtName, setEvtName]       = useState('');
  const [evtDate, setEvtDate]       = useState('');
  const [evtSaving, setEvtSaving]   = useState(false);
  const [evtSaved, setEvtSaved]     = useState(false);
  const evtSynced = useRef(false);
  useEffect(() => {
    if (!evtSynced.current && settingsData) {
      evtSynced.current = true;
      setEvtName(settingsData.eventName);
      // Convert ISO to local datetime-local value (YYYY-MM-DDTHH:mm)
      if (settingsData.eventDate) {
        const d = new Date(settingsData.eventDate);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
        setEvtDate(local);
      }
    }
  }, [settingsData]);

  async function saveEventSettings() {
    setEvtSaving(true);
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: evtName,
        eventDate: evtDate ? new Date(evtDate).toISOString() : '',
      }),
    });
    await mutateSettings();
    setEvtSaving(false);
    setEvtSaved(true);
    setTimeout(() => setEvtSaved(false), 2500);
  }
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [resetting, setResetting]       = useState<string | null>(null);
  const [resetDone, setResetDone]       = useState<string | null>(null);

  // Admin management state
  const [addCode, setAddCode]       = useState('');
  const [addError, setAddError]     = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const visibility = data?.moduleConfig.visibility ?? {} as Record<ModuleKey, boolean>;
  const enabled    = data?.moduleConfig.enabled    ?? {} as Record<ModuleKey, boolean>;
  const [localOrder, setLocalOrder] = useState<ModuleKey[]>([]);
  const orderSynced = useRef(false);
  useEffect(() => {
    if (!orderSynced.current && data?.moduleOrder?.length) {
      orderSynced.current = true;
      setLocalOrder(data.moduleOrder as ModuleKey[]);
    }
  }, [data?.moduleOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  const order: ModuleKey[] = localOrder.length ? localOrder : (data?.moduleOrder as ModuleKey[] ?? MODULE_ORDER);

  async function saveConfig(newVis: Record<string, boolean>, newEna: Record<string, boolean>) {
    setSaving(true);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: newVis, enabled: newEna }),
    });
    await mutate();
    setSaving(false);
  }

  function toggleVisibility(key: ModuleKey) {
    const newVis = { ...visibility, [key]: !visibility[key] };
    saveConfig(newVis, enabled);
  }

  function toggleEnabled(key: ModuleKey) {
    const newEna = { ...enabled, [key]: !enabled[key] };
    saveConfig(visibility, newEna);
  }

  async function toggleFaceSearch() {
    setFaceSearchToggling(true);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ face_search_enabled: !(data?.faceSearchEnabled ?? true) }),
    });
    await mutate();
    setFaceSearchToggling(false);
  }

  async function toggleUpload() {
    setUploadToggling(true);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_upload_enabled: !(data?.uploadEnabled ?? true) }),
    });
    await mutate();
    setUploadToggling(false);
  }

  async function doReset(key: string) {
    setResetting(key); setConfirmReset(null);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: key }),
    });
    setResetting(null);
    setResetDone(key);
    setTimeout(() => setResetDone(null), 3000);
  }

  async function moveModule(key: ModuleKey, dir: -1 | 1) {
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const next = [...order];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setLocalOrder(next);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next }),
    });
    await mutate();
  }

  async function addAdmin() {
    const code = addCode.trim();
    if (!code) return;
    setAddLoading(true); setAddError('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (!res.ok) { setAddError(json.error ?? 'Failed'); }
    else { setAddCode(''); await mutateAdmins(); }
    setAddLoading(false);
  }

  async function removeAdmin(code: string) {
    setRemoveConfirm(null);
    await fetch('/api/admin/admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    await mutateAdmins();
  }

  const isRootAdmin = adminData?.isRootAdmin ?? false;

  async function toggleOtpEmail(enabled: boolean) {
    setOtpToggling(true);
    await fetch('/api/admin/app-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp_email_enabled: enabled }),
    });
    await mutate();
    setOtpToggling(false);
  }

  const tabs = [
    { id: 'homepage', label: 'Homepage' },
    { id: 'access',   label: 'Access' },
    { id: 'reset',    label: 'Reset Data' },
    { id: 'push',     label: 'Push Notify' },
    { id: 'login',    label: 'Login' },
    ...(isRootAdmin ? [{ id: 'admins', label: 'Admins' }] : []),
  ] as const;

  return (
    <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-6 lg:items-start">

      {/* Desktop sidebar nav */}
      <nav className="hidden lg:block bg-white border border-slate-200 rounded-2xl p-2 sticky top-6 space-y-0.5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Parameters<typeof setTab>[0])}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
              tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}>{t.label}</button>
        ))}
      </nav>

      <div className="space-y-4 min-w-0">
      {/* Mobile tab bar */}
      <div className="flex lg:hidden gap-1 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Parameters<typeof setTab>[0])}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Homepage Visibility + Order ── */}
      {tab === 'homepage' && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* ── Event Settings ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF4E8' }}>
              <Timer size={15} style={{ color: '#FE9234' }} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Event Settings</p>
              <p className="text-xs text-slate-400 mt-0.5">Name shown on homepage · countdown target date &amp; time</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Event Name</label>
              <input
                value={evtName}
                onChange={e => setEvtName(e.target.value)}
                placeholder="e.g. ABHYUDAY 2026"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Countdown Target
              </label>
              <input
                type="datetime-local"
                value={evtDate}
                onChange={e => setEvtDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Leave blank to auto-use the first schedule entry. When the timer hits zero, homepage shows&nbsp;
                <span className="font-semibold text-green-600">● Event is live!</span>
              </p>
            </div>
            <button
              onClick={saveEventSettings}
              disabled={evtSaving || !evtName.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition"
              style={{ background: 'linear-gradient(135deg,#FE9234,#FF6B35)' }}
            >
              {evtSaving
                ? <RefreshCw size={13} className="animate-spin" />
                : evtSaved
                  ? <CheckCircle2 size={13} />
                  : <Save size={13} />}
              {evtSaving ? 'Saving…' : evtSaved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── Homepage Tiles ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden lg:self-start">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-bold text-slate-900">Homepage Tiles</p>
            <p className="text-xs text-slate-400 mt-0.5">Show/hide modules and drag to reorder</p>
          </div>
          <div className="divide-y divide-slate-50">
            {order.map((key, idx) => {
              const meta = MODULE_META[key as ModuleKey];
              if (!meta) return null;
              const isVisible = visibility[key as ModuleKey] !== false;
              return (
                <div key={key} className="flex items-center gap-2 px-4 py-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveModule(key as ModuleKey, -1)}
                      disabled={idx === 0}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-20 transition">
                      <ChevronUp size={13}/>
                    </button>
                    <button
                      onClick={() => moveModule(key as ModuleKey, 1)}
                      disabled={idx === order.length - 1}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-20 transition">
                      <ChevronDown size={13}/>
                    </button>
                  </div>
                  <GripVertical size={14} className="text-slate-200 shrink-0" />
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: isVisible ? meta.color : '#CBD5E1' }}>
                    {meta.icon}
                  </div>
                  <span className={`flex-1 font-semibold text-sm ${isVisible ? 'text-slate-800' : 'text-slate-400'}`}>
                    {meta.label}
                  </span>
                  {saving && <RefreshCw size={13} className="text-slate-300 animate-spin" />}
                  <button onClick={() => toggleVisibility(key as ModuleKey)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isVisible
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                    }`}>
                    {isVisible ? <><Eye size={12}/>Visible</> : <><EyeOff size={12}/>Hidden</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}

      {/* ── Module Access ── */}
      {tab === 'access' && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-bold text-slate-900">Module Access</p>
            <p className="text-xs text-slate-400 mt-0.5">Disabled modules show a locked state on homepage and block access</p>
          </div>
          <div className="divide-y divide-slate-50">
            {MODULE_ORDER.map(key => {
              const meta = MODULE_META[key];
              const isEnabled = enabled[key] !== false;
              return (
                <div key={key} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: isEnabled ? meta.color : '#CBD5E1' }}>
                    {meta.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>
                      {meta.label}
                    </p>
                    {!isEnabled && <p className="text-[10px] text-red-500 font-semibold mt-0.5">Access blocked</p>}
                  </div>
                  {saving && <RefreshCw size={13} className="text-slate-300 animate-spin" />}
                  <button onClick={() => toggleEnabled(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isEnabled
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    }`}>
                    {isEnabled ? <><Unlock size={12}/>Enabled</> : <><Lock size={12}/>Disabled</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI Face Search toggle ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-bold text-slate-900">AI Features</p>
            <p className="text-xs text-slate-400 mt-0.5">Enable or disable AI-powered features independently of the module</p>
          </div>
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: (data?.faceSearchEnabled ?? true) ? '#6366F1' : '#CBD5E1' }}>
              <ScanFace size={16} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${(data?.faceSearchEnabled ?? true) ? 'text-slate-800' : 'text-slate-400'}`}>
                AI Face Search ("Find Me")
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {(data?.faceSearchEnabled ?? true)
                  ? 'Employees can search photos by face'
                  : 'Hidden from gallery — enable after event to reduce load'}
              </p>
            </div>
            {faceSearchToggling && <RefreshCw size={13} className="text-slate-300 animate-spin" />}
            <button onClick={toggleFaceSearch} disabled={faceSearchToggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                (data?.faceSearchEnabled ?? true)
                  ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                  : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              }`}>
              {(data?.faceSearchEnabled ?? true) ? <><Unlock size={12}/>Enabled</> : <><Lock size={12}/>Disabled</>}
            </button>
          </div>

          {/* ── Photo Upload toggle ── */}
          <div className="px-5 py-3.5 flex items-center gap-3 border-t border-slate-50">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: (data?.uploadEnabled ?? true) ? '#0284C7' : '#CBD5E1' }}>
              <ImageIcon size={16} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${(data?.uploadEnabled ?? true) ? 'text-slate-800' : 'text-slate-400'}`}>
                Photo Upload
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {(data?.uploadEnabled ?? true)
                  ? 'Employees can upload photos to the gallery'
                  : 'Upload button disabled — tap shows "coming soon" toast'}
              </p>
            </div>
            {uploadToggling && <RefreshCw size={13} className="text-slate-300 animate-spin" />}
            <button onClick={toggleUpload} disabled={uploadToggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                (data?.uploadEnabled ?? true)
                  ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                  : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              }`}>
              {(data?.uploadEnabled ?? true) ? <><Unlock size={12}/>Enabled</> : <><Lock size={12}/>Disabled</>}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── Reset Data ── */}
      {tab === 'reset' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5 lg:col-span-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              Reset operations permanently delete data. This cannot be undone. Use for fresh event setup only.
            </p>
          </div>
          <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
          {RESET_TARGETS.map(target => {
            const isDone     = resetDone === target.key;
            const isResetting = resetting === target.key;
            const isConfirming = confirmReset === target.key;
            return (
              <div key={target.key}
                className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm">{target.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{target.desc}</p>
                </div>
                {isDone ? (
                  <div className="flex items-center gap-1 text-green-600 text-xs font-bold shrink-0">
                    <CheckCircle2 size={13}/>Cleared
                  </div>
                ) : isResetting ? (
                  <RefreshCw size={15} className="animate-spin text-slate-400 shrink-0" />
                ) : isConfirming ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => doReset(target.key)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmReset(null)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmReset(target.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition shrink-0">
                    <Trash2 size={12}/>Clear
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* ── Push Notification Status ── */}
      {tab === 'push' && data && (
        <div className="space-y-3">
          {/* Config status */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-bold text-slate-900">Push Configuration</p>
              <p className="text-xs text-slate-400 mt-0.5">Environment variables required for each platform</p>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  label: 'Web Push (VAPID)',
                  ok: data.pushConfig.vapid,
                  detail: data.pushConfig.vapid
                    ? 'VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY configured'
                    : 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY',
                  subs: data.pushStats.web,
                  platform: 'web',
                },
                {
                  label: 'Android / FCM',
                  ok: data.pushConfig.fcm,
                  detail: data.pushConfig.fcm
                    ? 'Firebase credentials configured'
                    : 'Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY',
                  subs: data.pushStats.android,
                  platform: 'android',
                },
                {
                  label: 'iOS / FCM',
                  ok: data.pushConfig.fcm,
                  detail: data.pushConfig.fcm
                    ? 'Firebase credentials configured (shared with Android)'
                    : 'Missing Firebase credentials',
                  subs: data.pushStats.ios,
                  platform: 'ios',
                },
              ].map(row => (
                <div key={row.platform} className="px-5 py-4 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${row.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                    {row.ok ? <Wifi size={16} className="text-green-600"/> : <WifiOff size={16} className="text-red-500"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm">{row.label}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${row.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {row.ok ? 'Configured' : 'Not configured'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{row.detail}</p>
                    <p className="text-xs font-semibold text-slate-600 mt-1.5">
                      {row.subs} device{row.subs !== 1 ? 's' : ''} subscribed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Android diagnosis */}
          {!data.pushConfig.fcm && data.pushStats.android > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <BellOff size={15} className="text-red-600" />
                <p className="font-bold text-red-800 text-sm">Android notifications not working</p>
              </div>
              <p className="text-xs text-red-700">
                {data.pushStats.android} Android device{data.pushStats.android !== 1 ? 's are' : ' is'} subscribed but Firebase (FCM) is not
                configured. Add <code className="bg-red-100 px-1 rounded">FIREBASE_PROJECT_ID</code>,{' '}
                <code className="bg-red-100 px-1 rounded">FIREBASE_CLIENT_EMAIL</code>, and{' '}
                <code className="bg-red-100 px-1 rounded">FIREBASE_PRIVATE_KEY</code> to your environment variables and restart the server.
              </p>
            </div>
          )}

          {data.pushConfig.fcm && data.pushStats.android === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-amber-600" />
                <p className="font-bold text-amber-800 text-sm">FCM configured — no Android subscriptions yet</p>
              </div>
              <p className="text-xs text-amber-700">
                Firebase is correctly configured, but no Android devices have registered yet.
                Make sure the Android app is calling <code className="bg-amber-100 px-1 rounded">POST /api/push/subscribe</code> with{' '}
                <code className="bg-amber-100 px-1 rounded">platform: "android"</code> and the FCM device token.
              </p>
            </div>
          )}

          {data.pushConfig.fcm && data.pushStats.android > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-green-600" />
              <p className="text-xs text-green-800 font-semibold">
                FCM configured and {data.pushStats.android} Android device{data.pushStats.android !== 1 ? 's' : ''} registered. Android notifications should be working.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900 text-sm">Total subscriptions</p>
              <p className="text-xs text-slate-400 mt-0.5">{data.pushStats.web} web · {data.pushStats.android} android · {data.pushStats.ios} iOS</p>
            </div>
            <span className="text-2xl font-black text-slate-800">{data.pushStats.total}</span>
          </div>
        </div>
      )}

      {/* ── Login / OTP Settings ── */}
      {tab === 'login' && data && (
        <div className="space-y-3">
          {/* SMTP status */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-bold text-slate-900">Email / SMTP</p>
              <p className="text-xs text-slate-400 mt-0.5">Required to send real OTP codes to employees</p>
            </div>
            <div className="px-5 py-4 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${data.authConfig.smtp_ready ? 'bg-green-50' : 'bg-red-50'}`}>
                {data.authConfig.smtp_ready
                  ? <Wifi size={16} className="text-green-600" />
                  : <WifiOff size={16} className="text-red-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-sm">SMTP</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${data.authConfig.smtp_ready ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {data.authConfig.smtp_ready ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.authConfig.smtp_ready
                    ? 'SMTP_HOST, SMTP_USER, and SMTP_PASS are set.'
                    : 'Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to enable email delivery.'}
                </p>
              </div>
            </div>
          </div>

          {/* OTP mode toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${data.authConfig.otp_email_enabled ? 'bg-blue-50' : 'bg-slate-100'}`}>
                {data.authConfig.otp_email_enabled
                  ? <Bell size={16} className="text-blue-600" />
                  : <BellOff size={16} className="text-slate-400" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900 text-sm">Send real OTPs via email</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.authConfig.otp_email_enabled
                    ? 'Each employee gets a unique 6-digit code emailed to them on login.'
                    : `Static code is active — every employee uses "${data.authConfig.static_otp_code}" to log in.`}
                </p>
              </div>
              <button
                onClick={() => toggleOtpEmail(!data.authConfig.otp_email_enabled)}
                disabled={otpToggling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  data.authConfig.otp_email_enabled
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {otpToggling
                  ? <RefreshCw size={12} className="animate-spin" />
                  : data.authConfig.otp_email_enabled
                    ? <><Bell size={12}/>On</>
                    : <><BellOff size={12}/>Off</>}
              </button>
            </div>
          </div>

          {/* Warning: enabled but SMTP not ready */}
          {data.authConfig.otp_email_enabled && !data.authConfig.smtp_ready && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 font-medium">
                Email OTP is ON but SMTP is not configured. Employees will see an error when they try to log in.
                Add <code className="bg-red-100 px-1 rounded">SMTP_HOST</code>,{' '}
                <code className="bg-red-100 px-1 rounded">SMTP_USER</code>, and{' '}
                <code className="bg-red-100 px-1 rounded">SMTP_PASS</code> to your environment variables.
              </p>
            </div>
          )}

          {/* Info: disabled — static code hint */}
          {!data.authConfig.otp_email_enabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                Static code mode is active. All employees log in with code{' '}
                <code className="bg-amber-100 px-1 rounded font-black">{data.authConfig.static_otp_code}</code>.
                Set <code className="bg-amber-100 px-1 rounded">OTP_CODE</code> in env to change it, or turn on email OTP above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Admin Management ── */}
      {tab === 'admins' && adminData && (
        <div className="space-y-3">
          {/* Root admin card */}
          <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
              <Crown size={15} className="text-amber-600" />
              <p className="font-bold text-slate-900">Root Admin</p>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700">ENV only · cannot remove</span>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{adminData.rootAdmin.name ?? 'Unknown'}</p>
                <p className="text-xs text-slate-400">Code: <code className="bg-slate-100 px-1 rounded">{adminData.rootAdmin.code.replace(/.(?=.{2})/g, '*')}</code>
                  {adminData.rootAdmin.department && <> · {adminData.rootAdmin.department}</>}
                </p>
              </div>
              <span className="ml-auto text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">ROOT</span>
            </div>
          </div>

          {/* Current DB admins */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck size={15} className="text-slate-600" />
              <p className="font-bold text-slate-900">Admins</p>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">
                {adminData.admins.length} added
              </span>
            </div>
            {adminData.admins.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <ShieldOff size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No additional admins added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {adminData.admins.map(a => (
                  <div key={a.code} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <ShieldCheck size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm">{a.name ?? a.code}</p>
                      <p className="text-xs text-slate-400">
                        Code: <code className="bg-slate-100 px-1 rounded">{a.code}</code>
                        {a.department && <> · {a.department}</>}
                      </p>
                    </div>
                    {removeConfirm === a.code ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => removeAdmin(a.code)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition">
                          Remove
                        </button>
                        <button onClick={() => setRemoveConfirm(null)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setRemoveConfirm(a.code)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition shrink-0">
                        <X size={11}/>Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add admin */}
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
            <p className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <ShieldPlus size={15} className="text-blue-600" />
              Add Admin by Employee Code
            </p>
            <div className="flex gap-2">
              <input
                value={addCode}
                onChange={e => { setAddCode(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && addAdmin()}
                placeholder="e.g. 1045"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={addAdmin}
                disabled={addLoading || !addCode.trim()}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition shrink-0">
                {addLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Add'}
              </button>
            </div>
            {addError && (
              <p className="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle size={11}/>{addError}
              </p>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
