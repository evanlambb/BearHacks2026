"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";

type LiveRunBannerProps = {
  runCount: number;
  scoutName: string;
  startedAt: string;
  patentsReviewed: number;
  reportsGenerating: number;
  reportsComplete: number;
  isStale: boolean;
};

export function LiveRunBanner({
  runCount,
  scoutName,
  startedAt,
  patentsReviewed,
  reportsGenerating,
  reportsComplete,
  isStale,
}: LiveRunBannerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = useMemo(() => {
    const start = new Date(startedAt).getTime();
    if (Number.isNaN(start)) return "00:00";
    const total = Math.max(0, Math.floor((now - start) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [now, startedAt]);

  return (
    <div className="sticky top-16 z-40 mb-4">
      <div
        className={
          isStale
            ? "surface overflow-hidden border-[color:var(--color-warning)]/45 bg-[color:var(--color-warning)]/10"
            : "surface overflow-hidden border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent-muted)]"
        }
      >
        <div
          className={
            isStale
              ? "h-1.5 w-full bg-[linear-gradient(90deg,var(--color-warning),oklch(82%_0.1_85),var(--color-warning))]"
              : "h-1.5 w-full animate-pulse bg-[linear-gradient(90deg,var(--color-accent),oklch(78%_0.08_250),var(--color-accent))]"
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[color:var(--color-ink)]">
              <span className="relative inline-flex h-2.5 w-2.5">
                {!isStale ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-accent)] opacity-60" />
                ) : null}
                <span
                  className={
                    isStale
                      ? "relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--color-warning)]"
                      : "relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--color-accent)]"
                  }
                />
              </span>
              {isStale ? "Pipeline may be stalled" : "Pipeline running"}
              <Activity
                className={
                  isStale
                    ? "h-3.5 w-3.5 text-[color:var(--color-warning)]"
                    : "h-3.5 w-3.5 text-[color:var(--color-accent)]"
                }
              />
            </div>
            <p className="mt-1 truncate text-[12px] text-[color:var(--color-ink-muted)]">
              {scoutName} · Patents reviewed: {patentsReviewed.toLocaleString()} · Reports generating: {reportsGenerating} · Complete: {reportsComplete}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[12px]">
            {runCount > 1 ? (
              <span className="pill bg-[color:var(--color-surface)] text-[color:var(--color-ink-muted)]">
                +{runCount - 1} more running
              </span>
            ) : null}
            <span className="pill bg-[color:var(--color-surface)] text-[color:var(--color-ink)]">
              Elapsed <span className="mono">{elapsed}</span>
            </span>
            {isStale ? (
              <span className="pill border-[color:var(--color-warning)]/40 bg-[color:var(--color-surface)] text-[color:var(--color-warning)]">
                No completion update for 15m+
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
