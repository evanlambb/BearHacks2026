import type { ScoutRow } from "../../../lib/supabase";

export type MatchPatentPromptInput = {
  scout: Pick<
    ScoutRow,
    | "countries"
    | "therapeutic_area"
    | "patent_signal_type"
    | "expiry_time_horizon_months"
    | "non_filed_lookback_years"
    | "modality"
    | "market_floor_usd"
    | "minimum_unit_volume"
    | "capex_min_usd"
    | "capex_max_usd"
  >;
  patent: {
    patent_id: string;
    title: string | null;
    abstract: string | null;
    applicants: string[] | null;
    inventors: string[] | null;
    filing_date: string | null;
    publication_date: string | null;
    priority_date: string | null;
    grant_date: string | null;
    jurisdictions: string[] | null;
    ipc_codes: string[] | null;
    cpc_codes: string[] | null;
    family_id: string | null;
  };
  wipoPublications: Array<{
    publication_number: string;
    application_number: string | null;
    language: string | null;
    filing_date: string | null;
    publication_date: string | null;
    priority_date: string | null;
    ipc_codes: string[] | null;
  }>;
  epoPublications: Array<{
    publication_number_docdb: string;
    application_number: string | null;
    family_id: string | null;
    jurisdiction_code: string | null;
    filing_date: string | null;
    publication_date: string | null;
    grant_date: string | null;
    ipc_codes: string[] | null;
    cpc_codes: string[] | null;
  }>;
  epoFamilyMembers: Array<{
    family_id: string;
    publication_number_docdb: string | null;
    jurisdiction_code: string | null;
    application_number: string | null;
    status: string | null;
    filing_date: string | null;
    publication_date: string | null;
  }>;
};

export function buildMatchPatentPrompt(input: MatchPatentPromptInput): string {
  const payload = JSON.stringify(input, null, 2);

  return [
    "You are a strict patent relevance classifier for a pharma scouting workflow.",
    "",
    "Your task: decide if the provided patent matches the scout filters on:",
    "- location",
    "- therapeutic area",
    "- modality",
    "",
    "Rules:",
    "1) Be strict. Weak or vague evidence should reduce confidence.",
    "2) If therapeutic area or modality is plausible but uncertain, use lower score instead of automatic match.",
    "3) For patent_expiry scouts, consider filing/publication/grant timing and expiry horizon if enough data exists.",
    "4) For non_filed_region scouts, match when family appears relevant but filings in selected countries seem absent.",
    "5) Do NOT hallucinate jurisdictions. If family data is missing, include uncertainty in concerns and reason.",
    "6) Return JSON only. No markdown, no extra text.",
    "",
    "Required output JSON schema:",
    "{",
    '  "match": true | false,',
    '  "match_score": number,',
    '  "location_match": boolean,',
    '  "therapeutic_area_match": boolean,',
    '  "modality_match": boolean,',
    '  "reason": string,',
    '  "matched_countries": string[],',
    '  "concerns": string[]',
    "}",
    "",
    "Ensure match_score is between 0 and 1 inclusive.",
    "",
    "Input data:",
    payload,
  ].join("\n");
}
