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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isDemoPacingEnabled() {
  return process.env.DEMO_FORCE_REPORTS === "1" && process.env.DEMO_PACING_ENABLED === "1";
}

function getDemoStageDelayMs() {
  const parsed = Number(process.env.DEMO_PACING_STAGE_DELAY_MS ?? "");
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 1_500;
}

function getDemoSimulatedPatentsReviewedTarget() {
  const parsed = Number(process.env.DEMO_SIMULATED_PATENTS_REVIEWED ?? "");
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 12;
}

function getDemoReportStatusHoldMs() {
  const parsed = Number(process.env.DEMO_REPORT_STATUS_HOLD_MS ?? "");
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  // Keep statuses visible long enough for polling UIs.
  return 4_000;
}

function isDemoReportFlowSimulationEnabled() {
  if (process.env.DEMO_FORCE_REPORTS !== "1") return false;
  const raw = (process.env.DEMO_SIMULATE_REPORT_FLOW ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

async function maybePaceStage(
  runId: string,
  scoutId: string,
  marker: "post.ingest" | "post.matching" | "post.research" | "post.reports",
) {
  if (!isDemoPacingEnabled()) return;
  const delayMs = getDemoStageDelayMs();
  logPipelineEvent("info", "demo.pacing.wait.start", {
    runId,
    scoutId,
    marker,
    delayMs,
  });
  await sleep(delayMs);
  logPipelineEvent("info", "demo.pacing.wait.complete", {
    runId,
    scoutId,
    marker,
    delayMs,
  });
}

async function incrementPatentsReviewedForDemo(
  runId: string,
  scoutId: string,
  patentsReviewedTarget: number,
): Promise<void> {
  if (!isDemoPacingEnabled() || patentsReviewedTarget <= 0) return;
  const supabase = getSupabaseAdmin();
  const delayMs = getDemoStageDelayMs();
  const { data: currentRun } = await supabase
    .from("scout_runs")
    .select("patents_reviewed")
    .eq("id", runId)
    .maybeSingle();
  const currentValue = Math.max(0, currentRun?.patents_reviewed ?? 0);
  const boundedCurrent = Math.min(currentValue, patentsReviewedTarget);
  const delta = patentsReviewedTarget - boundedCurrent;
  if (delta <= 0) return;

  const maxTicks = 8;
  const ticks = Math.max(1, Math.min(maxTicks, delta));

  for (let tick = 1; tick <= ticks; tick += 1) {
    const value =
      boundedCurrent + Math.round((tick / ticks) * delta);
    await supabase
      .from("scout_runs")
      .update({ patents_reviewed: value })
      .eq("id", runId);
    logPipelineEvent("info", "demo.pacing.patents_reviewed", {
      runId,
      scoutId,
      tick,
      ticks,
      patentsReviewed: value,
      patentsReviewedTarget,
    });
    if (tick < ticks) {
      await sleep(delayMs);
    }
  }
}

function resolvePatentsReviewedTargetForDemo(
  ingestPatentsReviewed: number,
  matchingProcessed: number,
) {
  return Math.max(
    ingestPatentsReviewed,
    matchingProcessed,
    getDemoSimulatedPatentsReviewedTarget(),
  );
}

async function setPatentsReviewed(
  runId: string,
  value: number,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("scout_runs")
    .update({ patents_reviewed: value })
    .eq("id", runId);
  if (error) {
    throw new Error(`Unable to update patents_reviewed: ${error.message}`);
  }
}

type DemoReportTarget = {
  id: string;
  patentId: string | null;
};

async function resolveDemoReportTarget(
  scoutId: string,
): Promise<DemoReportTarget | null> {
  const supabase = getSupabaseAdmin();
  const { data: pendingReport } = await supabase
    .from("opportunity_reports")
    .select("id, patent_id")
    .eq("scout_id", scoutId)
    .eq("report_status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pendingReport?.id) {
    return {
      id: pendingReport.id,
      patentId: pendingReport.patent_id ?? null,
    };
  }

  const [{ data: matched }, { data: scout }] = await Promise.all([
    supabase
      .from("scout_patent_matches")
      .select("patent_id")
      .eq("scout_id", scoutId)
      .eq("match_status", "matched")
      .order("reviewed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("scouts")
      .select("patent_signal_type, countries")
      .eq("id", scoutId)
      .maybeSingle(),
  ]);

  if (!matched?.patent_id || !scout?.patent_signal_type) {
    return null;
  }

  const region = Array.isArray(scout.countries) ? scout.countries.join(", ") : null;
  const { data: inserted, error: insertError } = await supabase
    .from("opportunity_reports")
    .upsert(
      {
        scout_id: scoutId,
        patent_id: matched.patent_id,
        signal_type: scout.patent_signal_type,
        report_status: "pending",
        region,
      },
      { onConflict: "scout_id,patent_id", ignoreDuplicates: false },
    )
    .select("id, patent_id")
    .maybeSingle();

  if (insertError) {
    throw new Error(`Unable to create demo report target: ${insertError.message}`);
  }
  if (!inserted?.id) return null;

  return {
    id: inserted.id,
    patentId: inserted.patent_id ?? matched.patent_id,
  };
}

async function runDemoResearchStage(
  runId: string,
  scoutId: string,
  target: DemoReportTarget | null,
) {
  if (!target) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  const supabase = getSupabaseAdmin();
  await supabase
    .from("opportunity_reports")
    .update({
      report_status: "generating",
      error_message: null,
    })
    .eq("id", target.id);

  logPipelineEvent("info", "demo.report.status", {
    runId,
    scoutId,
    reportId: target.id,
    patentId: target.patentId,
    reportStatus: "generating",
  });

  await sleep(getDemoReportStatusHoldMs());
  return { processed: 1, succeeded: 1, failed: 0 };
}

async function runDemoReportsStage(
  runId: string,
  scoutId: string,
  target: DemoReportTarget | null,
) {
  if (!target) {
    return { processed: 0, completed: 0, failed: 0 };
  }
  const supabase = getSupabaseAdmin();
  await supabase
    .from("opportunity_reports")
    .update({
      report_status: "complete",
      generated_at: new Date().toISOString(),
      error_message: null,
      report_markdown:
        "# Demo Report (Simulated)\n\nThis report completion is simulated for live demo pacing. Full evidence synthesis and PDF rendering were intentionally skipped.",
    })
    .eq("id", target.id);

  logPipelineEvent("info", "demo.report.status", {
    runId,
    scoutId,
    reportId: target.id,
    patentId: target.patentId,
    reportStatus: "complete",
  });

  await sleep(getDemoReportStatusHoldMs());
  return { processed: 1, completed: 1, failed: 0 };
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
    if (isDemoPacingEnabled()) {
      const demoTarget = resolvePatentsReviewedTargetForDemo(
        ingest.patentsReviewed,
        0,
      );
      await incrementPatentsReviewedForDemo(
        runRow.id,
        scoutId,
        demoTarget,
      );
    } else {
      await setPatentsReviewed(runRow.id, ingest.patentsReviewed);
    }
    await maybePaceStage(runRow.id, scoutId, "post.ingest");

    const matching = await runStage(runRow.id, scoutId, "matching", () =>
      processPendingScoutPatentMatches({ scoutId, limit: matchingBatchLimit }),
      matchingStageTimeoutMs,
    );
    const effectivePatentsReviewed = Math.max(
      ingest.patentsReviewed,
      matching.processed,
    );
    if (isDemoPacingEnabled()) {
      const demoTarget = resolvePatentsReviewedTargetForDemo(
        ingest.patentsReviewed,
        matching.processed,
      );
      await incrementPatentsReviewedForDemo(
        runRow.id,
        scoutId,
        demoTarget,
      );
    } else {
      await setPatentsReviewed(runRow.id, effectivePatentsReviewed);
    }
    await maybePaceStage(runRow.id, scoutId, "post.matching");
    const demoSimulateReports = isDemoReportFlowSimulationEnabled();
    const demoReportTarget = demoSimulateReports
      ? await resolveDemoReportTarget(scoutId)
      : null;

    const research = await runStage(runRow.id, scoutId, "research", () =>
      demoSimulateReports
        ? runDemoResearchStage(runRow.id, scoutId, demoReportTarget)
        : processPendingDeepDiveReports({ scoutId }),
    );
    await maybePaceStage(runRow.id, scoutId, "post.research");
    const reports = await runStage(runRow.id, scoutId, "reports", () =>
      demoSimulateReports
        ? runDemoReportsStage(runRow.id, scoutId, demoReportTarget)
        : processGeneratingOpportunityReports({ scoutId }),
    );
    await maybePaceStage(runRow.id, scoutId, "post.reports");
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
        patents_reviewed: isDemoPacingEnabled()
          ? resolvePatentsReviewedTargetForDemo(
              result.ingest.patentsReviewed,
              result.matching.processed,
            )
          : Math.max(
              result.ingest.patentsReviewed,
              result.matching.processed,
            ),
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
      patentsReviewed: isDemoPacingEnabled()
        ? resolvePatentsReviewedTargetForDemo(
            result.ingest.patentsReviewed,
            result.matching.processed,
          )
        : Math.max(
            result.ingest.patentsReviewed,
            result.matching.processed,
          ),
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
