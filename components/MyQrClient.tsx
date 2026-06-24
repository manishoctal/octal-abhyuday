'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  userId: number;
  name: string;
  email: string;
  department: string | null;
  isCheckedIn: boolean;
  eventName: string;
}

export default function MyQrClient({ userId, name, email, department, isCheckedIn: initial, eventName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [checkedIn, setCheckedIn] = useState(initial);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, String(userId), {
      width: 220,
      margin: 2,
      color: { dark: '#0F172A', light: '#ffffff' },
    });
  }, [userId]);

  useEffect(() => {
    if (checkedIn) return;
    const t = setInterval(async () => {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const d = await res.json();
        if (d.record) { setCheckedIn(true); clearInterval(t); }
      }
    }, 5000);
    return () => clearInterval(t);
  }, [checkedIn]);

  return (
    <div className="flex flex-col items-center gap-5 pb-4">

      {/* Badge card — Apple Wallet inspired */}
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-card-lg bg-white border border-slate-100">

        {/* Dark header with orange stripe */}
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

        {/* QR section */}
        <div className="flex flex-col items-center px-6 pt-6 pb-5 gap-4 bg-white">
          {/* QR */}
          <div className="p-3 rounded-2xl bg-white shadow-card border border-slate-100">
            <canvas ref={canvasRef} className="block rounded-xl" />
          </div>

          {/* Name & info */}
          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg leading-tight">{name}</p>
            {department && (
              <p className="text-sm text-slate-500 mt-0.5">{department}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">{email}</p>
          </div>

          {/* Status badge */}
          {checkedIn ? (
            <div
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: '#DCFCE7', color: '#15803D' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Checked in
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-slate-100 text-slate-500 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
              Awaiting check-in
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed px-4">
        Show this QR code to the event host at the entrance to record your attendance.
      </p>
    </div>
  );
}
