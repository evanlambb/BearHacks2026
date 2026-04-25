import { NextResponse } from "next/server";
import { z } from "zod";
import { summarize } from "@/lib/pipeline";
import { isDemoMode, goldenSummary, sleep } from "@/lib/golden";

const BodySchema = z.object({ ndaNumber: z.string().min(1) });

/** Drug Summary endpoint. POST { ndaNumber } -> DrugSummaryResponse. */
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
      await sleep(1500);
      return NextResponse.json(goldenSummary());
    }

    const result = await summarize(parse.data.ndaNumber);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/scout/summary]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
