import QnaModule from '@/components/admin/QnaModule';

export const dynamic = 'force-dynamic';

export default function AdminQnaPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">💬 Live Q&amp;A</h1>
        <p className="text-sm text-slate-500 mt-1">
          Build a question deck, go live, present questions one at a time and reveal the answers.
        </p>
      </div>
      <QnaModule />
    </div>
  );
}
