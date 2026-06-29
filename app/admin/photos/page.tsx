import { listPhotos } from '@/lib/db';
import { isS3Configured } from '@/lib/s3';
import AdminPhotosModule from '@/components/admin/PhotosModule';

export const dynamic = 'force-dynamic';

export default function AdminPhotosPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">📷 Photo Gallery</h1>
        <p className="text-sm text-slate-500 mt-1">Upload, approve, and tag event photos.</p>
      </div>
      <AdminPhotosModule initial={listPhotos(false)} useS3={isS3Configured()} />
    </div>
  );
}
