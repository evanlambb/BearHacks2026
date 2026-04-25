/**
 * Helper to load and slice the cached golden dossier.
 *
 * The DEMO_MODE branch of each /api/scout/* route reads from this so the live
 * demo never depends on Gemini availability or API latency.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TriageResponseSchema,
  type TriageResponse,
  DrugSummaryResponseSchema,
  type DrugSummaryResponse,
  PatentTimelineResponseSchema,
  type PatentTimelineResponse,
  type Citation,
} from "./schema";

type GoldenPayload = {
  generatedAt: string;
  filter: unknown;
  triage: TriageResponse;
  dossier: {
    drugSummary: DrugSummaryResponse["drugSummary"];
    patentTimeline: PatentTimelineResponse["patentTimeline"];
    citations: Citation[];
  };
};

let cached: GoldenPayload | null = null;

function loadGolden(): GoldenPayload {
  if (cached) return cached;
  const path = join(process.cwd(), "data", "golden-dossier.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as GoldenPayload;
  return cached;
}

/**
 * Demo mode is enabled by setting DEMO_MODE=true in .env.local.
 * Default is undefined (live Gemini calls).
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Sleep helper used to simulate realistic LLM call timing in demo mode. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Slicers ----------

/** Demo-mode triage response. */
export function goldenTriage(): TriageResponse {
  return TriageResponseSchema.parse(loadGolden().triage);
}

/**
 * Demo-mode summary slice. Returns the §1 drugSummary together with only the
 * citations referenced by §1 fields (currently the revenueCitationId), so the
 * sidebar fills incrementally just like the real pipeline.
 *
 * In our golden dossier the §1 citations happen to be ids 1, 2, 3 (Orange Book
 * product, Drugs@FDA label, SEC EDGAR 10-K).
 */
export function goldenSummary(): DrugSummaryResponse {
  const g = loadGolden();
  const summary = g.dossier.drugSummary;
  const summaryCitationIds = new Set<number>();
  if (summary.revenueCitationId !== null) summaryCitationIds.add(summary.revenueCitationId);
  // Always include the first three "drug-level" citations (FDA Orange Book,
  // Drugs@FDA, SEC) so the sidebar starts populated even before the user
  // scrolls to the revenue stat.
  [1, 2, 3].forEach((id) => summaryCitationIds.add(id));

  const citations = g.dossier.citations.filter((c) => summaryCitationIds.has(c.id));
  return DrugSummaryResponseSchema.parse({ drugSummary: summary, citations });
}

/**
 * Demo-mode timeline slice. Returns the §2 timeline together with the
 * citations for each patent/exclusivity event (typically ids 4-7 in our
 * golden dossier).
 */
export function goldenTimeline(): PatentTimelineResponse {
  const g = loadGolden();
  const timeline = g.dossier.patentTimeline;
  const eventCitationIds = new Set(timeline.events.map((e) => e.citationId));
  const citations = g.dossier.citations.filter((c) => eventCitationIds.has(c.id));
  return PatentTimelineResponseSchema.parse({ patentTimeline: timeline, citations });
}
