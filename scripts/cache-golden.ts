/**
 * Run the real pipeline once and save the output to data/golden-dossier.json.
 * The DEMO_MODE flag in the API routes will read this file instead of
 * hitting Gemini, guaranteeing a deterministic live demo.
 *
 * Run with: npm run script scripts/cache-golden.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  triage,
  summarize,
  timeline,
  assembleDossier,
} from "../lib/pipeline";
import { DossierSchema, type ScoutFilter } from "../lib/schema";

const FILTER: ScoutFilter = {
  therapeuticArea: "Oncology",
  moleculeType: "Small Molecule",
  loeWindowStart: "2027-01-01",
  loeWindowEnd: "2029-12-31",
  region: "United States",
};

const OUT_PATH = join(process.cwd(), "data", "golden-dossier.json");

async function main() {
  console.log("Running pipeline to generate golden dossier...");
  const t = await triage(FILTER);
  if (!t.match || !t.ndaNumber) {
    throw new Error("Triage failed to find a match");
  }
  const [s, tl] = await Promise.all([summarize(t.ndaNumber), timeline(t.ndaNumber)]);
  const dossier = assembleDossier(s, tl);
  const check = DossierSchema.safeParse(dossier);
  if (!check.success) {
    throw new Error("Assembled dossier failed validation: " + JSON.stringify(check.error.issues));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    filter: FILTER,
    triage: t,
    dossier,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`\nWrote golden dossier to ${OUT_PATH}`);
  console.log(`  drugSummary:        ${dossier.drugSummary.name}`);
  console.log(`  patentEvents:       ${dossier.patentTimeline.events.length}`);
  console.log(`  citations:          ${dossier.citations.length}`);
  console.log(`  loeWindow:          ${dossier.patentTimeline.loeWindowStart} -> ${dossier.patentTimeline.loeWindowEnd}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
