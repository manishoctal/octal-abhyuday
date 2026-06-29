import { SkeletonCard, SkeletonTile } from './Skeleton';

/**
 * Instant loading shell used by Next.js App Router loading.tsx boundaries.
 * Renders synchronously from the client cache — no server round-trip needed.
 */
export default function PageLoadingSkeleton({
  title,
  rows = 4,
  grid = false,
  tiles = false,
}: {
  title?: string;
  rows?: number;
  /** Photo-grid variant (2-column square tiles) */
  grid?: boolean;
  /** Dashboard tile variant */
  tiles?: boolean;
}) {
  return (
    <>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 w-full"
        style={{
          background: '#0F1035',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-4 w-28 rounded-full skeleton-shimmer opacity-50" />
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-xl skeleton-shimmer opacity-30" />
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-28">
        {title && (
          <div className="h-5 w-36 rounded-full skeleton-shimmer mb-4" />
        )}

        {grid ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : tiles ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonCard key={i} lines={i % 3 === 0 ? 1 : 2} />
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom nav placeholder ── */}
      <div
        className="fixed bottom-0 inset-x-0 h-[60px]"
        style={{
          background: 'rgba(9,9,18,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      />
    </>
  );
}
