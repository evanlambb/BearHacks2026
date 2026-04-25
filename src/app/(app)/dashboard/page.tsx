import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Plus } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader />

      <Suspense fallback={<MetricsSkeleton />}>
        <Metrics />
      </Suspense>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
              Opportunities
            </h2>
            <p className="mt-1 text-[13px] text-[color:var(--color-ink-muted)]">
              Reports surfaced across all of your scouts.
            </p>
          </div>
          <Link
            href="/scouts"
            data-testid="go-to-scouts"
            className="btn btn-secondary"
          >
            Go to Scouts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Suspense fallback={<TableSkeleton />}>
          <OpportunitiesTable />
        </Suspense>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Header                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function PageHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
          Overview
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
          Live metrics from your patent scouts. Each scout ingests fresh WIPO
          and EPO filings every six hours.
        </p>
      </div>
      <Link
        href="/create-scout"
        data-testid="create-scout-button"
        className="btn btn-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Scout
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Metrics                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

async function Metrics() {
  const supabase = await getSupabaseServer();

  // RLS scopes each query to the caller's data. Fan out in parallel.
  const [scoutsRes, runsRes, opportunitiesRes] = await Promise.all([
    supabase
      .from("scouts")
      .select("id", { count: "exact", head: true }),
    supabase.from("scout_runs").select("patents_reviewed"),
    supabase
      .from("opportunity_reports")
      .select("id", { count: "exact", head: true })
      .eq("report_status", "complete"),
  ]);

  const scoutCount = scoutsRes.count ?? 0;
  const patentsReviewed = (runsRes.data ?? []).reduce(
    (sum, r) => sum + (r.patents_reviewed ?? 0),
    0,
  );
  const opportunitiesFound = opportunitiesRes.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricCard
        testId="metric-patents-reviewed"
        label="Patents reviewed"
        value={patentsReviewed.toLocaleString()}
        hint="All scouts · all runs"
      />
      <MetricCard
        testId="metric-opportunities-found"
        label="Opportunities found"
        value={opportunitiesFound.toLocaleString()}
        hint="Reports marked complete"
      />
      <MetricCard
        testId="metric-scout-count"
        label="Number of scouts"
        value={scoutCount.toLocaleString()}
        hint={
          scoutCount === 0 ? "No scouts yet" : "Owned by you"
        }
      />
    </div>
  );
}

