import { NextResponse } from "next/server";
import { ScoutFilterSchema } from "@/lib/schema";
import { triage } from "@/lib/pipeline";
import { isDemoMode, goldenTriage, sleep } from "@/lib/golden";

/** Triage endpoint. POST { filter } -> TriageResponse. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parse = ScoutFilterSchema.safeParse(body?.filter);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid filter", issues: parse.error.issues },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      await sleep(400);
      return NextResponse.json(goldenTriage());
    }

    const result = await triage(parse.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/scout/triage]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
