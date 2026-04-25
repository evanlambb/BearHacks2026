import type {
  EpoFamilyMemberRow,
  EpoPublicationRow,
  MatchStatus,
  OpportunityReportInsert,
  PatentRow,
  ScoutPatentMatchRow,
  ScoutRow,
  WipoPublicationRow,
} from "../../lib/supabase";
import { buildMatchPatentPrompt } from "./prompts/matchPatent";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export type PatentMatchDecision = {
  match: boolean;
  match_score: number;
  location_match: boolean;
  therapeutic_area_match: boolean;
  modality_match: boolean;
  reason: string;
  matched_countries: string[];
  concerns: string[];
};

type ProcessResult = {
  processed: number;
  matched: number;
  rejected: number;
  errors: number;
};

type MinimalSupabase = {
  from: (table: string) => any;
};

export interface IGeminiClient {
  matchPatent(prompt: string): Promise<PatentMatchDecision>;
}

function extractJsonObject(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("No JSON object found in model output");
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}

function parseDecision(text: string): PatentMatchDecision {
  const parsed = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  if (typeof parsed.match !== "boolean") throw new Error("match must be boolean");
  if (typeof parsed.match_score !== "number") throw new Error("match_score must be number");
  if (typeof parsed.location_match !== "boolean") throw new Error("location_match must be boolean");
  if (typeof parsed.therapeutic_area_match !== "boolean") {
    throw new Error("therapeutic_area_match must be boolean");
  }
  if (typeof parsed.modality_match !== "boolean") throw new Error("modality_match must be boolean");
  if (typeof parsed.reason !== "string") throw new Error("reason must be string");

  const score = Math.max(0, Math.min(1, parsed.match_score));
  return {
    match: parsed.match,
    match_score: score,
    location_match: parsed.location_match,
    therapeutic_area_match: parsed.therapeutic_area_match,
    modality_match: parsed.modality_match,
    reason: parsed.reason.trim(),
    matched_countries: asStringArray(parsed.matched_countries),
    concerns: asStringArray(parsed.concerns),
  };
}

export class GeminiClient implements IGeminiClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async matchPatent(prompt: string): Promise<PatentMatchDecision> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY is not set");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) throw new Error(`Gemini error ${response.status}`);
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim();
    if (!text) throw new Error("Gemini response missing text");
    return parseDecision(text);
  }
}

type MatchContext = {
  match: ScoutPatentMatchRow;
  scout: ScoutRow;
  patent: PatentRow;
  wipoPublications: WipoPublicationRow[];
  epoPublications: EpoPublicationRow[];
  epoFamilyMembers: EpoFamilyMemberRow[];
};

