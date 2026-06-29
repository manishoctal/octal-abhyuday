import EventInfoModule from '@/components/admin/EventInfoModule';

export const dynamic = 'force-dynamic';

export default function AdminEventInfoPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">📍 Venue &amp; Event Info</h1>
        <p className="text-sm text-slate-500 mt-1">Add venue details, FAQs, emergency contacts, and instructions for attendees.</p>
      </div>
      <EventInfoModule />
    </div>
  );
}
