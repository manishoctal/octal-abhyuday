'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { MapPin, Settings, Users, Download, CheckCircle2, Navigation } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AttendanceRow {
  user_id: number;
  name: string;
  email: string;
  department: string | null;
  checked_in_at: string;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
}

interface VenueConfig {
  lat: number | null;
  lng: number | null;
  radius_km: number;
}

/* ── Venue Config Panel ─────────────────────────────────── */
function VenueConfigPanel() {
  const { data, mutate } = useSWR<VenueConfig>('/api/admin/attendance-config', fetcher);
  const [lat, setLat]         = useState('');
  const [lng, setLng]         = useState('');
  const [radius, setRadius]   = useState('0.5');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [detecting, setDet]   = useState(false);

  useEffect(() => {
    if (!data) return;
    if (data.lat !== null) setLat(String(data.lat));
    if (data.lng !== null) setLng(String(data.lng));
    setRadius(String(data.radius_km));
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const radN = parseFloat(radius);
    if (isNaN(latN) || isNaN(lngN)) { setMsg('Enter valid lat/lng coordinates.'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/admin/attendance-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latN, lng: lngN, radius_km: isNaN(radN) || radN <= 0 ? 0.5 : radN }),
      });
      const d = await res.json();
      setMsg(res.ok ? 'Venue location saved.' : (d.error ?? 'Save failed.'));
      if (res.ok) mutate();
    } finally { setSaving(false); }
  }

  function detectLocation() {
    setDet(true); setMsg('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setMsg('Location detected — adjust if needed, then save.');
        setDet(false);
      },
      () => { setMsg('Could not detect location.'); setDet(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const configured = !!data && data.lat !== null && data.lng !== null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-slate-400" />
          <h2 className="font-bold text-slate-900">Venue Location</h2>
        </div>
        {configured ? (
          <span className="text-[11px] font-bold bg-green-50 text-green-700 px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={11} /> Configured
          </span>
        ) : (
          <span className="text-[11px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
            Not set — all check-ins allowed
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Set the venue coordinates and radius. Employees must be within this radius to self check-in.
        Use the detect button to capture this device&apos;s current location.
      </p>

      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Latitude</label>
            <input
              value={lat} onChange={e => setLat(e.target.value)}
              placeholder="e.g. 21.1702"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Longitude</label>
            <input
              value={lng} onChange={e => setLng(e.target.value)}
              placeholder="e.g. 72.8311"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Allowed Radius (km)</label>
          <div className="flex items-center gap-3">
            <input
              type="number" step="0.05" min="0.05" max="50"
              value={radius} onChange={e => setRadius(e.target.value)}
              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <span className="text-xs text-slate-400">{radius} km = ~{Math.round(parseFloat(radius || '0') * 1000)} m</span>
          </div>
        </div>

        {msg && (
          <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${
            msg.includes('saved') || msg.includes('detected') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>{msg}</p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={detectLocation} disabled={detecting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Navigation size={14} className={detecting ? 'animate-pulse text-blue-500' : ''} />
            {detecting ? 'Detecting…' : 'Use My Location'}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
            {saving ? 'Saving…' : 'Save Venue Location'}
          </button>
        </div>
      </form>

      {/* Mini map link if configured */}
      {configured && (
        <a
          href={`https://www.google.com/maps?q=${data!.lat},${data!.lng}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
        >
          <MapPin size={12} /> View on Google Maps — {data!.lat?.toFixed(5)}, {data!.lng?.toFixed(5)}
        </a>
      )}
    </div>
  );
}

/* ── Attendance List ─────────────────────────────────────── */
export default function ScanModule() {
  const { data } = useSWR('/api/attendance?list=1', fetcher, { refreshInterval: 15000 });
  const rows: AttendanceRow[] = data?.attendance ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <VenueConfigPanel />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-bold text-slate-900">
              Attendance
              <span className="ml-2 text-sm font-semibold text-brand-600">{total} checked in</span>
            </h2>
          </div>
          <a href="/api/attendance?list=1&format=csv"
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
            <Download size={12} /> Export CSV
          </a>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-slate-200 bg-white">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-slate-400 text-sm font-medium">No check-ins yet</p>
            <p className="text-xs text-slate-300 mt-1">Employees check in from their profile page</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {rows.map((r, i) => (
              <li key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                  style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
                  {r.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                  <p className="text-xs text-slate-400 truncate">{r.department ?? r.email}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500">
                    {new Date(r.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {r.distance_m !== null && r.distance_m > 0 && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                      <MapPin size={9} />
                      {r.distance_m < 1000 ? `${r.distance_m}m` : `${(r.distance_m / 1000).toFixed(1)}km`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
