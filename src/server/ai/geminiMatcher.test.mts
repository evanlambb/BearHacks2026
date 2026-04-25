import assert from "node:assert/strict";
import test from "node:test";

import geminiMatcherModule from "./geminiMatcher";

const { processPendingScoutPatentMatches, __private__ } = geminiMatcherModule as {
  processPendingScoutPatentMatches: (input: {
    scoutId?: string;
    supabase?: unknown;
    matcher?: { matchPatent: (prompt: string) => Promise<unknown> };
  }) => Promise<{ processed: number; matched: number; rejected: number; errors: number }>;
  __private__: {
    parseDecision: (input: string) => unknown;
  };
};

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

class SelectBuilder {
  private readonly filters: Array<{ key: string; value: unknown }> = [];

  constructor(private readonly table: Row[]) {}

  eq(key: string, value: unknown): this {
    this.filters.push({ key, value });
    return this;
  }

  private run(): Row[] {
    return this.table.filter((row) =>
      this.filters.every((filter) => row[filter.key] === filter.value),
    );
  }

  async single() {
    const rows = this.run();
    if (!rows[0]) return { data: null, error: { message: "Not found" } };
    return { data: rows[0], error: null };
  }

  async order() {
    return { data: this.run(), error: null };
  }
}

class UpdateBuilder {
  private readonly values: Row;
  private readonly table: Row[];

  constructor(table: Row[], values: Row) {
    this.table = table;
    this.values = values;
  }

  async eq(column: string, value: unknown) {
    let updated = false;
    for (const row of this.table) {
      if (row[column] === value) {
        Object.assign(row, this.values);
        updated = true;
      }
    }
    if (!updated) return { data: null, error: { message: "No rows updated" } };
    return { data: null, error: null };
  }
}

class FakeSupabase {
  readonly tables: Tables;

  constructor(tables: Tables) {
    this.tables = tables;
  }

  from(table: string) {
    const rows = this.tables[table] ?? [];
    return {
      select: () => new SelectBuilder(rows),
      update: (values: Row) => new UpdateBuilder(rows, values),
      upsert: async (
        value: Row,
        options?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) => {
        const conflict = options?.onConflict?.split(",").map((v) => v.trim()) ?? [];
        const existingIndex =
          conflict.length === 0
            ? -1
            : rows.findIndex((candidate) => conflict.every((key) => candidate[key] === value[key]));

        if (existingIndex >= 0) {
          if (!options?.ignoreDuplicates) {
            rows[existingIndex] = { ...rows[existingIndex], ...value };
          }
          return { data: rows[existingIndex], error: null };
        }

        rows.push({ id: `${rows.length + 1}`, ...value });
        return { data: value, error: null };
      },
    };
  }
}

