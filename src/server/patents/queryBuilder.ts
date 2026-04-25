import type { PatentSearchQuery } from "./types";

export type BuildScoutQueryInput = {
  countries: string[];
  therapeutic_area: string;
  modality: string;
  patent_signal_type: "patent_expiry" | "non_filed_region";
  expiry_time_horizon_months: number | null;
  non_filed_lookback_years: number | null;
};

function pushClause(clauses: string[], field: string, value: string | null): void {
  const cleaned = value?.trim();
  if (!cleaned) return;
  clauses.push(`${field}:"${cleaned.replaceAll('"', '\\"')}"`);
}

export function buildPatentSearchQuery(scout: BuildScoutQueryInput): PatentSearchQuery {
  const clauses: string[] = [];
  pushClause(clauses, "therapeutic_area", scout.therapeutic_area);
  pushClause(clauses, "modality", scout.modality);

  if (scout.countries.length > 0) {
    const countryClause = scout.countries
      .map((country) => country.trim())
      .filter(Boolean)
      .map((country) => `country:"${country.replaceAll('"', '\\"')}"`)
      .join(" OR ");
    if (countryClause) clauses.push(`(${countryClause})`);
  }

  if (
    scout.patent_signal_type === "patent_expiry" &&
    scout.expiry_time_horizon_months != null
  ) {
    clauses.push(`expiry_horizon_months:<=${scout.expiry_time_horizon_months}`);
  }

  if (
    scout.patent_signal_type === "non_filed_region" &&
    scout.non_filed_lookback_years != null
  ) {
    clauses.push(`non_filed_lookback_years:<=${scout.non_filed_lookback_years}`);
  }

  return {
    textQuery: clauses.join(" AND "),
    countries: [...scout.countries],
    signalType: scout.patent_signal_type,
    expiryTimeHorizonMonths: scout.expiry_time_horizon_months,
    nonFiledLookbackYears: scout.non_filed_lookback_years,
  };
}
