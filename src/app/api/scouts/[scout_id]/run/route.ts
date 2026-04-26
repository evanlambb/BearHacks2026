import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { runTrackedScoutPipelineNow } from "@/server/pipeline/runScoutPipelineNow";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ scout_id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { scout_id } = await context.params;
  const { user, supabase } = await requireUser();
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "scout-pipeline",
      event: "api.run-now.requested",
      scoutId: scout_id,
      userId: user.id,
    }),
  );

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

  try {
    const result = await runTrackedScoutPipelineNow(scout_id);
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: "scout-pipeline",
        event: "api.run-now.completed",
        scoutId: scout_id,
        userId: user.id,
      }),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: "scout-pipeline",
        event: "api.run-now.error",
        scoutId: scout_id,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
