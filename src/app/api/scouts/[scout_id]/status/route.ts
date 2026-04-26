import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ scout_id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { scout_id } = await context.params;
  const { user, supabase } = await requireUser();

  const { data: scout, error: scoutError } = await supabase
    .from("scouts")
    .select("id")
    .eq("id", scout_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (scoutError) {
    return NextResponse.json(
      { error: "Failed to verify scout access." },
      { status: 500 },
    );
  }
  if (!scout) {
    return NextResponse.json({ error: "Scout not found." }, { status: 404 });
  }

  const [{ data: latestRun }, { data: reports }, { data: matches }] =
    await Promise.all([
      supabase
        .from("scout_runs")
        .select(
          "id, status, started_at, finished_at, patents_reviewed, opportunities_found, error_message",
        )
        .eq("scout_id", scout_id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("opportunity_reports")
        .select("id, report_status, created_at, updated_at")
        .eq("scout_id", scout_id),
      supabase
        .from("scout_patent_matches")
        .select("id, match_status, reviewed_at, created_at")
        .eq("scout_id", scout_id),
    ]);

  const reportCounts = {
    pending: (reports ?? []).filter((r) => r.report_status === "pending").length,
    generating: (reports ?? []).filter((r) => r.report_status === "generating")
      .length,
    complete: (reports ?? []).filter((r) => r.report_status === "complete").length,
    error: (reports ?? []).filter((r) => r.report_status === "error").length,
  };

  const matchCounts = {
    pending: (matches ?? []).filter((m) => m.match_status === "pending").length,
    matched: (matches ?? []).filter((m) => m.match_status === "matched").length,
    rejected: (matches ?? []).filter((m) => m.match_status === "rejected").length,
    error: (matches ?? []).filter((m) => m.match_status === "error").length,
  };

  const recentEvents = [
    ...(latestRun
      ? [
          {
            ts: latestRun.started_at,
            label: `Run ${latestRun.status}`,
            kind: latestRun.status,
          },
        ]
      : []),
    {
      ts: new Date().toISOString(),
      label: `${matchCounts.matched} matches, ${matchCounts.rejected} rejected`,
      kind: "matching",
    },
    {
      ts: new Date().toISOString(),
      label: `${reportCounts.complete} reports complete, ${reportCounts.generating} generating`,
      kind: "reports",
    },
  ];

  return NextResponse.json({
    ok: true,
    latestRun,
    reportCounts,
    matchCounts,
    recentEvents,
  });
}

