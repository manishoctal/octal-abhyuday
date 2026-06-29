'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { MapPin, Settings, Users, Download, CheckCircle2, Navigation, QrCode, Camera, X, CameraOff } from 'lucide-react';
import QRCode from 'qrcode';

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

/* ── QR Scanner Panel ───────────────────────────────────── */
type ScanResult = { name: string; department: string | null; alreadyCheckedIn: boolean } | null;

interface IScannerControls { stop(): void }

function QrScannerPanel({ onCheckedIn }: { onCheckedIn: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);
  const [active,    setActive]   = useState(false);
  const [result,    setResult]   = useState<ScanResult>(null);
  const [errMsg,    setErrMsg]   = useState('');
  const [scanning,  setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanningRef.current = false;
    setActive(false);
    setScanning(false);
  }, []);

  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  async function startCamera() {
    setResult(null); setErrMsg('');
    setActive(true);

    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const reader = new BrowserQRCodeReader();

    try {
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, async (res) => {
        if (!res || scanningRef.current) return;
        const text = res.getText();

        let payload: { t?: string; u?: number } = {};
        try { payload = JSON.parse(text); } catch { return; }
        if (payload.t !== 'ci' || !payload.u) return; // not our QR — ignore

        scanningRef.current = true;
        setScanning(true);
        try {
          const r = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: payload.u }),
          });
          const d = await r.json();
          if (!r.ok) { setErrMsg(d.error ?? 'Check-in failed'); scanningRef.current = false; setScanning(false); return; }
          setResult({ name: d.name, department: d.department, alreadyCheckedIn: d.alreadyCheckedIn });
          stopCamera();
          onCheckedIn();
        } catch {
          setErrMsg('Network error — try again');
          scanningRef.current = false;
          setScanning(false);
        }
      });
      controlsRef.current = controls as IScannerControls;
    } catch {
      setErrMsg('Camera access denied or unavailable');
      setActive(false);
    }
  }

  function reset() {
    stopCamera();
    setResult(null);
    setErrMsg('');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <QrCode size={16} className="text-slate-400" />
        <h2 className="font-bold text-slate-900">QR Check-In Scanner</h2>
        <span className="ml-auto text-[11px] text-slate-400">Scan employee badge — bypasses GPS</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Success result */}
        {result && (
          <div className={`rounded-2xl px-5 py-4 flex items-center gap-4 ${result.alreadyCheckedIn ? 'bg-amber-50 border border-amber-100' : 'bg-green-50 border border-green-100'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 ${result.alreadyCheckedIn ? 'bg-amber-400' : 'bg-green-500'}`}>
              {result.alreadyCheckedIn ? '✓' : '🎉'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-extrabold text-lg ${result.alreadyCheckedIn ? 'text-amber-800' : 'text-green-800'}`}>{result.name}</p>
              {result.department && <p className="text-sm text-slate-500">{result.department}</p>}
              <p className={`text-sm font-semibold mt-0.5 ${result.alreadyCheckedIn ? 'text-amber-600' : 'text-green-600'}`}>
                {result.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully!'}
              </p>
            </div>
            <button onClick={reset} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Camera feed */}
        {active && (
          <div className="relative rounded-2xl overflow-hidden bg-slate-900">
            <video ref={videoRef} className="w-full aspect-[4/3] object-cover" playsInline muted autoPlay />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],
                  ['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']
                ].map(([pos, border]) => (
                  <div key={pos} className={`absolute ${pos} w-8 h-8 ${border} border-green-400 rounded-sm`} />
                ))}
                <div className="absolute inset-x-0 top-1/2 h-px bg-green-400/60 animate-pulse" />
              </div>
            </div>
            {scanning && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white">
                  <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Verifying…</p>
                </div>
              </div>
            )}
            <p className="absolute bottom-3 inset-x-0 text-center text-white/70 text-xs font-medium">
              Point camera at employee QR code
            </p>
          </div>
        )}

        {errMsg && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3 font-semibold">{errMsg}</p>
        )}

        {/* Action buttons */}
        {!active && !result && (
          <button onClick={startCamera}
            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 text-sm"
            style={{ background: 'linear-gradient(135deg,#0F172A,#334155)' }}>
            <Camera size={16} />
            Start QR Scanner
          </button>
        )}
        {active && !scanning && (
          <button onClick={stopCamera}
            className="w-full py-3 rounded-2xl font-bold text-slate-600 border border-slate-200 flex items-center justify-center gap-2 text-sm hover:bg-slate-50 transition">
            <CameraOff size={15} />
            Stop Camera
          </button>
        )}
        {result && (
          <button onClick={reset}
            className="w-full py-3 rounded-2xl font-bold text-slate-700 border border-slate-200 flex items-center justify-center gap-2 text-sm hover:bg-slate-50 transition">
            <Camera size={15} />
            Scan Next
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Venue QR Panel ─────────────────────────────────────── */
interface AttendanceConfigData extends VenueConfig { checkin_token: string }

function VenueQrPanel() {
  const { data, mutate } = useSWR<AttendanceConfigData>('/api/admin/attendance-config', fetcher);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [regen, setRegen]   = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!data?.checkin_token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, JSON.stringify({ t: 'venue_ci', tok: data.checkin_token }), {
      width: 220, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  }, [data?.checkin_token]);

  async function handleRegenerate() {
    setRegen(true); setConfirm(false);
    await fetch('/api/admin/attendance-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate_token' }),
    });
    await mutate();
    setRegen(false);
  }

  function downloadQr() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'venue-checkin-qr.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <QrCode size={16} className="text-slate-400" />
        <h2 className="font-bold text-slate-900">Venue Check-In QR</h2>
        <span className="ml-auto text-[11px] text-slate-400">Display at entrance — employees scan to check in</span>
      </div>

      <div className="p-5 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {/* QR canvas */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="p-3 rounded-2xl border border-slate-100 shadow-sm bg-white">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button onClick={downloadQr}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5">
              <Download size={12} /> Download PNG
            </button>
          </div>
        </div>

        {/* Instructions + regenerate */}
        <div className="flex-1 space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-bold text-slate-800">How it works</p>
            <ol className="space-y-1.5 text-slate-500 list-decimal list-inside text-[13px]">
              <li>Print or display this QR code at the venue entrance.</li>
              <li>Employees open their badge page on their phone.</li>
              <li>They tap <strong className="text-slate-700">"Scan Venue QR"</strong> and point the camera at this code.</li>
              <li>They are checked in instantly — no GPS required.</li>
            </ol>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-3">
            <p className="text-[12px] font-semibold text-amber-800">
              Regenerate the token if the QR code has been compromised. Old QR codes will stop working.
            </p>
            {confirm ? (
              <div className="flex gap-2">
                <button onClick={handleRegenerate} disabled={regen}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
                  {regen ? 'Regenerating…' : 'Yes, regenerate'}
                </button>
                <button onClick={() => setConfirm(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-white transition">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100 transition">
                Regenerate Token
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  const { data, mutate } = useSWR('/api/attendance?list=1', fetcher, { refreshInterval: 15000 });
  const rows: AttendanceRow[] = data?.attendance ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <VenueQrPanel />
      <QrScannerPanel onCheckedIn={() => mutate()} />
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