async function loadRows(
  supabase: MinimalSupabase,
  scoutId?: string,
): Promise<ScoutPatentMatchRow[]> {
  let query = supabase
    .from("scout_patent_matches")
    .select("*")
    .eq("match_status", "pending");

  if (scoutId) {
    query = query.eq("scout_id", scoutId);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScoutPatentMatchRow[];
}

async function loadContext(
  supabase: MinimalSupabase,
  match: ScoutPatentMatchRow,
): Promise<MatchContext> {
  if (!match.scout_id || !match.patent_id) {
    throw new Error("Pending match is missing scout_id or patent_id");
  }

  const [{ data: scout, error: scoutError }, { data: patent, error: patentError }] = await Promise.all([
    supabase.from("scouts").select("*").eq("id", match.scout_id).single(),
    supabase.from("patents").select("*").eq("patent_id", match.patent_id).single(),
  ]);
  if (scoutError || !scout) throw new Error(scoutError?.message ?? "Scout not found");
  if (patentError || !patent) throw new Error(patentError?.message ?? "Patent not found");

  const [{ data: wipo }, { data: epo }, { data: family }] = await Promise.all([
    supabase.from("wipo_publications").select("*").eq("patent_id", match.patent_id).order("created_at", { ascending: true }),
    supabase.from("epo_publications").select("*").eq("patent_id", match.patent_id).order("created_at", { ascending: true }),
    supabase.from("epo_family_members").select("*").eq("patent_id", match.patent_id).order("created_at", { ascending: true }),
  ]);

  return {
    match,
    scout: scout as ScoutRow,
    patent: patent as PatentRow,
    wipoPublications: (wipo ?? []) as WipoPublicationRow[],
    epoPublications: (epo ?? []) as EpoPublicationRow[],
    epoFamilyMembers: (family ?? []) as EpoFamilyMemberRow[],
  };
}

function buildReason(decision: PatentMatchDecision): string {
  const concerns = decision.concerns.length > 0 ? ` Concerns: ${decision.concerns.join("; ")}` : "";
  return `${decision.reason}${concerns}`.slice(0, 4000);
}

async function updateMatchRow(
  supabase: MinimalSupabase,
  rowId: string,
  status: MatchStatus,
  fields: {
    score?: number | null;
    reason?: string | null;
    location?: boolean | null;
    therapeutic?: boolean | null;
    modality?: boolean | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("scout_patent_matches")
    .update({
      match_status: status,
      match_score: fields.score ?? null,
      match_reason: fields.reason ?? null,
      location_match: fields.location ?? null,
      therapeutic_area_match: fields.therapeutic ?? null,
      modality_match: fields.modality ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", rowId);
  if (error) throw new Error(error.message);
}

async function upsertOpportunityReport(
  supabase: MinimalSupabase,
  ctx: MatchContext,
  decision: PatentMatchDecision,
): Promise<void> {
  const region = decision.matched_countries.length > 0
    ? decision.matched_countries.join(", ")
    : ctx.scout.countries.join(", ");

  const insert: OpportunityReportInsert = {
    scout_id: ctx.scout.id,
    patent_id: ctx.patent.patent_id,
    signal_type: ctx.scout.patent_signal_type,
    report_status: "pending",
    region,
  };

  const { error } = await supabase.from("opportunity_reports").upsert(insert, {
    onConflict: "scout_id,patent_id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
}

function getModelClient(client?: IGeminiClient): IGeminiClient {
  return client ?? new GeminiClient();
}

async function resolveSupabaseAdmin(): Promise<MinimalSupabase> {
  const mod = await import("../../lib/supabase/admin");
  return mod.getSupabaseAdmin() as unknown as MinimalSupabase;
}

export async function processPendingScoutPatentMatches(
  input: { scoutId?: string; supabase?: MinimalSupabase; matcher?: IGeminiClient } = {},
): Promise<ProcessResult> {
  const supabase = input.supabase ?? (await resolveSupabaseAdmin());
  const matcher = getModelClient(input.matcher);
  const pending = await loadRows(supabase, input.scoutId);

  let matched = 0;
  let rejected = 0;
  let errors = 0;

  for (const row of pending) {
    try {
      const ctx = await loadContext(supabase, row);
      const prompt = buildMatchPatentPrompt({
        scout: {
          countries: ctx.scout.countries,
          therapeutic_area: ctx.scout.therapeutic_area,
          patent_signal_type: ctx.scout.patent_signal_type,
          expiry_time_horizon_months: ctx.scout.expiry_time_horizon_months,
          non_filed_lookback_years: ctx.scout.non_filed_lookback_years,
          modality: ctx.scout.modality,
          market_floor_usd: ctx.scout.market_floor_usd,
          minimum_unit_volume: ctx.scout.minimum_unit_volume,
          capex_min_usd: ctx.scout.capex_min_usd,
          capex_max_usd: ctx.scout.capex_max_usd,
        },
        patent: {
          patent_id: ctx.patent.patent_id,
          title: ctx.patent.title,
          abstract: ctx.patent.abstract,
          applicants: ctx.patent.applicants,
          inventors: ctx.patent.inventors,
          filing_date: ctx.patent.filing_date,
          publication_date: ctx.patent.publication_date,
          priority_date: ctx.patent.priority_date,
          grant_date: ctx.patent.grant_date,
          jurisdictions: ctx.patent.jurisdictions,
          ipc_codes: ctx.patent.ipc_codes,
          cpc_codes: ctx.patent.cpc_codes,
          family_id: ctx.patent.family_id,
        },
        wipoPublications: ctx.wipoPublications.map((item) => ({
          publication_number: item.publication_number,
          application_number: item.application_number,
          language: item.language,
          filing_date: item.filing_date,
          publication_date: item.publication_date,
          priority_date: item.priority_date,
          ipc_codes: item.ipc_codes,
        })),
        epoPublications: ctx.epoPublications.map((item) => ({
          publication_number_docdb: item.publication_number_docdb,
          application_number: item.application_number,
          family_id: item.family_id,
          jurisdiction_code: item.jurisdiction_code,
          filing_date: item.filing_date,
          publication_date: item.publication_date,
          grant_date: item.grant_date,
          ipc_codes: item.ipc_codes,
          cpc_codes: item.cpc_codes,
        })),
        epoFamilyMembers: ctx.epoFamilyMembers.map((item) => ({
          family_id: item.family_id,
          publication_number_docdb: item.publication_number_docdb,
          jurisdiction_code: item.jurisdiction_code,
          application_number: item.application_number,
          status: item.status,
          filing_date: item.filing_date,
          publication_date: item.publication_date,
        })),
      });

      const decision = await matcher.matchPatent(prompt);
      const status: MatchStatus = decision.match ? "matched" : "rejected";

      await updateMatchRow(supabase, row.id, status, {
        score: decision.match_score,
        reason: buildReason(decision),
        location: decision.location_match,
        therapeutic: decision.therapeutic_area_match,
        modality: decision.modality_match,
      });

      if (decision.match) {
        await upsertOpportunityReport(supabase, ctx, decision);
        matched += 1;
      } else {
        rejected += 1;
      }
    } catch (error) {
      errors += 1;
      await updateMatchRow(supabase, row.id, "error", {
        reason: `AI matching failed: ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          4000,
        ),
      });
    }
  }

  return {
    processed: pending.length,
    matched,
    rejected,
    errors,
  };
}

export const __private__ = {
  parseDecision,
  extractJsonObject,
};
