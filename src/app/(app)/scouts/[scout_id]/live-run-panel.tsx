"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Loader2 } from "lucide-react";

type LiveStatusPayload = {
  latestRun: {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    patents_reviewed: number;
    opportunities_found: number;
    error_message: string | null;
  } | null;
  reportCounts: {
    pending: number;
    generating: number;
    complete: number;
    error: number;
  };
  matchCounts: {
    pending: number;
    matched: number;
    rejected: number;
    error: number;
  };
  recentEvents: Array<{ ts: string; label: string; kind: string }>;
};

export function LiveRunPanel({
  scoutId,
  initialLatestRun,
  initialReportCounts,
}: {
  scoutId: string;
  initialLatestRun: LiveStatusPayload["latestRun"];
  initialReportCounts: LiveStatusPayload["reportCounts"];
}) {
  const [payload, setPayload] = useState<LiveStatusPayload>({
    latestRun: initialLatestRun,
    reportCounts: initialReportCounts,
    matchCounts: { pending: 0, matched: 0, rejected: 0, error: 0 },
    recentEvents: [],
  });
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/scouts/${scoutId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as LiveStatusPayload & { ok: boolean };
        if (!cancelled && json.ok) {
          setPayload({
            latestRun: json.latestRun,
            reportCounts: json.reportCounts,
            matchCounts: json.matchCounts,
            recentEvents: json.recentEvents,
          });
        }
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    load();
    const interval = setInterval(load, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scoutId]);

  const progress = useMemo(() => {
    const stagesDone =
      payload.latestRun?.status === "complete"
        ? 4
        : payload.reportCounts.generating > 0
          ? 3
          : payload.matchCounts.pending > 0
            ? 2
            : payload.latestRun?.status === "running"
              ? 1
              : 0;
    return Math.min(100, Math.round((stagesDone / 4) * 100));
  }, [payload]);

  return (
    <section className="surface overflow-hidden p-0" data-testid="live-run-panel">
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--color-accent),oklch(78%_0.08_250),var(--color-accent))]" />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
              Live Run Monitor
            </div>
            <div className="mt-1 flex items-center gap-2 text-[14px] font-medium">
              {payload.latestRun?.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-accent)]" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
              )}
              {payload.latestRun
                ? `Run status: ${payload.latestRun.status}`
                : "Waiting for run"}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-ink-muted)]">
            <Activity className="h-3.5 w-3.5" />
            {isFetching ? "Refreshing..." : "Live auto-refresh every 1s"}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[12px] text-[color:var(--color-ink-muted)]">
            <span>Pipeline Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[color:var(--color-surface-muted)]">
            <div
              className="h-2 rounded-full bg-[color:var(--color-accent)] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Patents reviewed" value={String(payload.latestRun?.patents_reviewed ?? 0)} />
          <Metric label="Matches found" value={String(payload.matchCounts.matched)} />
          <Metric label="Reports generating" value={String(payload.reportCounts.generating)} />
          <Metric label="Reports complete" value={String(payload.reportCounts.complete)} />
        </div>

        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
            Activity Feed
          </div>
          <div className="space-y-1.5 text-[12px] text-[color:var(--color-ink-muted)]">
            {(payload.recentEvents.length > 0 ? payload.recentEvents : [{ ts: new Date().toISOString(), label: "No events yet", kind: "idle" }]).map((evt, idx) => (
              <div key={`${evt.ts}-${idx}`} className="flex items-center justify-between gap-3">
                <span>{evt.label}</span>
                <span className="mono text-[11px]">{formatTime(evt.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toISOString().slice(11, 19);
}

