'use client';

/** Generic skeleton shimmer block */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer rounded-2xl ${className}`} />
  );
}

/** Skeleton for a tile card (used in explore grid) */
export function SkeletonTile() {
  return (
    <div className="rounded-3xl bg-slate-100 p-4 flex flex-col justify-between" style={{ minHeight: 120 }}>
      <div className="w-11 h-11 rounded-2xl skeleton-shimmer" />
      <div className="space-y-1.5 mt-3">
        <div className="h-3.5 w-16 skeleton-shimmer rounded-full" />
        <div className="h-2.5 w-24 skeleton-shimmer rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for a card row (schedule, etc.) */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card px-4 py-3.5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-2xl skeleton-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 skeleton-shimmer rounded-full"
            style={{ width: i === 0 ? '70%' : '45%' }}
          />
        ))}
      </div>
    </div>
  );
}

/** Full page loading skeleton for a list view */
export function SkeletonPage() {
  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="h-5 w-32 skeleton-shimmer rounded-full mb-4" />
      {[1, 2, 3, 4].map(i => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
