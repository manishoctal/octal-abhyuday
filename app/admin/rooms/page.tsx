import { isS3Configured } from '@/lib/s3';
import RoomsModule from '@/components/admin/RoomsModule';

export const dynamic = 'force-dynamic';

export default function AdminRoomsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">🏨 Room Allocation</h1>
        <p className="text-sm text-slate-500 mt-1">Assign employees to rooms and manage Aadhar card uploads for hotel check-in.</p>
      </div>
      <RoomsModule useS3={isS3Configured()} />
    </div>
  );
}
