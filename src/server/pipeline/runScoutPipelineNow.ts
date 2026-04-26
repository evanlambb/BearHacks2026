import { processPendingScoutPatentMatches } from "../ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runScout } from "../patents";
import { processPendingDeepDiveReports } from "../research";
import { processGeneratingOpportunityReports } from "../reports";

export type RunScoutPipelineNowResult = {
  scoutId: string;
  ingest: Awaited<ReturnType<typeof runScout>>;
  matching: Awaited<ReturnType<typeof processPendingScoutPatentMatches>>;
  research: Awaited<ReturnType<typeof processPendingDeepDiveReports>>;
  reports: Awaited<ReturnType<typeof processGeneratingOpportunityReports>>;
};

export async function runScoutPipelineNow(scoutId: string): Promise<RunScoutPipelineNowResult> {
  const ingest = await runScout(scoutId);
  const matching = await processPendingScoutPatentMatches({ scoutId });
  const research = await processPendingDeepDiveReports({ scoutId });
  const reports = await processGeneratingOpportunityReports({ scoutId });

  return {
    scoutId,
    ingest,
    matching,
    research,
    reports,
  };
}

export async function runTrackedScoutPipelineNow(
  scoutId: string,
): Promise<RunScoutPipelineNowResult> {
  const supabase = getSupabaseAdmin();

  const { data: runRow, error: startError } = await supabase
    .from("scout_runs")
    .insert({
      scout_id: scoutId,
      status: "running",
      patents_reviewed: 0,
      opportunities_found: 0,
    })
    .select("id")
    .single();

  if (startError) {
    throw new Error(`Unable to start scout run: ${startError.message}`);
  }

  const startedAtIso = new Date().toISOString();
  await supabase
    .from("scouts")
    .update({ last_run_at: startedAtIso })
    .eq("id", scoutId);

  try {
    const result = await runScoutPipelineNow(scoutId);
    const opportunitiesFound = result.reports.completed;

    const { error: completeError } = await supabase
      .from("scout_runs")
      .update({
        status: "complete",
        finished_at: new Date().toISOString(),
        patents_reviewed: result.ingest.patentsReviewed,
        opportunities_found: opportunitiesFound,
        error_message: result.ingest.errors.length ? result.ingest.errors.join("\n") : null,
      })
      .eq("id", runRow.id);

    if (completeError) {
      throw new Error(`Unable to complete scout run: ${completeError.message}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("scout_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runRow.id);
    throw error;
  }
}
