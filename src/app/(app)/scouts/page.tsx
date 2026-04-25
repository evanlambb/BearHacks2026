import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ScoutsPage() {
  const { supabase, user } = await requireUser();

  const { data: scouts } = await supabase
    .from("scouts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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
            Each scout runs every six hours against fresh WIPO and EPO data.
          </p>
        </div>
        <Link href="/create-scout" className="btn btn-primary">
          <Plus className="h-3.5 w-3.5" />
          Create Scout
        </Link>
      </div>

      {scouts && scouts.length > 0 ? (
        <div className="surface overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Therapeutic area</th>
                <th className="px-4 py-2.5">Signal</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Last run</th>
                <th className="px-4 py-2.5">Next run</th>
              </tr>
            </thead>
            <tbody>
              {scouts.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-muted)]"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/scouts/${s.id}`}
                      className="font-medium text-[color:var(--color-ink)] hover:underline"
                    >
                      {s.name ?? "Untitled scout"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[color:var(--color-ink-muted)]">
                    {s.therapeutic_area}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="kbd">{s.patent_signal_type}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                    {s.last_run_at ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 mono text-[color:var(--color-ink-muted)]">
                    {s.next_run_at ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="surface flex flex-col items-start p-8">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
            No scouts yet
          </div>
          <p className="mt-2 max-w-md text-[13px] text-[color:var(--color-ink-muted)]">
            Create a scout to start ingesting WIPO and EPO patent data on a
            6-hour cadence and surface generic-eligible opportunities.
          </p>
          <Link href="/create-scout" className="btn btn-primary mt-5">
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
    active: "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    paused: "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    error: "text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/8",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? ""}`}
    >
      {status}
    </span>
  );
}
