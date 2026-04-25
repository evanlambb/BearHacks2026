import { processPendingScoutPatentMatches } from "../ai";
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
