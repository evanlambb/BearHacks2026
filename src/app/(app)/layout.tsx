import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { LiveRunBanner } from "./_components/live-run-banner";
import { TopNav } from "./_components/top-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser();
  const email = user.email ?? "";

  const { data: runningRuns } = await supabase
    .from("scout_runs")
    .select("id, scout_id, started_at, patents_reviewed")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(5);

  const primaryRun = runningRuns?.[0];

  let bannerData:
    | {
        runCount: number;
        scoutName: string;
        startedAt: string;
        patentsReviewed: number;
        reportsGenerating: number;
        reportsComplete: number;
        isStale: boolean;
      }
    | null = null;

  if (primaryRun?.scout_id) {
    const [scoutRes, reportsRes] = await Promise.all([
      supabase
        .from("scouts")
        .select("name, therapeutic_area")
        .eq("id", primaryRun.scout_id)
        .maybeSingle(),
      supabase
        .from("opportunity_reports")
        .select("report_status")
        .eq("scout_id", primaryRun.scout_id),
    ]);

    const scoutName =
      scoutRes.data?.name?.trim() ||
      scoutRes.data?.therapeutic_area ||
      "Active scout";

    const reportRows = reportsRes.data ?? [];
    const reportsGenerating = reportRows.filter(
      (r) => r.report_status === "generating",
    ).length;
    const reportsComplete = reportRows.filter(
      (r) => r.report_status === "complete",
    ).length;
    const startedAtMs = new Date(primaryRun.started_at).getTime();
    const isStale =
      !Number.isNaN(startedAtMs) &&
      Date.now() - startedAtMs > 15 * 60 * 1000;

    bannerData = {
      runCount: runningRuns?.length ?? 1,
      scoutName,
      startedAt: primaryRun.started_at,
      patentsReviewed: primaryRun.patents_reviewed ?? 0,
      reportsGenerating,
      reportsComplete,
      isStale,
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-bg)]">
      <header className="sticky top-0 z-50 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)] backdrop-blur-none">
        <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center gap-8 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-brand)]" />
            <span className="text-[22px] font-semibold leading-none tracking-tight">
              Scout
            </span>
          </Link>

          <TopNav email={email} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-6 py-8">
        {bannerData ? <LiveRunBanner {...bannerData} /> : null}
        {children}
      </main>

      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex h-11 w-full max-w-[1360px] items-center justify-between px-6 text-[11px] text-[color:var(--color-ink-subtle)]">
          <span>Patent Scout · WIPO + EPO ingestion · 6h cadence</span>
          <span className="mono">{user.id.slice(0, 8)}</span>
        </div>
      </footer>
    </div>
  );
}
