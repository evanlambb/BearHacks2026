/**
 * Block 4: End-to-end CLI test of the real pipeline.
 *
 * Runs: triage -> summary -> timeline -> assemble.
 * Validates each step against its Zod schema (already done inside pipeline).
 * Prints the assembled Dossier so we can eyeball quality before wiring UI.
 *
 * Run with: npm run script scripts/test-pipeline.ts
 */
import { triage, summarize, timeline, assembleDossier } from "../lib/pipeline";
import { DossierSchema, type ScoutFilter } from "../lib/schema";

const FILTER: ScoutFilter = {
  therapeuticArea: "Oncology",
  moleculeType: "Small Molecule",
  loeWindowStart: "2027-01-01",
  loeWindowEnd: "2029-12-31",
  region: "United States",
};

function hr(label: string) {
  console.log(`\n${"=".repeat(8)} ${label} ${"=".repeat(60 - label.length)}`);
}

async function main() {
  const totalStart = Date.now();

  hr("STEP 1: TRIAGE");
  const triageResult = await triage(FILTER);
  console.log(JSON.stringify(triageResult, null, 2));

  if (!triageResult.match || !triageResult.ndaNumber) {
    console.error("\nTriage found no match. Aborting.");
    process.exit(1);
  }

  hr("STEP 2: SUMMARY");
  const summaryResult = await summarize(triageResult.ndaNumber);
  console.log(JSON.stringify(summaryResult, null, 2));

  hr("STEP 3: TIMELINE");
  const timelineResult = await timeline(triageResult.ndaNumber);
  console.log(JSON.stringify(timelineResult, null, 2));

  hr("ASSEMBLED DOSSIER");
  const dossier = assembleDossier(summaryResult, timelineResult);
  const finalCheck = DossierSchema.safeParse(dossier);
  if (!finalCheck.success) {
    console.error("Final dossier failed schema validation:", finalCheck.error.issues);
    process.exit(1);
  }
  console.log(JSON.stringify(dossier, null, 2));

  const totalMs = Date.now() - totalStart;
  hr("SUMMARY");
  console.log(`Total: ${totalMs}ms`);
  console.log(`Sections: drugSummary + patentTimeline + ${dossier.citations.length} citations`);
  console.log(`Patent timeline events: ${dossier.patentTimeline.events.length}`);
  console.log(`LoE window: ${dossier.patentTimeline.loeWindowStart} -> ${dossier.patentTimeline.loeWindowEnd}`);
}

main().catch((err) => {
  console.error("\nPipeline failed:", err);
  process.exit(1);
});
