import ScanModule from '@/components/admin/ScanModule';

export const dynamic = 'force-dynamic';

export default function AdminScanPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">📍 Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Configure venue location. Employees self check-in from their profile using GPS — within the allowed radius only.</p>
      </div>
      <ScanModule />
    </div>
  );
}
