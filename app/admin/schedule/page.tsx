import ScheduleModule from '@/components/admin/ScheduleModule';

export const dynamic = 'force-dynamic';

export default function AdminSchedulePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">📅 Event Schedule</h1>
        <p className="text-sm text-slate-500 mt-1">Add and manage the event agenda. Changes appear instantly on attendees' phones.</p>
      </div>
      <ScheduleModule />
    </div>
  );
}
