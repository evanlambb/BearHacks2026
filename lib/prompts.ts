/**
 * Prompt templates for the three-step pipeline:
 *   triagePrompt    - matches drugs against the user filter (Flash)
 *   summaryPrompt   - writes §1 Drug & Mechanism Summary (Pro)
 *   timelinePrompt  - writes §2 Patent Cliff Timeline (Pro)
 *
 * Keep prompts as pure string builders. No SDK imports here.
 */

import type { ScoutFilter } from "./schema";

export function triagePrompt(args: {
  filter: ScoutFilter;
  orangeBookJson: string;
}): string {
  return `You are a triage agent for a pharma BD scout. Given a list of drugs from the FDA Orange Book and a user filter, identify the SINGLE BEST candidate small-molecule oncology asset matching the filter.

USER FILTER:
- Therapeutic area: ${args.filter.therapeuticArea}
- Molecule type:   ${args.filter.moleculeType}
- LoE window:      ${args.filter.loeWindowStart} to ${args.filter.loeWindowEnd}
- Region:          ${args.filter.region}

DRUG DATA (FDA Orange Book extract):
${args.orangeBookJson}

A drug "matches" if its earliest non-pediatric, non-formulation patent expiry falls within the LoE window. The composition-of-matter patent (drugSubstance=true, drugProduct=true, no *PED suffix) is the primary signal.

Return the SINGLE strongest match. If multiple drugs match, prefer the one with the largest commercial impact (Pfizer's Ibrance is a known blockbuster — flag it confidently if present).

Output JSON conforming to the provided schema:
- match: true if a candidate exists
- ndaNumber, ingredient, tradeName: identifying fields
- rationale: ONE sentence explaining why it matches (cite the composition-of-matter expiry date)`;
}

export function summaryPrompt(args: { drugRecord: string }): string {
  return `You are a senior pharma BD analyst writing the "Drug & Mechanism Summary" section of an Opportunity Dossier. Output MUST conform exactly to the provided JSON schema.

DRUG DATA (FDA Orange Book row, full record):
${args.drugRecord}

RULES:
1. name: format as "Brand (generic)" e.g. "Ibrance (palbociclib)".
2. originator: full company name (e.g. "Pfizer Inc.").
3. mechanismOfAction: 1-2 sentences. Accurate, no marketing language. For palbociclib: it is a CDK4/6 inhibitor.
4. indications: list approved US indications only. Concise (one short phrase each).
5. annualRevenueUSD: use the originator's most recent published 10-K product revenue. For Ibrance, Pfizer reported ~$4.4-5.0B annually in 2023-2024. If you cite a number, also set revenueYear and revenueCitationId. If you cannot cite a specific 10-K, set all three to null. NEVER guess.
6. citations: include at least one citation per non-null field. Use:
   - source: "FDA_ORANGE_BOOK" | "SEC_10K" | "FDA_LABEL" for indications
   - reference: human-readable like "Pfizer 2024 Annual Report on Form 10-K, Product Revenues note"
   - url: ONLY include URLs from this exact whitelist of stable search/browse endpoints. NEVER deep-link to specific PDF files (they 404 frequently). Allowed patterns:
       FDA Orange Book product:
         https://www.accessdata.fda.gov/scripts/cder/ob/results_product.cfm?Appl_Type=N&Appl_No=<NDA>
       FDA Drugs@FDA application overview (label, history):
         https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=<NDA>
       SEC EDGAR company filings browse (use the originator's CIK if known, otherwise omit URL):
         https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<CIK>&type=10-K
       For any URL you are not 100% certain of, OMIT the url field entirely.

Return ONLY the JSON object.`;
}

export function timelinePrompt(args: { drugRecord: string }): string {
  return `You are a senior pharma BD analyst writing the "Patent Cliff Timeline" section of an Opportunity Dossier. Output MUST conform exactly to the provided JSON schema.

DRUG DATA (FDA Orange Book row, including all patents and exclusivity entries):
${args.drugRecord}

UNDERSTANDING THE FDA ORANGE BOOK PATENT FORMAT:
- Patents with the suffix "*PED" (e.g. "RE47739*PED") are NOT separate patents. They represent the +6-month pediatric exclusivity extension applied to the parent patent. DO NOT emit them as separate COMPOSITION_OF_MATTER events. Instead, emit ONE PEDIATRIC_EXTENSION event 6 months after the parent patent's expiry, IF and only IF the *PED entry exists in the input.
- A patent with drugSubstance=true AND drugProduct=true is typically the COMPOSITION_OF_MATTER patent (the strongest IP).
- Other patents may be METHOD_OF_USE or FORMULATION; classify based on the patent_use_code if present, otherwise default to FORMULATION.
- Exclusivity entries with code "PED" or "M-..." are pediatric exclusivities; emit them as EXCLUSIVITY events using their expiryDate.

RULES:
1. Emit one event per non-*PED patent (typed COMPOSITION_OF_MATTER, METHOD_OF_USE, or FORMULATION).
2. For each *PED entry that exists in the input, add ONE PEDIATRIC_EXTENSION event at the *PED expiry date.
3. Emit one EXCLUSIVITY event per exclusivity row.
4. Emit EXACTLY ONE PROJECTED_GENERIC_LAUNCH event = the LATEST of:
   (a) composition-of-matter expiry (with pediatric extension if applicable)
   (b) latest exclusivity expiry
5. loeWindowStart = earliest patent OR exclusivity expiry. loeWindowEnd = the PROJECTED_GENERIC_LAUNCH date.
6. narrative: 2-3 sentences. Tight, dispassionate, like Goldman Sachs equity research. Reference the patent thicket if there is one (i.e. if later patents extend protection well past composition-of-matter expiry). No marketing language.
7. Every event MUST have a citationId pointing into the citations array.
8. citations: one per patent (source: "FDA_ORANGE_BOOK", reference: e.g. "FDA Orange Book, NDA <ndaNumber>, Patent <patentNumber>"). Add a citation for each exclusivity entry too.
9. NEVER invent patent numbers, expiry dates, or exclusivity codes that aren't in the input.

Return ONLY the JSON object.`;
}
