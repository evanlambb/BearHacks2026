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

function logPipelineEvent(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    scope: "scout-pipeline",
    event,
    ...fields,
  };
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

async function runStage<T>(
  runId: string,
  scoutId: string,
  stage: "ingest" | "matching" | "research" | "reports",
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  const started = Date.now();
  logPipelineEvent("info", "stage.start", { runId, scoutId, stage });
  const wrapped = timeoutMs
    ? new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Stage '${stage}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        fn().then(
          (result) => {
            clearTimeout(timer);
            resolve(result);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      })
    : fn();
  try {
    const result = await wrapped;
    logPipelineEvent("info", "stage.complete", {
      runId,
      scoutId,
      stage,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    logPipelineEvent("error", "stage.error", {
      runId,
      scoutId,
      stage,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

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
  const pipelineStartedAt = Date.now();

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
    logPipelineEvent("error", "run.start.error", {
      scoutId,
      error: startError.message,
    });
    throw new Error(`Unable to start scout run: ${startError.message}`);
  }

  logPipelineEvent("info", "run.start", { runId: runRow.id, scoutId });

  const startedAtIso = new Date().toISOString();
  await supabase
    .from("scouts")
    .update({ last_run_at: startedAtIso })
    .eq("id", scoutId);

  try {
    const envBatchLimit = Number(
      process.env.SCOUT_PIPELINE_MATCH_BATCH_SIZE ??
        process.env.GEMINI_MATCH_LIMIT ??
        "",
    );
    const matchingBatchLimit =
      Number.isFinite(envBatchLimit) && envBatchLimit > 0
        ? envBatchLimit
        : 20;

    const matchingTimeoutMs = Number(
      process.env.SCOUT_PIPELINE_MATCHING_STAGE_TIMEOUT_MS ?? "",
    );
    const matchingStageTimeoutMs =
      Number.isFinite(matchingTimeoutMs) && matchingTimeoutMs > 0
        ? matchingTimeoutMs
        : undefined;

    logPipelineEvent("info", "matching.config", {
      runId: runRow.id,
      scoutId,
      matchingBatchLimit,
      matchingStageTimeoutMs: matchingStageTimeoutMs ?? null,
    });

    const ingest = await runStage(runRow.id, scoutId, "ingest", () =>
      runScout(scoutId),
    );
    await supabase
      .from("scout_runs")
      .update({ patents_reviewed: ingest.patentsReviewed })
      .eq("id", runRow.id);

    const matching = await runStage(runRow.id, scoutId, "matching", () =>
      processPendingScoutPatentMatches({ scoutId, limit: matchingBatchLimit }),
      matchingStageTimeoutMs,
    );
    const research = await runStage(runRow.id, scoutId, "research", () =>
      processPendingDeepDiveReports({ scoutId }),
    );
    const reports = await runStage(runRow.id, scoutId, "reports", () =>
      processGeneratingOpportunityReports({ scoutId }),
    );
    const result: RunScoutPipelineNowResult = {
      scoutId,
      ingest,
      matching,
      research,
      reports,
    };

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
      logPipelineEvent("error", "run.complete.error", {
        runId: runRow.id,
        scoutId,
        error: completeError.message,
      });
      throw new Error(`Unable to complete scout run: ${completeError.message}`);
    }

    logPipelineEvent("info", "run.complete", {
      runId: runRow.id,
      scoutId,
      durationMs: Date.now() - pipelineStartedAt,
      patentsReviewed: result.ingest.patentsReviewed,
      opportunitiesFound,
      ingestErrors: result.ingest.errors.length,
    });

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
    logPipelineEvent("error", "run.error", {
      runId: runRow.id,
      scoutId,
      durationMs: Date.now() - pipelineStartedAt,
      error: message,
    });
    throw error;
  }
}
