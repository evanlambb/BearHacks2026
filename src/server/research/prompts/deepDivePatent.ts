import type {
  EpoFamilyMemberRow,
  EpoPublicationRow,
  OpportunityReportRow,
  PatentRow,
  ScoutRow,
  WipoPublicationRow,
} from "../../../lib/supabase";

type DeepDivePromptInput = {
  opportunity: OpportunityReportRow;
  scout: ScoutRow;
  patent: PatentRow;
  wipoPublications: WipoPublicationRow[];
  epoPublications: EpoPublicationRow[];
  epoFamilyMembers: EpoFamilyMemberRow[];
};

export function buildDeepDivePatentPrompt(input: DeepDivePromptInput): string {
  return [
    "You are a pharmaceutical patent and market intelligence research analyst.",
    "Build a deep-dive report strictly from available evidence.",
    "",
    "Prioritize primary sources:",
    "- patent office records",
    "- regulator databases",
    "- drug labels",
    "- clinical trial registries",
    "- company filings",
    "- official tender/procurement sources",
    "If primary sources are unavailable, use reliable secondary sources and lower confidence.",
    "Do not invent values. Use explicit nulls and confidence notes for unknowns.",
    "Every factual claim must include evidence entries with source title, URL, publisher, date accessed when possible, and claim supported.",
    "For patent evidence, include publication number and PDF/page reference when available.",
    "Return valid JSON only. No markdown, no commentary.",
    "",
    "Context JSON:",
    JSON.stringify(
      {
        opportunity: {
          id: input.opportunity.id,
          scout_id: input.opportunity.scout_id,
          patent_id: input.opportunity.patent_id,
          signal_type: input.opportunity.signal_type,
          existing_region: input.opportunity.region,
        },
        scout: {
          countries: input.scout.countries,
          therapeutic_area: input.scout.therapeutic_area,
          patent_signal_type: input.scout.patent_signal_type,
          expiry_time_horizon_months: input.scout.expiry_time_horizon_months,
          non_filed_lookback_years: input.scout.non_filed_lookback_years,
          modality: input.scout.modality,
          market_floor_usd: input.scout.market_floor_usd,
          minimum_unit_volume: input.scout.minimum_unit_volume,
          capex_min_usd: input.scout.capex_min_usd,
          capex_max_usd: input.scout.capex_max_usd,
        },
        patent: {
          patent_id: input.patent.patent_id,
          title: input.patent.title,
          abstract: input.patent.abstract,
          applicants: input.patent.applicants,
          inventors: input.patent.inventors,
          filing_date: input.patent.filing_date,
          publication_date: input.patent.publication_date,
          priority_date: input.patent.priority_date,
          grant_date: input.patent.grant_date,
          family_id: input.patent.family_id,
          jurisdictions: input.patent.jurisdictions,
          ipc_codes: input.patent.ipc_codes,
          cpc_codes: input.patent.cpc_codes,
        },
        wipo_publications: input.wipoPublications.map((x) => ({
          publication_number: x.publication_number,
          application_number: x.application_number,
          filing_date: x.filing_date,
          publication_date: x.publication_date,
          priority_date: x.priority_date,
          ipc_codes: x.ipc_codes,
          language: x.language,
        })),
        epo_publications: input.epoPublications.map((x) => ({
          publication_number_docdb: x.publication_number_docdb,
          application_number: x.application_number,
          family_id: x.family_id,
          jurisdiction_code: x.jurisdiction_code,
          filing_date: x.filing_date,
          publication_date: x.publication_date,
          grant_date: x.grant_date,
          ipc_codes: x.ipc_codes,
          cpc_codes: x.cpc_codes,
        })),
        epo_family_members: input.epoFamilyMembers.map((x) => ({
          family_id: x.family_id,
          publication_number_docdb: x.publication_number_docdb,
          jurisdiction_code: x.jurisdiction_code,
          application_number: x.application_number,
          status: x.status,
          filing_date: x.filing_date,
          publication_date: x.publication_date,
        })),
      },
      null,
      2,
    ),
  ].join("\n");
}
