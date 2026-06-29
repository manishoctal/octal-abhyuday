import { listDepartments } from '@/lib/db';
import NotificationsModule from '@/components/admin/NotificationsModule';

export const dynamic = 'force-dynamic';

export default function AdminNotificationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">🔔 Push Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">Send instant alerts to all attendees' devices.</p>
      </div>
      <NotificationsModule departments={listDepartments()} />
    </div>
  );
}
