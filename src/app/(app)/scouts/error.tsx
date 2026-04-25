"use client";

export default function ScoutsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="surface p-8" data-testid="scouts-error">
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-danger)]">
        Unable to load scouts
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-ink-muted)]">
        {error.message || "An unexpected error occurred while loading scouts."}
      </p>
      <button type="button" onClick={reset} className="btn btn-secondary mt-5">
        Try again
      </button>
    </div>
  );
}
