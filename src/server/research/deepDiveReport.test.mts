import assert from "node:assert/strict";
import test from "node:test";

import researchModule from "./deepDiveReport";
import sonarModule from "./sonarClient";

const { processPendingDeepDiveReports } = researchModule as {
  processPendingDeepDiveReports: (input: {
    scoutId?: string;
    supabase?: unknown;
    sonarClient?: { generateDeepDive: (prompt: string) => Promise<unknown> };
  }) => Promise<{ processed: number; succeeded: number; failed: number }>;
};

const { parseDeepDiveReportJson } = sonarModule as {
  parseDeepDiveReportJson: (json: string) => unknown;
};

type Row = Record<string, unknown>;

class SelectBuilder {
  private readonly filters: Array<{ key: string; value: unknown }> = [];
  private readonly rows: Row[];

  constructor(rows: Row[]) {
    this.rows = rows;
  }

  eq(key: string, value: unknown): this {
    this.filters.push({ key, value });
    return this;
  }

  private run(): Row[] {
    return this.rows.filter((row) =>
      this.filters.every((f) => row[f.key] === f.value),
    );
  }

  async single() {
    const rows = this.run();
    return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Not found" } };
  }

  async order() {
    return { data: this.run(), error: null };
  }
}

class UpdateBuilder {
  constructor(private readonly rows: Row[], private readonly values: Row) {}

  async eq(column: string, value: unknown) {
    for (const row of this.rows) {
      if (row[column] === value) Object.assign(row, this.values);
    }
    return { data: null, error: null };
  }
}

class FakeSupabase {
  constructor(public readonly tables: Record<string, Row[]>) {}

  from(table: string) {
    const rows = this.tables[table] ?? [];
    return {
      select: () => new SelectBuilder(rows),
      update: (values: Row) => new UpdateBuilder(rows, values),
      upsert: async () => ({ data: null, error: null }),
    };
  }
}

