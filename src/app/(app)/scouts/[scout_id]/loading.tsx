export default function ScoutDetailLoading() {
  return (
    <div className="space-y-6" data-testid="scout-detail-loading">
      <div className="h-4 w-24 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
      <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-surface-muted)]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="surface h-16 animate-pulse bg-[color:var(--color-surface-muted)]"
          />
        ))}
      </div>
      <div className="surface h-56 animate-pulse bg-[color:var(--color-surface-muted)]" />
    </div>
  );
}
