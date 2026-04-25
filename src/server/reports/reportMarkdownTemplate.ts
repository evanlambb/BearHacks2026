import type { OpportunityReportRow, PatentRow, ScoutRow } from "../../lib/supabase";
import type { DeepDiveReport } from "../research/reportSchema";

type BuildMarkdownPromptInput = {
  opportunity: OpportunityReportRow;
  scout: ScoutRow;
  patent: PatentRow;
  report: DeepDiveReport;
};

export function buildReportWriterPrompt(input: BuildMarkdownPromptInput): string {
  return [
    "Write an executive-quality pharma opportunity report in Markdown.",
    "Audience: pharma BD, generics strategy, CDMO, and investors.",
    "Tone: professional, concise, data-grounded. Keep URLs intact.",
    "",
    "Required sections and ordering:",
    "1) Cover section (drug/asset, target regions, signal type, recommendation, date generated)",
    "2) Executive Summary",
    "3) Asset Summary",
    "4) Patent and Exclusivity Landscape (with expiry timeline table by country and patent-type breakdown)",
    "5) Originator and Filer Intelligence",
    "6) Market Sizing (revenue + unit volume tables, post-LOE erosion assumptions)",
    "7) Competitive Density",
    "8) CDMO Matchmaking (ranked table, include Direct intro request placeholder)",
    "9) API and KSM Sourcing",
    "10) Regulatory Pathway (country-by-country route/timeline/studies/cost)",
    "11) Risk Score (component table + composite explanation)",
    "12) Financial Model (5-year P&L table by country where available, NPV, IRR, payback, capex/tooling, sensitivities)",
    "13) Strategic Recommendation (go/no-go, launch sequence, partnership vs in-house, first-to-file urgency)",
    "14) Evidence Pack (retain all source links and patent refs/page refs)",
    "",
    "Rules:",
    "- Do not invent missing values; explicitly say unknown where needed.",
    "- Preserve all source URLs in output markdown.",
    "- Use clear markdown tables where suitable.",
    "- Keep claims traceable to evidence.",
    "",
    "Input JSON:",
    JSON.stringify(
      {
        opportunity: {
          id: input.opportunity.id,
          scout_id: input.opportunity.scout_id,
          patent_id: input.opportunity.patent_id,
          signal_type: input.opportunity.signal_type,
          region: input.opportunity.region,
        },
        scout: {
          countries: input.scout.countries,
          therapeutic_area: input.scout.therapeutic_area,
          patent_signal_type: input.scout.patent_signal_type,
          expiry_time_horizon_months: input.scout.expiry_time_horizon_months,
          non_filed_lookback_years: input.scout.non_filed_lookback_years,
          modality: input.scout.modality,
        },
        patent: {
          patent_id: input.patent.patent_id,
          title: input.patent.title,
          abstract: input.patent.abstract,
          jurisdictions: input.patent.jurisdictions,
          ipc_codes: input.patent.ipc_codes,
          cpc_codes: input.patent.cpc_codes,
        },
        deep_dive_report_json: input.report,
      },
      null,
      2,
    ),
  ].join("\n");
}
