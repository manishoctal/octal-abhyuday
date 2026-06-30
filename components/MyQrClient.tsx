'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, CheckCircle2, Loader2, AlertTriangle, Navigation, ScanLine, X, Lock } from 'lucide-react';
import QRCode from 'qrcode';

interface Props {
  userId: number;
  name: string;
  email: string;
  isCheckedIn: boolean;
  eventName: string;
  photoUrl?: string | null;
  checkinEnabled?: boolean;
}

type CheckInState = 'idle' | 'locating' | 'submitting' | 'success' | 'already' | 'error';

export default function MyQrClient({ userId, name, email, isCheckedIn: initial, eventName, photoUrl, checkinEnabled = true }: Props) {
  const [state, setState]       = useState<CheckInState>(initial ? 'already' : 'idle');
  const [distanceM, setDist]    = useState<number | null>(null);
  const [errorMsg, setError]    = useState('');
  // Venue QR scanner state
  interface IScanControls { stop(): void }
  const [scanOpen,    setScanOpen]    = useState(false);
  const [scanStatus,  setScanStatus]  = useState<'idle'|'scanning'|'verifying'|'error'>('idle');
  const [scanErr,     setScanErr]     = useState('');
  const videoRef2     = useRef<HTMLVideoElement>(null);
  const controlsRef2  = useRef<IScanControls | null>(null);
  const scanningRef2  = useRef(false);
  // Pass QR canvas
  const passCanvasRef = useRef<HTMLCanvasElement>(null);

  const stopScan = useCallback(() => {
    controlsRef2.current?.stop();
    controlsRef2.current = null;
    scanningRef2.current = false;
    setScanStatus('idle');
    setScanOpen(false);
  }, []);

  useEffect(() => () => { controlsRef2.current?.stop(); }, []);

  // Render the pass QR whenever checked-in state is reached
  const isCheckedInState = state === 'success' || state === 'already';
  useEffect(() => {
    if (!isCheckedInState || !passCanvasRef.current) return;
    QRCode.toCanvas(
      passCanvasRef.current,
      JSON.stringify({ t: 'pass', uid: userId, name, email, event: eventName }),
      { width: 180, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }
    );
  }, [isCheckedInState, userId, name, email, eventName]);

  async function openScanner() {
    setScanErr(''); setScanStatus('scanning'); setScanOpen(true);
    await new Promise(r => setTimeout(r, 100));
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const reader = new BrowserQRCodeReader();
    try {
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef2.current!, async (res) => {
        if (!res || scanningRef2.current) return;
        const text = res.getText();
        let payload: { t?: string; tok?: string } = {};
        try { payload = JSON.parse(text); } catch { return; }
        if (payload.t !== 'venue_ci' || !payload.tok) return;

        scanningRef2.current = true;
        setScanStatus('verifying');
        try {
          const r = await fetch('/api/attendance/qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: payload.tok }),
          });
          const d = await r.json();
          if (!r.ok) { setScanErr(d.error ?? 'Check-in failed'); setScanStatus('error'); scanningRef2.current = false; return; }
          stopScan();
          setState(d.alreadyCheckedIn ? 'already' : 'success');
        } catch {
          setScanErr('Network error. Try again.'); setScanStatus('error'); scanningRef2.current = false;
        }
      });
      controlsRef2.current = controls as IScanControls;
    } catch {
      setScanErr('Camera access denied or unavailable.'); setScanStatus('error');
    }
  }

  async function checkIn() {
    setError('');
    setState('locating');

    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      );
    } catch (e: unknown) {
      const msg = e instanceof GeolocationPositionError
        ? e.code === 1 ? 'Location permission denied. Please allow location access and try again.'
          : e.code === 2 ? 'Could not determine your location. Move to an open area and retry.'
          : 'Location request timed out. Try again.'
        : 'Could not get location.';
      setError(msg);
      setState('error');
      return;
    }

    setState('submitting');
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Check-in failed.');
        if (data.distanceM) setDist(data.distanceM);
        setState('error');
        return;
      }
      setDist(data.distanceM ?? null);
      setState(data.alreadyCheckedIn ? 'already' : 'success');
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    }
  }

  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-5 pb-4">
      {/* Badge card */}
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-card-lg bg-white border border-slate-100">

        {/* Dark header */}
        <div style={{ background: '#0F172A' }}>
          <div className="h-0.5 w-full" style={{ background: '#FE9234' }} />
          <div className="px-6 pt-5 pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#FE9234' }}>
              Octal IT Solution
            </p>
            <p className="text-white font-bold text-xl mt-1 leading-tight">{eventName}</p>
            <p className="text-white/40 text-xs mt-0.5 font-medium">Event Pass</p>
          </div>
        </div>

        {/* Avatar + identity */}
        <div className="flex flex-col items-center px-6 pt-7 pb-6 gap-4 bg-white">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-20 h-20 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-md"
              style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
              {initials}
            </div>
          )}

          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg leading-tight">{name}</p>
            <p className="text-xs text-slate-400 mt-1">{email}</p>
          </div>

          {/* ── Check-in disabled by admin ── */}
          {!checkinEnabled ? (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: '#F1F5F9', color: '#94A3B8' }}>
              <Lock size={15} />
              Check-in is currently disabled
            </div>
          ) : isCheckedInState ? (
            /* ── Success / already checked in ── */
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#DCFCE7', color: '#15803D' }}>
                <CheckCircle2 size={18} />
                {state === 'already' ? 'Already checked in' : 'Checked in!'}
              </div>
              {distanceM !== null && distanceM > 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin size={11} />
                  {distanceM < 1000 ? `${distanceM} m from venue` : `${(distanceM / 1000).toFixed(1)} km from venue`}
                </p>
              )}

              {/* Pass QR */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your Event Pass</p>
                <div className="p-3 rounded-2xl border border-slate-100 shadow-sm bg-white">
                  <canvas ref={passCanvasRef} className="rounded-lg" />
                </div>
                <p className="text-[10px] text-slate-400 text-center">Show this at the venue entrance</p>
              </div>
            </div>
          ) : state === 'locating' ? (
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-blue-50 text-blue-600 text-sm font-semibold">
              <Navigation size={16} className="animate-pulse" />
              Getting your location…
            </div>
          ) : state === 'submitting' ? (
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-semibold">
              <Loader2 size={16} className="animate-spin" />
              Verifying…
            </div>
          ) : (
            <div className="w-full flex flex-col gap-2.5">
              {state === 'error' && (
                <div className="rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <button onClick={checkIn}
                className="w-full py-3.5 rounded-2xl font-black text-white text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)', boxShadow: '0 8px 20px rgba(255,122,0,0.30)' }}>
                <MapPin size={17} />
                {state === 'error' ? 'Try Again' : 'Check In'}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                Tap to share your location and verify you are at the venue
              </p>

              {/* Venue QR scan toggle */}
              {!scanOpen && (
                <button onClick={openScanner}
                  className="w-full py-3 rounded-2xl font-bold text-slate-600 border border-slate-200 flex items-center justify-center gap-2 text-sm hover:bg-slate-50 transition active:scale-[0.98]">
                  <ScanLine size={15} />
                  Scan Venue QR instead
                </button>
              )}
            </div>
          )}

          {/* Inline camera scanner (venue QR) — only shown when checkin enabled */}
          {checkinEnabled && scanOpen && (
            <div className="w-full space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900">
                <video ref={videoRef2} className="w-full aspect-[4/3] object-cover" playsInline muted autoPlay />
                {/* Corner-bracket overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-44 h-44">
                    {(['top-0 left-0 border-t-2 border-l-2','top-0 right-0 border-t-2 border-r-2',
                       'bottom-0 left-0 border-b-2 border-l-2','bottom-0 right-0 border-b-2 border-r-2'] as const
                    ).map(cls => <div key={cls} className={`absolute w-7 h-7 ${cls} border-orange-400 rounded-sm`} />)}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-orange-400/60 animate-pulse" />
                  </div>
                </div>
                {scanStatus === 'verifying' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 text-white">
                    <Loader2 size={28} className="animate-spin" />
                    <p className="text-sm font-semibold">Verifying…</p>
                  </div>
                )}
                <p className="absolute bottom-2 inset-x-0 text-center text-white/60 text-[11px]">
                  Point camera at the venue QR code
                </p>
              </div>

              {scanErr && (
                <div className="rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{scanErr}</span>
                </div>
              )}

              <button onClick={stopScan}
                className="w-full py-3 rounded-2xl font-bold text-slate-500 border border-slate-200 flex items-center justify-center gap-2 text-sm hover:bg-slate-50 transition">
                <X size={14} /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