function makeValidReport() {
  return {
    asset_summary: {
      inn: { value: "Imatinib", confidence_note: null, confidence: "high", evidence: [] },
      originator_brand: { value: "Gleevec", confidence_note: null, confidence: "high", evidence: [] },
      molecule_class: { value: "Tyrosine kinase inhibitor", confidence_note: null, confidence: "medium", evidence: [] },
      mechanism: { value: "BCR-ABL inhibition", confidence_note: null, confidence: "medium", evidence: [] },
      indications: [],
      dosage_forms: [],
      strengths: [],
    },
    patent_and_exclusivity_landscape: {
      composition_of_matter: [],
      formulation: [],
      method_of_use: [],
      polymorph: [],
      salt: [],
      spc_pte: [],
      pediatric_extensions: [],
      data_exclusivity: [],
      orphan_exclusivity: [],
      expiry_timeline_by_country: [],
    },
    originator_and_filer_intelligence: {
      molecule_owner: { value: "Novartis", confidence_note: null, confidence: "medium", evidence: [] },
      current_generic_filers_by_country: [],
      paragraph_iv_history: { value: null, confidence_note: "No US litigation found", confidence: "low", evidence: [] },
      settlement_history: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    market_sizing: {
      revenue_by_country: [
        { country: "United States", value: 100000000, currency: "USD", confidence_note: null, confidence: "medium", evidence: [] },
      ],
      unit_volume_by_country: [],
      growth: { value: "2%", confidence_note: null, confidence: "low", evidence: [] },
      payer_mix: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      tender_vs_retail: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      reference_pricing: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      post_loe_erosion_curve: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    competitive_density: {
      existing_generic_approvals: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      pipeline_filings: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      pending_andas: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      biosimilar_developers: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    cdmo_matchmaking: {
      ranked_cdmos: [],
    },
    api_and_ksm_sourcing: {
      qualified_api_suppliers: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      dmf_holders: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      geographic_concentration_risk: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      price_trend: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    regulatory_pathway: {
      filing_routes_by_country: [],
    },
    risk_score: {
      composite: { score: 0.4, explanation: "Moderate", confidence_note: null, evidence: [] },
      ip_litigation_risk: { score: 0.5, explanation: null, confidence_note: null, evidence: [] },
      regulatory_risk: { score: 0.3, explanation: null, confidence_note: null, evidence: [] },
      supply_concentration_risk: { score: 0.2, explanation: null, confidence_note: null, evidence: [] },
      price_erosion_velocity: { score: 0.6, explanation: null, confidence_note: null, evidence: [] },
      fx_risk: { score: 0.2, explanation: null, confidence_note: null, evidence: [] },
      country_risk: { score: 0.3, explanation: null, confidence_note: null, evidence: [] },
    },
    financial_model: {
      pnl_5y_by_country: [],
      sensitivities: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      npv: { value: 1234567, confidence_note: null, confidence: "low", evidence: [] },
      irr: { value: "17%", confidence_note: null, confidence: "low", evidence: [] },
      payback: { value: "3 years", confidence_note: null, confidence: "low", evidence: [] },
      capex_and_tooling_estimate: { value: 5000000, confidence_note: null, confidence: "low", evidence: [] },
    },
    strategic_recommendation: {
      go_no_go: "go",
      launch_sequence_by_country: ["United States"],
      partnership_vs_in_house: "partnership",
      first_to_file_urgency: "high",
      confidence_note: null,
      evidence: [],
    },
    evidence_pack: {
      claims: [
        {
          claim: "Revenue estimate available",
          confidence_note: "Based on secondary sources",
          evidence: [
            {
              title: "SEC filing",
              url: "https://example.com",
              publisher: "SEC",
              accessed_at: "2026-04-25",
              claim_supported: "Revenue estimate",
              patent_publication_number: null,
              page_reference: null,
              source_type: "company_filing",
            },
          ],
        },
      ],
    },
  };
}

function seed() {
  return new FakeSupabase({
    opportunity_reports: [
      {
        id: "r1",
        scout_id: "s1",
        patent_id: "p1",
        report_status: "pending",
        signal_type: "patent_expiry",
        region: "United States",
      },
      {
        id: "r2",
        scout_id: "s1",
        patent_id: "p2",
        report_status: "pending",
        signal_type: "patent_expiry",
        region: "Japan",
      },
    ],
    scouts: [
      {
        id: "s1",
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
      },
    ],
    patents: [
      { patent_id: "p1", title: "Imatinib patent", abstract: null },
      { patent_id: "p2", title: "Bad patent", abstract: null },
    ],
    wipo_publications: [{ patent_id: "p1", publication_number: "WO1" }],
    epo_publications: [{ patent_id: "p1", publication_number_docdb: "EP1" }],
    epo_family_members: [{ patent_id: "p1", family_id: "F1" }],
  });
}

test("processes deep dive reports with success and failure handling", async () => {
  const supabase = seed();
  let call = 0;
  const sonarClient = {
    async generateDeepDive() {
      call += 1;
      if (call === 1) return makeValidReport();
      throw new Error("bad model output");
    },
  };

  const result = await processPendingDeepDiveReports({
    supabase: supabase as unknown,
    sonarClient,
  });

  assert.deepEqual(result, { processed: 2, succeeded: 1, failed: 1 });

  const [r1, r2] = supabase.tables.opportunity_reports;
  assert.equal(r1.report_status, "generating");
  assert.equal(r1.drug_name, "Imatinib");
  assert.equal(r1.market_size_usd, 100000000);
  assert.ok(r1.report_json);
  assert.equal((r1.report_json as { evidence_pack: { claims: unknown[] } }).evidence_pack.claims.length, 1);

  assert.equal(r2.report_status, "error");
  assert.match(String(r2.error_message), /Deep dive generation failed/);
});

test("validates and parses json payload", () => {
  const json = JSON.stringify(makeValidReport());
  const parsed = parseDeepDiveReportJson(json);
  assert.equal(
    (parsed as { strategic_recommendation: { go_no_go: string } }).strategic_recommendation.go_no_go,
    "go",
  );
});
