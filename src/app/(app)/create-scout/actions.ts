"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import type { PatentSignalType, ScoutInsert } from "@/lib/supabase";

const SUPPORTED_COUNTRIES = new Set([
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Switzerland",
  "Japan",
  "China",
  "South Korea",
  "India",
  "Brazil",
  "Mexico",
  "Australia",
]);

export type CreateScoutInput = {
  name?: string | null;
  countries: string[];
  therapeutic_area: string;
  patent_signal_type: PatentSignalType;
  expiry_time_horizon_months?: number | null;
  non_filed_lookback_years?: number | null;
  modality: string;
  market_floor_usd?: number | null;
  minimum_unit_volume?: number | null;
  capex_min_usd?: number | null;
  capex_max_usd?: number | null;
};

export type CreateScoutResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function validate(input: CreateScoutInput): string | null {
  if (!input.countries || input.countries.length === 0) {
    return "Select at least one country.";
  }
  for (const c of input.countries) {
    if (!SUPPORTED_COUNTRIES.has(c)) return `Unsupported country: ${c}`;
  }
  if (!input.therapeutic_area?.trim()) {
    return "Therapeutic area is required.";
  }
  if (!input.modality?.trim()) {
    return "Modality is required.";
  }
  if (
    input.patent_signal_type !== "patent_expiry" &&
    input.patent_signal_type !== "non_filed_region"
  ) {
    return "Choose a patent signal type.";
  }
  if (input.patent_signal_type === "patent_expiry") {
    const v = input.expiry_time_horizon_months;
    if (v == null || !Number.isInteger(v) || v <= 0) {
      return "Provide a positive integer for expiry time horizon (months).";
    }
  }
  if (input.patent_signal_type === "non_filed_region") {
    const v = input.non_filed_lookback_years;
    if (v == null || !Number.isInteger(v) || v <= 0) {
      return "Provide a positive integer for non-filed lookback (years).";
    }
  }

  for (const [k, v] of [
    ["market_floor_usd", input.market_floor_usd],
    ["minimum_unit_volume", input.minimum_unit_volume],
    ["capex_min_usd", input.capex_min_usd],
    ["capex_max_usd", input.capex_max_usd],
  ] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return `${k} must be a non-negative number.`;
    }
  }
  if (
    input.minimum_unit_volume != null &&
    !Number.isInteger(input.minimum_unit_volume)
  ) {
    return "Minimum unit volume must be a whole number.";
  }
  if (
    input.capex_min_usd != null &&
    input.capex_max_usd != null &&
    input.capex_max_usd < input.capex_min_usd
  ) {
    return "Capex max must be greater than or equal to capex min.";
  }

  return null;
}

export async function createScout(
  input: CreateScoutInput,
): Promise<CreateScoutResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const { user, supabase } = await requireUser();

  const insert: ScoutInsert = {
    user_id: user.id,
    name: input.name?.trim() || null,
    countries: input.countries,
    therapeutic_area: input.therapeutic_area.trim(),
    patent_signal_type: input.patent_signal_type,
    expiry_time_horizon_months:
      input.patent_signal_type === "patent_expiry"
        ? (input.expiry_time_horizon_months ?? null)
        : null,
    non_filed_lookback_years:
      input.patent_signal_type === "non_filed_region"
        ? (input.non_filed_lookback_years ?? null)
        : null,
    modality: input.modality.trim(),
    market_floor_usd: input.market_floor_usd ?? null,
    minimum_unit_volume: input.minimum_unit_volume ?? null,
    capex_min_usd: input.capex_min_usd ?? null,
    capex_max_usd: input.capex_max_usd ?? null,
    status: "active",
    // Schedule the first run immediately; the cron worker will pick it up
    // on its next 6-hour tick.
    next_run_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("scouts")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  // Throws NEXT_REDIRECT — must be outside try/catch.
  redirect(`/dashboard?created=${data.id}`);
}
