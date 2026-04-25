import assert from "node:assert/strict";
import test from "node:test";

import reportsModule from "./generateReportPdf";
import pdfRendererModule from "./pdfRenderer";

const { processGeneratingOpportunityReports } = reportsModule as {
  processGeneratingOpportunityReports: (input: {
    scoutId?: string;
    supabase?: unknown;
    writer?: {
      writeReportMarkdown: (arg: unknown) => Promise<string>;
    };
    pdfRenderer?: (input: { title: string; markdown: string }) => Promise<Buffer>;
  }) => Promise<{ processed: number; completed: number; failed: number }>;
};
const { renderReportPdf } = pdfRendererModule as {
  renderReportPdf: (input: { title: string; markdown: string }) => Promise<Buffer>;
};

type Row = Record<string, unknown>;

class SelectBuilder {
  private readonly filters: Array<{ key: string; value: unknown }> = [];
  private notNullKey: string | null = null;
  constructor(private readonly rows: Row[]) {}
  eq(key: string, value: unknown): this {
    this.filters.push({ key, value });
    return this;
  }
  not(key: string, op: string, value: unknown): this {
    if (op === "is" && value === null) this.notNullKey = key;
    return this;
  }
  private run(): Row[] {
    return this.rows.filter((row) => {
      const filterPass = this.filters.every((f) => row[f.key] === f.value);
      const notPass = this.notNullKey ? row[this.notNullKey] != null : true;
      return filterPass && notPass;
    });
  }
  async order() {
    return { data: this.run(), error: null };
  }
  async single() {
    const rows = this.run();
    return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Not found" } };
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
  public uploads: Array<{ bucket: string; path: string; size: number }> = [];
  constructor(public readonly tables: Record<string, Row[]>) {}
  from(table: string) {
    const rows = this.tables[table] ?? [];
    return {
      select: () => new SelectBuilder(rows),
      update: (values: Row) => new UpdateBuilder(rows, values),
    };
  }
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, body: Buffer) => {
        this.uploads.push({ bucket, path, size: body.length });
        return { data: { path }, error: null };
      },
    }),
  };
}

function makeDeepDiveJson() {
  return {
    asset_summary: {
      inn: { value: "Imatinib", confidence_note: null, confidence: "high", evidence: [] },
      originator_brand: { value: "Gleevec", confidence_note: null, confidence: "high", evidence: [] },
      molecule_class: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      mechanism: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
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
      molecule_owner: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      current_generic_filers_by_country: [],
      paragraph_iv_history: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      settlement_history: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    market_sizing: {
      revenue_by_country: [],
      unit_volume_by_country: [],
      growth: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
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
    cdmo_matchmaking: { ranked_cdmos: [] },
    api_and_ksm_sourcing: {
      qualified_api_suppliers: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      dmf_holders: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      geographic_concentration_risk: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      price_trend: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    regulatory_pathway: { filing_routes_by_country: [] },
    risk_score: {
      composite: { score: null, explanation: null, confidence_note: null, evidence: [] },
      ip_litigation_risk: { score: null, explanation: null, confidence_note: null, evidence: [] },
      regulatory_risk: { score: null, explanation: null, confidence_note: null, evidence: [] },
      supply_concentration_risk: { score: null, explanation: null, confidence_note: null, evidence: [] },
      price_erosion_velocity: { score: null, explanation: null, confidence_note: null, evidence: [] },
      fx_risk: { score: null, explanation: null, confidence_note: null, evidence: [] },
      country_risk: { score: null, explanation: null, confidence_note: null, evidence: [] },
    },
    financial_model: {
      pnl_5y_by_country: [],
      sensitivities: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      npv: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      irr: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      payback: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
      capex_and_tooling_estimate: { value: null, confidence_note: null, confidence: "unknown", evidence: [] },
    },
    strategic_recommendation: {
      go_no_go: "go",
      launch_sequence_by_country: ["United States"],
      partnership_vs_in_house: null,
      first_to_file_urgency: null,
      confidence_note: null,
      evidence: [],
    },
    evidence_pack: {
      claims: [
        {
          claim: "Evidence URL preserved",
          confidence_note: null,
          evidence: [
            {
              title: "Source",
              url: "https://example.com/evidence",
              publisher: "FDA",
              accessed_at: "2026-04-25",
              claim_supported: "Preserve URL",
              patent_publication_number: null,
              page_reference: null,
              source_type: "regulator",
            },
          ],
        },
      ],
    },
  };
}

test("final report stage completes and uploads PDF", async () => {
  const supabase = new FakeSupabase({
    opportunity_reports: [
      {
        id: "r1",
        scout_id: "s1",
        patent_id: "p1",
        report_status: "generating",
        report_json: makeDeepDiveJson(),
        drug_name: "Imatinib",
        region: "United States",
      },
    ],
    scouts: [{ id: "s1", user_id: "u1", countries: ["United States"] }],
    patents: [{ patent_id: "p1", title: "Imatinib Patent" }],
  });

  const writer = {
    async writeReportMarkdown() {
      return "# Cover\n\nEvidence URL: https://example.com/evidence\n\n## Executive Summary\nStrong opportunity.";
    },
  };

  const result = await processGeneratingOpportunityReports({
    supabase: supabase as unknown,
    writer,
    pdfRenderer: async ({ title, markdown }) => renderReportPdf({ title, markdown }),
  });

  assert.deepEqual(result, { processed: 1, completed: 1, failed: 0 });
  assert.equal(supabase.uploads.length, 1);
  assert.match(supabase.uploads[0].path, /reports\/u1\/s1\/p1\.pdf/);

  const row = supabase.tables.opportunity_reports[0];
  assert.equal(row.report_status, "complete");
  assert.ok(typeof row.pdf_storage_path === "string");
  assert.match(String(row.report_markdown), /https:\/\/example.com\/evidence/);
});

test("final report stage marks error on write failure", async () => {
  const supabase = new FakeSupabase({
    opportunity_reports: [
      {
        id: "r2",
        scout_id: "s1",
        patent_id: "p2",
        report_status: "generating",
        report_json: makeDeepDiveJson(),
      },
    ],
    scouts: [{ id: "s1", user_id: "u1", countries: ["United States"] }],
    patents: [{ patent_id: "p2", title: "Bad Patent" }],
  });
  const writer = {
    async writeReportMarkdown() {
      throw new Error("writer failed");
    },
  };

  const result = await processGeneratingOpportunityReports({
    supabase: supabase as unknown,
    writer,
  });
  assert.deepEqual(result, { processed: 1, completed: 0, failed: 1 });
  assert.equal(supabase.tables.opportunity_reports[0].report_status, "error");
});
