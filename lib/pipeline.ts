/**
 * The three-step pipeline:
 *   triage(filter)              -> picks a candidate from orange-book.json
 *   summarize(drugRecord)       -> §1 Drug & Mechanism Summary
 *   timeline(drugRecord)        -> §2 Patent Cliff Timeline
 *
 * Each model call:
 *   - Uses responseMimeType=application/json + responseJsonSchema for structured output
 *   - Validates the response against the corresponding Zod schema
 *   - Retries ONCE on validation failure, injecting the validation errors
 *
 * The two section responses are then merged into a single Dossier with
 * citation IDs renumbered to be globally unique.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { genai, TRIAGE_MODEL, SYNTHESIS_MODEL } from "./gemini";
import {
  TriageResponseSchema,
  type TriageResponse,
  DrugSummaryResponseSchema,
  type DrugSummaryResponse,
  PatentTimelineResponseSchema,
  type PatentTimelineResponse,
  type Dossier,
  type ScoutFilter,
} from "./schema";
import { triagePrompt, summaryPrompt, timelinePrompt } from "./prompts";

// ---------- Orange Book loader ----------

let cachedOrangeBook: OrangeBook | null = null;
type OrangeBook = {
  sourcedFrom: string;
  generatedAt: string;
  heroNda: string;
  drugs: OrangeBookDrug[];
};
type OrangeBookDrug = {
  ndaNumber: string;
  ingredient: string;
  tradeName: string;
  applicant: string;
  applicantFullName: string;
  dosageForm: string;
  strengths: string[];
  approvalDates: string[];
  patents: unknown[];
  exclusivity: unknown[];
};

export function loadOrangeBook(): OrangeBook {
  if (cachedOrangeBook) return cachedOrangeBook;
  const path = join(process.cwd(), "data", "orange-book.json");
  cachedOrangeBook = JSON.parse(readFileSync(path, "utf8")) as OrangeBook;
  return cachedOrangeBook;
}

export function findDrugByNda(nda: string): OrangeBookDrug | undefined {
  return loadOrangeBook().drugs.find((d) => d.ndaNumber === nda);
}

// ---------- Gemini structured-output helper ----------

/**
 * Convert a Zod schema to a JSON Schema object that Gemini will accept.
 * Gemini's structured-output mode rejects $schema, additionalProperties, and a
 * few other JSON Schema vocab fields, so we strip them recursively.
 */
function toGeminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-7" });
  return cleanForGemini(raw) as Record<string, unknown>;
}

function cleanForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanForGemini);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "$schema" || k === "additionalProperties" || k === "$ref") continue;
      // Gemini doesn't accept "format: url" — remap to "uri" and drop unknown formats.
      if (k === "format") {
        if (v === "url") out.format = "uri";
        else if (v === "uri" || v === "date-time" || v === "date" || v === "enum") out.format = v;
        continue;
      }
      out[k] = cleanForGemini(v);
    }
    return out;
  }
  return node;
}

async function generateStructured<T>(opts: {
  model: string;
  prompt: string;
  responseSchema: z.ZodType<T>;
  label: string;
}): Promise<T> {
  const jsonSchema = toGeminiJsonSchema(opts.responseSchema);

  const callOnce = async (extraPrompt = ""): Promise<string> => {
    const response = await genai.models.generateContent({
      model: opts.model,
      contents: opts.prompt + extraPrompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: 0.2,
      },
    });
    return response.text ?? "";
  };

  const tryParse = (raw: string) => {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      return { ok: false as const, error: `Invalid JSON: ${(e as Error).message}\nRaw: ${raw.slice(0, 400)}` };
    }
    const result = opts.responseSchema.safeParse(json);
    if (!result.success) {
      return { ok: false as const, error: `Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}` };
    }
    return { ok: true as const, value: result.data };
  };

  const start = Date.now();
  const first = await callOnce();
  let parsed = tryParse(first);
  if (!parsed.ok) {
    console.warn(`[${opts.label}] First call failed validation, retrying once...`);
    const retry = await callOnce(
      `\n\nIMPORTANT: Your previous response failed validation with these errors:\n${parsed.error}\n\nReturn a corrected JSON object that conforms exactly to the schema.`
    );
    parsed = tryParse(retry);
    if (!parsed.ok) {
      throw new Error(`[${opts.label}] Validation failed twice: ${parsed.error}`);
    }
  }
  const ms = Date.now() - start;
  console.log(`[${opts.label}] OK in ${ms}ms`);
  return parsed.value;
}

// ---------- Pipeline steps ----------

export async function triage(filter: ScoutFilter): Promise<TriageResponse> {
  const orangeBook = loadOrangeBook();
  // Send a slimmed view to keep the triage prompt cheap.
  const slim = orangeBook.drugs.map((d) => ({
    ndaNumber: d.ndaNumber,
    ingredient: d.ingredient,
    tradeName: d.tradeName,
    applicant: d.applicant,
    primaryPatentExpiry:
      (d.patents as Array<{ patentNumber: string; expiryDate: string; drugSubstance: boolean; drugProduct: boolean }>)
        .find((p) => p.drugSubstance && p.drugProduct && !p.patentNumber.includes("*PED"))
        ?.expiryDate ?? null,
  }));
  return generateStructured({
    model: TRIAGE_MODEL,
    prompt: triagePrompt({ filter, orangeBookJson: JSON.stringify(slim, null, 2) }),
    responseSchema: TriageResponseSchema,
    label: "triage",
  });
}

export async function summarize(nda: string): Promise<DrugSummaryResponse> {
  const drug = findDrugByNda(nda);
  if (!drug) throw new Error(`No drug with NDA ${nda} in orange-book.json`);
  return generateStructured({
    model: SYNTHESIS_MODEL,
    prompt: summaryPrompt({ drugRecord: JSON.stringify(drug, null, 2) }),
    responseSchema: DrugSummaryResponseSchema,
    label: "summary",
  });
}

export async function timeline(nda: string): Promise<PatentTimelineResponse> {
  const drug = findDrugByNda(nda);
  if (!drug) throw new Error(`No drug with NDA ${nda} in orange-book.json`);
  return generateStructured({
    model: SYNTHESIS_MODEL,
    prompt: timelinePrompt({ drugRecord: JSON.stringify(drug, null, 2) }),
    responseSchema: PatentTimelineResponseSchema,
    label: "timeline",
  });
}

// ---------- Dossier assembly ----------

/** Merge two section responses into one Dossier with globally unique citation IDs. */
export function assembleDossier(
  summary: DrugSummaryResponse,
  timeline: PatentTimelineResponse
): Dossier {
  const offset = summary.citations.length;
  const remappedTimelineCitations = timeline.citations.map((c) => ({
    ...c,
    id: c.id + offset,
  }));
  const remappedTimelineEvents = timeline.patentTimeline.events.map((e) => ({
    ...e,
    citationId: e.citationId + offset,
  }));
  return {
    drugSummary: summary.drugSummary,
    patentTimeline: {
      ...timeline.patentTimeline,
      events: remappedTimelineEvents,
    },
    citations: [...summary.citations, ...remappedTimelineCitations],
  };
}
