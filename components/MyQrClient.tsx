'use client';

import { useState } from 'react';
import { MapPin, CheckCircle2, Loader2, AlertTriangle, Navigation } from 'lucide-react';

interface Props {
  userId: number;
  name: string;
  email: string;
  department: string | null;
  isCheckedIn: boolean;
  eventName: string;
}

type CheckInState = 'idle' | 'locating' | 'submitting' | 'success' | 'already' | 'error';

export default function MyQrClient({ name, email, department, isCheckedIn: initial, eventName }: Props) {
  const [state, setState]       = useState<CheckInState>(initial ? 'already' : 'idle');
  const [distanceM, setDist]    = useState<number | null>(null);
  const [errorMsg, setError]    = useState('');

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
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-md"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4F87)' }}>
            {initials}
          </div>

          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg leading-tight">{name}</p>
            {department && <p className="text-sm text-slate-500 mt-0.5">{department}</p>}
            <p className="text-xs text-slate-400 mt-1">{email}</p>
          </div>

          {/* Status / action */}
          {(state === 'success' || state === 'already') ? (
            <div className="w-full flex flex-col items-center gap-2">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
