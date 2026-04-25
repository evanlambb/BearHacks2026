import test from "node:test";
import assert from "node:assert/strict";

import queryBuilderModule from "./queryBuilder";
import type { BuildScoutQueryInput } from "./queryBuilder";

const { buildPatentSearchQuery } = queryBuilderModule as {
  buildPatentSearchQuery: (input: BuildScoutQueryInput) => {
    textQuery: string;
    countries: string[];
    signalType: "patent_expiry" | "non_filed_region";
    expiryTimeHorizonMonths: number | null;
    nonFiledLookbackYears: number | null;
  };
};

type MockScout = BuildScoutQueryInput & {
  id: string;
  user_id: string;
  name: string | null;
  market_floor_usd: number | null;
  minimum_unit_volume: number | null;
  capex_min_usd: number | null;
  capex_max_usd: number | null;
  status: "active" | "paused" | "error";
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

function createScout(overrides: Partial<MockScout>): MockScout {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000002",
    name: "Test Scout",
    countries: ["United States", "Japan"],
    therapeutic_area: "Oncology",
    patent_signal_type: "patent_expiry",
    expiry_time_horizon_months: 18,
    non_filed_lookback_years: null,
    modality: "Small Molecule",
    market_floor_usd: null,
    minimum_unit_volume: null,
    capex_min_usd: null,
    capex_max_usd: null,
    status: "active",
    last_run_at: null,
    next_run_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("builds expiry scout query with countries", () => {
  const scout = createScout({});
  const query = buildPatentSearchQuery(scout);

  assert.equal(query.signalType, "patent_expiry");
  assert.equal(query.expiryTimeHorizonMonths, 18);
  assert.match(query.textQuery, /therapeutic_area:"Oncology"/);
  assert.match(query.textQuery, /modality:"Small Molecule"/);
  assert.match(query.textQuery, /\(country:"United States" OR country:"Japan"\)/);
  assert.match(query.textQuery, /expiry_horizon_months:<=18/);
});

test("builds non-filed scout query without expiry clause", () => {
  const scout = createScout({
    patent_signal_type: "non_filed_region",
    expiry_time_horizon_months: null,
    non_filed_lookback_years: 5,
  });

  const query = buildPatentSearchQuery(scout);
  assert.equal(query.signalType, "non_filed_region");
  assert.match(query.textQuery, /non_filed_lookback_years:<=5/);
  assert.equal(/expiry_horizon_months/.test(query.textQuery), false);
});
