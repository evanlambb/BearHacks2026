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
  const activeCount = scouts.filter((s) => s.status === "active").length;
  const pausedCount = scouts.filter((s) => s.status === "paused").length;
  const errorCount = scouts.filter((s) => s.status === "error").length;
  const reportCounts = new Map<string, number>();
  for (const r of reportsRes.data ?? []) {
    if (!r.scout_id) continue;
    reportCounts.set(r.scout_id, (reportCounts.get(r.scout_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Scouts</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
            Manage automated searches for patent expiry and non-filed region opportunities.
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-3" data-testid="scouts-list" role="table" aria-label="Scouts">
            {scouts.map((s, idx) => {
              const fallbackName = `${s.therapeutic_area} · ${readableSignal(s.patent_signal_type)}`;
              return (
                <Link
                  key={s.id}
                  href={`/scouts/${s.id}`}
                  data-testid={`scout-link-${s.id}`}
                  className="surface block p-5 transition-colors hover:bg-[color:var(--color-surface-muted)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[20px] font-semibold tracking-tight text-[color:var(--color-ink)]">
                        {s.name?.trim() || fallbackName}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {s.countries.slice(0, 4).map((c) => (
                          <span key={c} className="pill bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)]">
                            {c}
                          </span>
                        ))}
                        {s.countries.length > 4 ? (
                          <span className="pill text-[color:var(--color-ink-subtle)]">+{s.countries.length - 4}</span>
                        ) : null}
                      </div>
                    </div>
                    <StatusPill status={s.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-[13px] lg:grid-cols-5">
                    <Stat label="Therapeutic Area" value={s.therapeutic_area} />
                    <Stat label="Modality" value={s.modality} />
                    <Stat label="Signal" value={readableSignal(s.patent_signal_type)} />
                    <Stat label="Last Run" value={formatDate(s.last_run_at)} mono />
                    <Stat label="Reports" value={String(reportCounts.get(s.id) ?? 0)} mono />
                  </div>
                  <div className="mt-2 text-[11px] text-[color:var(--color-ink-subtle)]">Scout #{idx + 1}</div>
                </Link>
              );
            })}
          </div>

          <aside className="surface p-4">
            <div className="text-[20px] font-semibold tracking-tight">Scout Health</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <HealthCard label="Running now" value={activeCount} />
              <HealthCard label="Paused" value={pausedCount} />
              <HealthCard label="Errors" value={errorCount} />
              <HealthCard label="Total scouts" value={scouts.length} />
            </div>
            {scouts[0] ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-[color:var(--color-ink)]">
                    {scouts[0].name?.trim() || "Latest scout"}
                  </div>
                  <StatusPill status={scouts[0].status} />
                </div>
                <div className="space-y-1 text-[12px] text-[color:var(--color-ink-muted)]">
                  <div>{scouts[0].therapeutic_area}</div>
                  <div>{scouts[0].modality}</div>
                  <div>{readableSignal(scouts[0].patent_signal_type)}</div>
                </div>
              </div>
            ) : null}
          </aside>
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

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div className={`mt-1 text-[13px] text-[color:var(--color-ink)] ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

function HealthCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="text-[11px] text-[color:var(--color-ink-subtle)]">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight">{value}</div>
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