function seedSupabase() {
  return new FakeSupabase({
    scouts: [
      {
        id: "scout-1",
        user_id: "user-1",
        name: "Scout",
        countries: ["United States", "Japan"],
        therapeutic_area: "Oncology",
        patent_signal_type: "non_filed_region",
        expiry_time_horizon_months: null,
        non_filed_lookback_years: 4,
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
      },
    ],
    patents: [
      {
        id: "p1",
        patent_id: "WO2026123456",
        canonical_publication_number: "WO2026123456",
        title: "Oncology formulation",
        abstract: "Cancer treatment",
        applicants: ["ACME"],
        inventors: ["Jane Doe"],
        filing_date: "2025-01-01",
        publication_date: "2026-01-01",
        priority_date: "2024-01-01",
        grant_date: null,
        family_id: "FAM-1",
        jurisdictions: ["WO"],
        ipc_codes: ["A61K"],
        cpc_codes: ["A61K"],
        source: "wipo_epo",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p2",
        patent_id: "EP4455667A1",
        canonical_publication_number: "EP4455667A1",
        title: "Industrial polymer",
        abstract: "Non oncology",
        applicants: ["OTHER"],
        inventors: ["John Roe"],
        filing_date: "2025-01-01",
        publication_date: "2026-01-01",
        priority_date: null,
        grant_date: null,
        family_id: "FAM-2",
        jurisdictions: ["EP"],
        ipc_codes: ["C08F"],
        cpc_codes: ["C08F"],
        source: "wipo_epo",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p3",
        patent_id: "US9999999A1",
        canonical_publication_number: "US9999999A1",
        title: "Ambiguous",
        abstract: "Unknown",
        applicants: [],
        inventors: [],
        filing_date: null,
        publication_date: null,
        priority_date: null,
        grant_date: null,
        family_id: null,
        jurisdictions: [],
        ipc_codes: [],
        cpc_codes: [],
        source: "wipo_epo",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    wipo_publications: [
      {
        id: "w1",
        patent_id: "WO2026123456",
        publication_number: "WO2026123456",
        application_number: "PCT/US2025/1",
        language: "EN",
        filing_date: "2025-01-01",
        publication_date: "2026-01-01",
        priority_date: "2024-01-01",
        ipc_codes: ["A61K"],
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    epo_publications: [
      {
        id: "e1",
        patent_id: "EP4455667A1",
        publication_number_docdb: "EP4455667A1",
        application_number: "EP20251",
        family_id: "FAM-2",
        jurisdiction_code: "EP",
        filing_date: "2025-01-01",
        publication_date: "2026-01-01",
        grant_date: null,
        ipc_codes: ["C08F"],
        cpc_codes: ["C08F"],
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    epo_family_members: [
      {
        id: "f1",
        family_id: "FAM-2",
        patent_id: "EP4455667A1",
        publication_number_docdb: "EP4455667A1",
        jurisdiction_code: "EP",
        application_number: "EP20251",
        status: "pending",
        filing_date: "2025-01-01",
        publication_date: "2026-01-01",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    scout_patent_matches: [
      {
        id: "m1",
        scout_id: "scout-1",
        patent_id: "WO2026123456",
        match_status: "pending",
        match_score: null,
        match_reason: null,
        location_match: null,
        therapeutic_area_match: null,
        modality_match: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        scout_id: "scout-1",
        patent_id: "EP4455667A1",
        match_status: "pending",
        match_score: null,
        match_reason: null,
        location_match: null,
        therapeutic_area_match: null,
        modality_match: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m3",
        scout_id: "scout-1",
        patent_id: "US9999999A1",
        match_status: "pending",
        match_score: null,
        match_reason: null,
        location_match: null,
        therapeutic_area_match: null,
        modality_match: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    opportunity_reports: [],
  });
}

test("processes pending matches and creates reports only for matched", async () => {
  const supabase = seedSupabase();
  let call = 0;
  const matcher = {
    async matchPatent() {
      call += 1;
      if (call === 1) {
        return {
          match: true,
          match_score: 0.88,
          location_match: true,
          therapeutic_area_match: true,
          modality_match: true,
          reason: "Strong oncology alignment in target regions.",
          matched_countries: ["Japan"],
          concerns: ["US filing status uncertain"],
        };
      }
      if (call === 2) {
        return {
          match: false,
          match_score: 0.21,
          location_match: true,
          therapeutic_area_match: false,
          modality_match: false,
          reason: "Domain mismatch.",
          matched_countries: [],
          concerns: [],
        };
      }
      throw new Error("invalid-json");
    },
  };

  const result = await processPendingScoutPatentMatches({
    scoutId: "scout-1",
    supabase: supabase as unknown,
    matcher,
  });

  assert.deepEqual(result, { processed: 3, matched: 1, rejected: 1, errors: 1 });

  const rows = supabase.tables.scout_patent_matches;
  const m1 = rows.find((r) => r.id === "m1")!;
  const m2 = rows.find((r) => r.id === "m2")!;
  const m3 = rows.find((r) => r.id === "m3")!;

  assert.equal(m1.match_status, "matched");
  assert.equal(m2.match_status, "rejected");
  assert.equal(m3.match_status, "error");
  assert.equal(supabase.tables.opportunity_reports.length, 1);
  assert.equal(supabase.tables.opportunity_reports[0].region, "Japan");
});

test("robustly parses fenced JSON output", () => {
  const parsed = __private__.parseDecision(`
Here is the result:
\`\`\`json
{
  "match": true,
  "match_score": 0.73,
  "location_match": true,
  "therapeutic_area_match": true,
  "modality_match": false,
  "reason": "Partial alignment",
  "matched_countries": ["United States"],
  "concerns": ["Modality uncertain"]
}
\`\`\`
`);

  assert.equal((parsed as { match: boolean }).match, true);
  assert.equal((parsed as { match_score: number }).match_score, 0.73);
});
