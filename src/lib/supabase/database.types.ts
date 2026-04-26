/**
 * Hand-written Supabase Database type.
 *
 * Mirrors the schema in `supabase/migrations/`. When the project is wired up
 * to the Supabase CLI you can replace this file with the auto-generated
 * output of `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
 * — the rest of the app imports `Database` from this module and will keep
 * compiling.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─────────────────────────────────────────────────────────────────────────────
// Domain enums
// ─────────────────────────────────────────────────────────────────────────────
export type ScoutStatus = "active" | "paused" | "error";
export type PatentSignalType = "patent_expiry" | "non_filed_region";
export type MatchStatus = "pending" | "matched" | "rejected" | "error";
export type ReportStatus = "pending" | "generating" | "complete" | "error";
export type ScoutRunStatus = "running" | "complete" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Row / Insert / Update helper shapes
// ─────────────────────────────────────────────────────────────────────────────
type WithDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// scouts ---------------------------------------------------------------------
export type ScoutRow = {
  id: string;
  user_id: string;
  name: string | null;
  countries: string[];
  therapeutic_area: string;
  patent_signal_type: PatentSignalType;
  expiry_time_horizon_months: number | null;
  non_filed_lookback_years: number | null;
  modality: string;
  market_floor_usd: number | null;
  minimum_unit_volume: number | null;
  capex_min_usd: number | null;
  capex_max_usd: number | null;
  status: ScoutStatus;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ScoutInsert = WithDefaults<
  ScoutRow,
  "id" | "status" | "created_at" | "updated_at" | "name" |
  "expiry_time_horizon_months" | "non_filed_lookback_years" |
  "market_floor_usd" | "minimum_unit_volume" | "capex_min_usd" |
  "capex_max_usd" | "last_run_at" | "next_run_at"
>;
export type ScoutUpdate = Partial<ScoutInsert>;

// patents --------------------------------------------------------------------
export type PatentRow = {
  id: string;
  patent_id: string;
  canonical_publication_number: string;
  title: string | null;
  abstract: string | null;
  applicants: string[] | null;
  inventors: string[] | null;
  filing_date: string | null;
  publication_date: string | null;
  priority_date: string | null;
  grant_date: string | null;
  family_id: string | null;
  jurisdictions: string[] | null;
  ipc_codes: string[] | null;
  cpc_codes: string[] | null;
  source: string;
  created_at: string;
  updated_at: string;
};
export type PatentInsert = WithDefaults<
  PatentRow,
  "id" | "source" | "created_at" | "updated_at" | "title" | "abstract" |
  "applicants" | "inventors" | "filing_date" | "publication_date" |
  "priority_date" | "grant_date" | "family_id" | "jurisdictions" |
  "ipc_codes" | "cpc_codes"
>;
export type PatentUpdate = Partial<PatentInsert>;

// wipo_publications ----------------------------------------------------------
export type WipoPublicationRow = {
  id: string;
  patent_id: string | null;
  publication_number: string;
  application_number: string | null;
  title: string | null;
  abstract: string | null;
  applicants: string[] | null;
  inventors: string[] | null;
  filing_date: string | null;
  publication_date: string | null;
  priority_date: string | null;
  ipc_codes: string[] | null;
  language: string | null;
  raw_xml: string | null;
  created_at: string;
};
export type WipoPublicationInsert = WithDefaults<
  WipoPublicationRow,
  "id" | "created_at" | "patent_id" | "application_number" | "title" |
  "abstract" | "applicants" | "inventors" | "filing_date" |
  "publication_date" | "priority_date" | "ipc_codes" | "language" | "raw_xml"
>;
export type WipoPublicationUpdate = Partial<WipoPublicationInsert>;

// epo_publications -----------------------------------------------------------
export type EpoPublicationRow = {
  id: string;
  patent_id: string | null;
  publication_number_docdb: string;
  application_number: string | null;
  family_id: string | null;
  jurisdiction_code: string | null;
  title: string | null;
  abstract: string | null;
  applicants: string[] | null;
  inventors: string[] | null;
  filing_date: string | null;
  publication_date: string | null;
  grant_date: string | null;
  ipc_codes: string[] | null;
  cpc_codes: string[] | null;
  raw_xml: string | null;
  created_at: string;
};
export type EpoPublicationInsert = WithDefaults<
  EpoPublicationRow,
  "id" | "created_at" | "patent_id" | "application_number" | "family_id" |
  "jurisdiction_code" | "title" | "abstract" | "applicants" | "inventors" |
  "filing_date" | "publication_date" | "grant_date" | "ipc_codes" |
  "cpc_codes" | "raw_xml"
>;
export type EpoPublicationUpdate = Partial<EpoPublicationInsert>;

// epo_family_members ---------------------------------------------------------
export type EpoFamilyMemberRow = {
  id: string;
  family_id: string;
  patent_id: string | null;
  publication_number_docdb: string | null;
  jurisdiction_code: string | null;
  application_number: string | null;
  status: string | null;
  filing_date: string | null;
  publication_date: string | null;
  created_at: string;
};
export type EpoFamilyMemberInsert = WithDefaults<
  EpoFamilyMemberRow,
  "id" | "created_at" | "patent_id" | "publication_number_docdb" |
  "jurisdiction_code" | "application_number" | "status" | "filing_date" |
  "publication_date"
>;
export type EpoFamilyMemberUpdate = Partial<EpoFamilyMemberInsert>;

// scout_patent_matches -------------------------------------------------------
export type ScoutPatentMatchRow = {
  id: string;
  scout_id: string | null;
  patent_id: string | null;
  match_status: MatchStatus;
  match_score: number | null;
  match_reason: string | null;
  location_match: boolean | null;
  therapeutic_area_match: boolean | null;
  modality_match: boolean | null;
  reviewed_at: string | null;
  created_at: string;
};
export type ScoutPatentMatchInsert = WithDefaults<
  ScoutPatentMatchRow,
  "id" | "match_status" | "created_at" | "match_score" | "match_reason" |
  "location_match" | "therapeutic_area_match" | "modality_match" |
  "reviewed_at"
>;
export type ScoutPatentMatchUpdate = Partial<ScoutPatentMatchInsert>;

// opportunity_reports --------------------------------------------------------
export type OpportunityReportRow = {
  id: string;
  scout_id: string | null;
  patent_id: string | null;
  drug_name: string | null;
  region: string | null;
  market_size_usd: number | null;
  signal_type: PatentSignalType;
  report_status: ReportStatus;
  report_json: Json | null;
  report_markdown: string | null;
  pdf_storage_path: string | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};
export type OpportunityReportInsert = WithDefaults<
  OpportunityReportRow,
  "id" | "report_status" | "created_at" | "updated_at" | "drug_name" |
  "region" | "market_size_usd" | "report_json" | "report_markdown" |
  "pdf_storage_path" | "error_message" | "generated_at"
>;
export type OpportunityReportUpdate = Partial<OpportunityReportInsert>;

// scout_runs -----------------------------------------------------------------
export type ScoutRunRow = {
  id: string;
  scout_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: ScoutRunStatus;
  patents_reviewed: number;
  opportunities_found: number;
  error_message: string | null;
};
export type ScoutRunInsert = WithDefaults<
  ScoutRunRow,
  "id" | "started_at" | "status" | "patents_reviewed" |
  "opportunities_found" | "finished_at" | "error_message"
>;
export type ScoutRunUpdate = Partial<ScoutRunInsert>;

// scout_query_cache ----------------------------------------------------------
export type ScoutQueryCacheRow = {
  scout_id: string;
  query_fingerprint: string;
  fetched_at: string;
};
export type ScoutQueryCacheInsert = WithDefaults<
  ScoutQueryCacheRow,
  "fetched_at"
>;
export type ScoutQueryCacheUpdate = Partial<ScoutQueryCacheInsert>;

// ─────────────────────────────────────────────────────────────────────────────
// Database — shape compatible with @supabase/supabase-js generic
// ─────────────────────────────────────────────────────────────────────────────
type TableShape<R, I, U> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      scouts: TableShape<ScoutRow, ScoutInsert, ScoutUpdate>;
      patents: TableShape<PatentRow, PatentInsert, PatentUpdate>;
      wipo_publications: TableShape<
        WipoPublicationRow,
        WipoPublicationInsert,
        WipoPublicationUpdate
      >;
      epo_publications: TableShape<
        EpoPublicationRow,
        EpoPublicationInsert,
        EpoPublicationUpdate
      >;
      epo_family_members: TableShape<
        EpoFamilyMemberRow,
        EpoFamilyMemberInsert,
        EpoFamilyMemberUpdate
      >;
      scout_patent_matches: TableShape<
        ScoutPatentMatchRow,
        ScoutPatentMatchInsert,
        ScoutPatentMatchUpdate
      >;
      opportunity_reports: TableShape<
        OpportunityReportRow,
        OpportunityReportInsert,
        OpportunityReportUpdate
      >;
      scout_runs: TableShape<ScoutRunRow, ScoutRunInsert, ScoutRunUpdate>;
      scout_query_cache: TableShape<
        ScoutQueryCacheRow,
        ScoutQueryCacheInsert,
        ScoutQueryCacheUpdate
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      scout_status: ScoutStatus;
      patent_signal_type: PatentSignalType;
      match_status: MatchStatus;
      report_status: ReportStatus;
      scout_run_status: ScoutRunStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
