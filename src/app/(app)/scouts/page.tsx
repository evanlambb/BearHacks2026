import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ScoutsPage() {
  await requireUser();
  const supabase = await getSupabaseServer();

  const [scoutsRes, reportsRes] = await Promise.all([
    supabase
      .from("scouts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("opportunity_reports").select("id, scout_id"),
  ]);

  if (scoutsRes.error) throw scoutsRes.error;
  if (reportsRes.error) throw reportsRes.error;

  const scouts = scoutsRes.data ?? [];
  const reportCounts = new Map<string, number>();
  for (const r of reportsRes.data ?? []) {
    if (!r.scout_id) continue;
    reportCounts.set(r.scout_id, (reportCounts.get(r.scout_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            Scouts
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Your scouts
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
            Every scout runs every six hours and continuously surfaces reportable
            opportunities.
          </p>
        </div>
        <Link
          href="/create-scout"
          data-testid="scouts-create-button"
          className="btn btn-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Scout
        </Link>
      </div>

      {scouts.length > 0 ? (
        <div
          className="surface overflow-hidden"
          data-testid="scouts-list"
          role="table"
          aria-label="Scouts"
        >
          <div className="hidden border-b border-[color:var(--color-border)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)] md:grid md:grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1fr_0.8fr]">
            <div className="px-4 py-2.5">Scout</div>
            <div className="px-4 py-2.5">Countries</div>
            <div className="px-4 py-2.5">Therapeutic area</div>
            <div className="px-4 py-2.5">Modality</div>
            <div className="px-4 py-2.5">Signal</div>
            <div className="px-4 py-2.5">Last run</div>
            <div className="px-4 py-2.5">Reports</div>
          </div>
          <ul role="rowgroup">
            {scouts.map((s, idx) => {
              const fallbackName = `${s.therapeutic_area} · ${readableSignal(
                s.patent_signal_type,
              )}`;
              return (
                <li key={s.id} role="row" data-testid="scout-row">
                  <Link
                    href={`/scouts/${s.id}`}
                    data-testid={`scout-link-${s.id}`}
                    className="block border-b border-[color:var(--color-border)] transition-colors hover:bg-[color:var(--color-surface-muted)] last:border-0"
                  >
                    <div className="flex flex-col gap-2 px-4 py-3 md:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium text-[color:var(--color-ink)]">
                            {s.name?.trim() || fallbackName}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                            {s.countries.join(", ") || "—"}
                          </div>
                        </div>
                        <StatusPill status={s.status} />
                      </div>
                      <div className="text-[12px] text-[color:var(--color-ink-muted)]">
                        {s.therapeutic_area} · {s.modality}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="kbd">
                          {readableSignal(s.patent_signal_type)}
                        </span>
                        <span className="mono text-[color:var(--color-ink-subtle)]">
                          {formatDate(s.last_run_at)}
                        </span>
                      </div>
                    </div>

                    <div className="hidden items-center text-[13px] md:grid md:grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1fr_0.8fr]">
                      <div className="px-4 py-2.5">
                        <div className="font-medium text-[color:var(--color-ink)]">
                          {s.name?.trim() || fallbackName}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[color:var(--color-ink-subtle)]">
                          #{idx + 1}
                        </div>
                      </div>
                      <div className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                        {s.countries.join(", ") || "—"}
                      </div>
                      <div className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                        {s.therapeutic_area}
                      </div>
                      <div className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                        {s.modality}
                      </div>
                      <div className="px-4 py-2.5">
                        <span className="kbd">
                          {readableSignal(s.patent_signal_type)}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                        {formatDate(s.last_run_at)}
                      </div>
                      <div className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                        {reportCounts.get(s.id) ?? 0}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div
          className="surface flex flex-col items-start p-8"
          data-testid="scouts-empty"
        >
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
            No scouts yet
          </div>
          <p className="mt-2 max-w-md text-[13px] text-[color:var(--color-ink-muted)]">
            Create a scout to start ingesting WIPO and EPO filings and
            generating opportunity reports on a 6-hour cadence.
          </p>
          <Link
            href="/create-scout"
            data-testid="scouts-empty-create-button"
            className="btn btn-primary mt-5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first scout
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:
      "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    paused:
      "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    error:
      "text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/8",
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
