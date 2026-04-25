export default function ScoutsLoading() {
  return (
    <div className="space-y-6" data-testid="scouts-loading">
      <div className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-surface-muted)]" />
      <div className="surface overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[color:var(--color-border)] px-4 py-4 last:border-0"
          >
            <div className="h-3 w-36 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
            <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
