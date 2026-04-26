import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { StatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

export default async function ScoutDetailPage({
  params,
}: {
  params: Promise<{ scout_id: string }>;
}) {
  const { scout_id } = await params;
  const { supabase, user } = await requireUser();

  const { data: scout } = await supabase
    .from("scouts")
    .select("*")
    .eq("id", scout_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!scout) notFound();

  const { data: reports } = await supabase
    .from("opportunity_reports")
    .select(
      "id, patent_id, drug_name, region, market_size_usd, signal_type, report_status, generated_at, created_at, error_message",
    )
    .eq("scout_id", scout.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: latestRun } = await supabase
    .from("scout_runs")
    .select("status, started_at, finished_at, patents_reviewed, opportunities_found, error_message")
    .eq("scout_id", scout.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reportStatusCounts = {
    pending: (reports ?? []).filter((r) => r.report_status === "pending").length,
    generating: (reports ?? []).filter((r) => r.report_status === "generating")
      .length,
    complete: (reports ?? []).filter((r) => r.report_status === "complete").length,
    error: (reports ?? []).filter((r) => r.report_status === "error").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/scouts"
          className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All scouts
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            Scout · <span className="mono normal-case">{scout.id.slice(0, 8)}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {scout.name ?? "Untitled scout"}
          </h1>
          <p className="mt-1.5 text-[13px] text-[color:var(--color-ink-muted)]">
            {scout.therapeutic_area} · {scout.modality} ·{" "}
            <span className="kbd">{readableSignal(scout.patent_signal_type)}</span>
          </p>
        </div>
        <StatusActions scoutId={scout.id} status={scout.status} />
      </div>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="scout-filters"
      >
        <Field label="Name" value={scout.name?.trim() || generatedFallbackName(scout)} />
        <Field label="Countries" value={scout.countries.join(", ") || "—"} />
        <Field label="Therapeutic area" value={scout.therapeutic_area} />
        <Field label="Patent signal type" value={readableSignal(scout.patent_signal_type)} />
        <Field
          label={
            scout.patent_signal_type === "patent_expiry"
              ? "Expiry horizon (months)"
              : "Non-filed lookback (years)"
          }
          value={
            scout.patent_signal_type === "patent_expiry"
              ? String(scout.expiry_time_horizon_months ?? "—")
              : String(scout.non_filed_lookback_years ?? "—")
          }
        />
        <Field label="Modality" value={scout.modality} />
        <Field
          label="Market floor USD"
          value={formatNumber(scout.market_floor_usd)}
          mono
        />
        <Field
          label="Minimum unit volume"
          value={formatNumber(scout.minimum_unit_volume)}
          mono
        />
        <Field
          label="Capex min USD"
          value={formatNumber(scout.capex_min_usd)}
          mono
        />
        <Field
          label="Capex max USD"
          value={formatNumber(scout.capex_max_usd)}
          mono
        />
        <Field label="Status" value={scout.status} />
        <Field
          label="Last run"
          value={formatDateTime(scout.last_run_at)}
          mono
        />
        <Field
          label="Next run"
          value={formatDateTime(scout.next_run_at)}
          mono
        />
      </section>

      <section className="surface p-4" data-testid="scout-latest-run">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
          Latest run
        </div>
        {latestRun ? (
          <div className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex items-center gap-2">
              <StatusPill status={latestRun.status} />
              <span className="mono text-[color:var(--color-ink-muted)]">
                Started {formatDateTime(latestRun.started_at)}
              </span>
            </div>
            <div className="text-[color:var(--color-ink-muted)]">
              Patents reviewed: {latestRun.patents_reviewed} · Opportunities found:{" "}
              {latestRun.opportunities_found}
            </div>
            <div className="mono text-[12px] text-[color:var(--color-ink-subtle)]">
              Finished {formatDateTime(latestRun.finished_at)}
            </div>
            {latestRun.error_message ? (
              <div className="text-[12px] text-[color:var(--color-danger)]">
                {latestRun.error_message}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 text-[13px] text-[color:var(--color-ink-muted)]">
            No run recorded yet.
          </div>
        )}
      </section>

      <section className="surface p-4" data-testid="scout-pipeline-stepper">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
          Pipeline progress
        </div>
        <PipelineStepper
          latestRun={latestRun}
          reportStatusCounts={reportStatusCounts}
        />
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
          Reports
        </h2>
        {reports && reports.length > 0 ? (
          <div className="surface overflow-hidden">
            <table className="w-full text-[13px]" data-testid="scout-reports-table">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
                  <th className="px-4 py-2.5">Drug</th>
                  <th className="px-4 py-2.5">Region</th>
                  <th className="px-4 py-2.5">Market size</th>
                  <th className="px-4 py-2.5">Signal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Generated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    data-testid="scout-report-row"
                    data-status={r.report_status}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-muted)]"
                  >
                    <td className="px-4 py-2.5">
                      {r.report_status === "complete" ? (
                        <Link
                          href={`/${scout.id}/${r.patent_id}`}
                          className="font-medium text-[color:var(--color-ink)] hover:underline"
                        >
                          {r.drug_name ?? r.patent_id ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[color:var(--color-ink-muted)]">
                          {r.drug_name ?? r.patent_id ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                      {r.region ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                      {formatCurrency(r.market_size_usd)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="kbd">{readableSignal(r.signal_type)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={r.report_status} />
                      {r.report_status === "error" && r.error_message ? (
                        <div className="mt-1 text-[11px] text-[color:var(--color-danger)]">
                          {r.error_message}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                      {formatDateTime(r.generated_at ?? r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="surface p-6 text-[13px] text-[color:var(--color-ink-muted)]"
            data-testid="scout-reports-empty"
          >
            No reports yet. This scout will generate report candidates after the
            next run.
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="surface px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-[13px] text-[color:var(--color-ink)] ${mono ? "mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete:
      "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    pending:
      "text-[color:var(--color-ink-muted)] border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-muted)]",
    generating:
      "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    running:
      "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    error:
      "text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/8",
    active:
      "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    paused:
      "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function readableSignal(signal: string) {
  if (signal === "patent_expiry") return "Patent Expiry";
  if (signal === "non_filed_region") return "Non-Filed Region";
  return signal;
}

function formatCurrency(v: number | null) {
  if (v == null) return "—";
  return `$${v.toLocaleString()}`;
}

function formatNumber(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString();
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function generatedFallbackName(scout: {
  therapeutic_area: string;
  modality: string;
  patent_signal_type: string;
}) {
  return `${scout.therapeutic_area} · ${scout.modality} · ${readableSignal(scout.patent_signal_type)}`;
}

function PipelineStepper({
  latestRun,
  reportStatusCounts,
}: {
  latestRun:
    | {
        status: string;
        patents_reviewed: number;
        opportunities_found: number;
        started_at: string;
        finished_at: string | null;
        error_message: string | null;
      }
    | null;
  reportStatusCounts: {
    pending: number;
    generating: number;
    complete: number;
    error: number;
  };
}) {
  const steps = [
    "Ingest patents",
    "Run AI matching",
    "Deep research",
    "Generate reports",
    "Finalize output",
  ];

  const currentIndex = deriveCurrentStep(latestRun, reportStatusCounts);
  const hasError =
    latestRun?.status === "error" || reportStatusCounts.error > 0;

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {steps.map((step, idx) => {
          const state = hasError
            ? idx <= currentIndex
              ? "error"
              : "upcoming"
            : idx < currentIndex
              ? "complete"
              : idx === currentIndex
                ? "current"
                : "upcoming";
          return (
            <div
              key={step}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    state === "complete"
                      ? "inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-success)]"
                      : state === "current"
                        ? "inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--color-accent)]"
                        : state === "error"
                          ? "inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-danger)]"
                          : "inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-border-strong)]"
                  }
                />
                <span className="text-[12px] font-medium text-[color:var(--color-ink)]">
                  {step}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-[color:var(--color-ink-muted)]">
        {hasError
          ? "Pipeline hit an error. Check latest run details below."
          : latestRun?.status === "running"
            ? "Pipeline is running now. Steps update automatically as work progresses."
            : latestRun?.status === "complete"
              ? "Latest pipeline run completed successfully."
              : "Waiting for next pipeline run."}
      </p>
    </div>
  );
}

function deriveCurrentStep(
  latestRun: {
    status: string;
    patents_reviewed: number;
  } | null,
  reportStatusCounts: {
    pending: number;
    generating: number;
    complete: number;
    error: number;
  },
) {
  if (!latestRun) return 0;
  if (latestRun.status === "error") return 3;
  if (latestRun.status === "complete") return 4;
  if (latestRun.patents_reviewed <= 0) return 0;
  if (reportStatusCounts.pending > 0) return 1;
  if (reportStatusCounts.generating > 0) return 3;
  return 2;
}
