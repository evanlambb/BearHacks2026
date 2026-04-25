import { NextResponse } from "next/server";
import { z } from "zod";
import { timeline } from "@/lib/pipeline";
import { isDemoMode, goldenTimeline, sleep } from "@/lib/golden";

const BodySchema = z.object({ ndaNumber: z.string().min(1) });

/** Patent Timeline endpoint. POST { ndaNumber } -> PatentTimelineResponse. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parse.error.issues },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      await sleep(2200);
      return NextResponse.json(goldenTimeline());
    }

    const result = await timeline(parse.data.ndaNumber);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/scout/timeline]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
