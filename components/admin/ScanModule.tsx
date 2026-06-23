'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AttendanceRow {
  user_id: number;
  name: string;
  email: string;
  department: string | null;
  checked_in_at: string;
}

export default function ScanModule() {
  const { data, mutate } = useSWR('/api/attendance?list=1', fetcher, { refreshInterval: 10000 });
  const rows: AttendanceRow[] = data?.attendance ?? [];
  const total: number = data?.total ?? 0;

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; name?: string; alreadyIn?: boolean } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});

  async function startScan() {
    setResult(null);
    setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const deviceId = devices[devices.length - 1]?.deviceId; // prefer rear camera

      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        async (result, err) => {
          if (!result) return;
          controls.stop();
          setScanning(false);
          const userId = result.getText();
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: Number(userId) }),
          });
          const d = await res.json();
          mutate();
          // Try to find name from current list
          const found = rows.find((r) => r.user_id === Number(userId));
          setResult({ ok: d.ok, name: found?.name, alreadyIn: d.alreadyCheckedIn });
        }
      );
      stopRef.current = () => controls.stop();
    } catch (e) {
      console.error(e);
      setScanning(false);
    }
  }

  useEffect(() => () => stopRef.current?.(), []);

  return (
    <div className="space-y-6">
      {/* Scanner */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">QR Scanner</h2>
          <button
            onClick={scanning ? () => { stopRef.current(); setScanning(false); } : startScan}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
              scanning
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {scanning ? '⏹ Stop' : '📷 Scan QR'}
          </button>
        </div>
        <div className="relative bg-black min-h-48">
          <video ref={videoRef} className={`w-full ${scanning ? 'block' : 'hidden'}`} />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              Camera off — press Scan QR to begin
            </div>
          )}
        </div>
        {result && (
          <div className={`px-4 py-3 text-sm font-semibold ${result.alreadyIn ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
            {result.alreadyIn
              ? `ℹ️ ${result.name ?? 'User'} is already checked in.`
              : `✅ ${result.name ?? 'User'} checked in successfully!`}
          </div>
        )}
      </div>

      {/* Stats & list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Attendance ({total})</h2>
          <a
            href="/api/attendance?list=1&format=csv"
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            ↓ Export CSV
          </a>
        </div>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No check-ins yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {rows.map((r) => (
              <li key={r.user_id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {r.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.department ?? r.email}</p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">
                  {new Date(r.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