function MetricCard({
  testId,
  label,
  value,
  hint,
}: {
  testId: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface px-5 py-4" data-testid={testId}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-[color:var(--color-ink-subtle)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-3"
      data-testid="metrics-skeleton"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="surface px-5 py-4">
          <div className="h-2.5 w-24 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          <div className="mt-2 h-2 w-20 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Opportunities table                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

async function OpportunitiesTable() {
  const supabase = await getSupabaseServer();

  // Two queries in parallel: own-scout count for the empty-state branch,
  // and the most recent opportunity reports (RLS-scoped to the caller).
  const [scoutCountRes, reportsRes] = await Promise.all([
    supabase
      .from("scouts")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("opportunity_reports")
      .select(
        "id, scout_id, patent_id, drug_name, region, market_size_usd, signal_type, report_status, generated_at, created_at, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const scoutCount = scoutCountRes.count ?? 0;
  const reports = reportsRes.data ?? [];

  if (scoutCount === 0) {
    return <NoScoutsEmptyState />;
  }
  if (reports.length === 0) {
    return <NoOpportunitiesEmptyState />;
  }

  return (
    <div
      className="surface overflow-hidden"
      data-testid="opportunities-table"
      role="table"
      aria-label="Opportunities"
    >
      {/* Desktop column header (md+) */}
      <div
        role="row"
        className="hidden border-b border-[color:var(--color-border)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)] md:grid md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr]"
      >
        <div className="px-4 py-2.5">Drug</div>
        <div className="px-4 py-2.5">Region</div>
        <div className="px-4 py-2.5">Market size</div>
        <div className="px-4 py-2.5">Signal</div>
        <div className="px-4 py-2.5">Status</div>
        <div className="px-4 py-2.5">Generated</div>
      </div>

      <ul role="rowgroup">
        {reports.map((r) => {
          const isComplete = r.report_status === "complete";
          const inner = (
            <>
              {/* Mobile card layout */}
              <div className="flex flex-col gap-2 px-4 py-3 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">
                      {r.drug_name ?? r.patent_id ?? "—"}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                      {r.region ?? "—"} · {formatUsd(r.market_size_usd)}
                    </div>
                  </div>
                  <StatusPill
                    status={r.report_status}
                    error={r.error_message}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <SignalPill signal={r.signal_type} />
                  <span className="mono text-[color:var(--color-ink-subtle)]">
                    {formatDate(r.generated_at ?? r.created_at)}
                  </span>
                </div>
              </div>

              {/* Desktop grid row (md+) */}
              <div className="hidden items-center text-[13px] md:grid md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr]">
                <div
                  className={
                    isComplete
                      ? "px-4 py-2.5 font-medium text-[color:var(--color-ink)]"
                      : "px-4 py-2.5 font-medium text-[color:var(--color-ink-muted)]"
                  }
                >
                  {r.drug_name ?? r.patent_id ?? "—"}
                </div>
                <div className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                  {r.region ?? "—"}
                </div>
                <div className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                  {formatUsd(r.market_size_usd)}
                </div>
                <div className="px-4 py-2.5">
                  <SignalPill signal={r.signal_type} />
                </div>
                <div className="px-4 py-2.5">
                  <StatusPill
                    status={r.report_status}
                    error={r.error_message}
                  />
                </div>
                <div className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                  {formatDate(r.generated_at ?? r.created_at)}
                </div>
              </div>
            </>
          );

          return (
            <li
              key={r.id}
              role="row"
              data-testid="opportunity-row"
              data-status={r.report_status}
              className="border-b border-[color:var(--color-border)] last:border-0"
            >
              {isComplete ? (
                <Link
                  href={`/${r.scout_id}/${r.patent_id}`}
                  className="block transition-colors hover:bg-[color:var(--color-surface-muted)]"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  aria-disabled
                  title={
                    r.report_status === "error"
                      ? (r.error_message ?? "Report errored")
                      : "Report not ready yet"
                  }
                  className="block cursor-not-allowed opacity-90"
                >
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="surface overflow-hidden" data-testid="opportunities-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[color:var(--color-border)] px-4 py-3 last:border-0"
        >
          <div className="h-3 w-40 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
          <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Empty states                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function NoScoutsEmptyState() {
  return (
    <div
      className="surface flex flex-col items-start p-8"
      data-testid="empty-no-scouts"
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
        No scouts yet
      </div>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">
        Create your first scout to start ingesting patent data
      </h3>
      <p className="mt-2 max-w-xl text-[13px] text-[color:var(--color-ink-muted)]">
        Define a thesis once. Patent Scout will continuously ingest WIPO and EPO
        filings every six hours and surface investment-grade opportunities here.
      </p>
      <Link
        href="/create-scout"
        data-testid="empty-create-scout"
        className="btn btn-primary mt-5"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Scout
      </Link>
    </div>
  );
}

function NoOpportunitiesEmptyState() {
  return (
    <div
      className="surface flex flex-col items-start p-8"
      data-testid="empty-no-opportunities"
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
        Awaiting first run
      </div>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">
        Opportunities will appear here once your scouts have run
      </h3>
      <p className="mt-2 max-w-xl text-[13px] text-[color:var(--color-ink-muted)]">
        Scouts run every six hours. Each run ingests fresh WIPO and EPO filings,
        triages candidates with Gemini, and produces deep-research reports for
        the strongest matches.
      </p>
      <Link
        href="/scouts"
        className="btn btn-secondary mt-5"
      >
        View scouts
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Cell helpers                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function formatUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function SignalPill({ signal }: { signal: string }) {
  const label =
    signal === "patent_expiry"
      ? "Patent expiry"
      : signal === "non_filed_region"
        ? "Non-filed region"
        : signal;
  return <span className="kbd">{label}</span>;
}

function StatusPill({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  const map: Record<string, { label: string; cls: string; title?: string }> = {
    complete: {
      label: "Complete",
      cls: "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    },
    pending: {
      label: "Pending",
      cls: "text-[color:var(--color-ink-muted)] border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-muted)]",
    },
    generating: {
      label: "Generating…",
      cls: "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    },
    error: {
      label: "Error",
      cls: "text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-muted)]",
      title: error ?? undefined,
    },
  };
  const m = map[status] ?? {
    label: status,
    cls: "text-[color:var(--color-ink-muted)] border-[color:var(--color-border-strong)]",
  };
  return (
    <span
      title={m.title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
