import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";

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
      "id, patent_id, drug_name, region, signal_type, report_status, generated_at",
    )
    .eq("scout_id", scout.id)
    .order("created_at", { ascending: false })
    .limit(50);

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
            <span className="kbd">{scout.patent_signal_type}</span>
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Status" value={scout.status} />
        <Field label="Countries" value={scout.countries.join(", ") || "—"} />
        <Field
          label="Last run"
          value={scout.last_run_at ?? "—"}
          mono
        />
        <Field
          label="Next run"
          value={scout.next_run_at ?? "—"}
          mono
        />
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
          Opportunities
        </h2>
        {reports && reports.length > 0 ? (
          <div className="surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
                  <th className="px-4 py-2.5">Drug</th>
                  <th className="px-4 py-2.5">Region</th>
                  <th className="px-4 py-2.5">Signal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Generated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-muted)]"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/${scout.id}/${r.patent_id}`}
                        className="font-medium text-[color:var(--color-ink)] hover:underline"
                      >
                        {r.drug_name ?? r.patent_id ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                      {r.region ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="kbd">{r.signal_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--color-ink-muted)] capitalize">
                      {r.report_status}
                    </td>
                    <td className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                      {r.generated_at ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="surface p-6 text-[13px] text-[color:var(--color-ink-muted)]">
            No opportunities yet. The scout will run on its next 6-hour tick.
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
