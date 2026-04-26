import type {
  EpoFamilyMemberRow,
  EpoPublicationRow,
  OpportunityReportRow,
  PatentRow,
  ScoutRow,
  WipoPublicationRow,
} from "../../lib/supabase";
import { buildDeepDivePatentPrompt } from "./prompts/deepDivePatent";
import type { DeepDiveReport } from "./reportSchema";
import { SonarClient, type ISonarClient } from "./sonarClient";

type MinimalSupabase = { from: (table: string) => any };

type ProcessDeepDiveResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

type DeepDiveContext = {
  opportunity: OpportunityReportRow;
  scout: ScoutRow;
  patent: PatentRow;
  wipoPublications: WipoPublicationRow[];
  epoPublications: EpoPublicationRow[];
  epoFamilyMembers: EpoFamilyMemberRow[];
};

function metric(value: string | number | null, confidence: "high" | "medium" | "low" | "unknown" = "medium") {
  return { value, confidence_note: null, confidence, evidence: [] };
}

function buildDemoDeepDiveReport(ctx: DeepDiveContext): DeepDiveReport {
  const leadCountry = ctx.scout.countries[0] ?? "United States";
  const secondCountry = ctx.scout.countries[1] ?? "Canada";
  const title = ctx.patent.title?.slice(0, 80) ?? ctx.patent.patent_id;
  return {
    asset_summary: {
      inn: metric(title, "medium"),
      originator_brand: metric("Demo Brand", "low"),
      molecule_class: metric(ctx.scout.modality, "medium"),
      mechanism: metric("Mechanism under review", "low"),
      indications: [metric(ctx.scout.therapeutic_area, "medium")],
      dosage_forms: [metric("Oral", "low")],
      strengths: [metric("10mg", "low")],
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
      molecule_owner: metric("Originator TBD", "low"),
      current_generic_filers_by_country: [],
      paragraph_iv_history: metric(null, "unknown"),
      settlement_history: metric(null, "unknown"),
    },
    market_sizing: {
      revenue_by_country: [
        { country: leadCountry, value: 120_000_000, currency: "USD", confidence_note: null, confidence: "medium", evidence: [] },
        { country: secondCountry, value: 40_000_000, currency: "USD", confidence_note: null, confidence: "low", evidence: [] },
      ],
      unit_volume_by_country: [],
      growth: metric("4.5%", "low"),
      payer_mix: metric("Public/private mixed", "low"),
      tender_vs_retail: metric("Tender-led", "low"),
      reference_pricing: metric("Likely in key markets", "low"),
      post_loe_erosion_curve: metric("Moderate initial erosion", "low"),
    },
    competitive_density: {
      existing_generic_approvals: metric("Low", "low"),
      pipeline_filings: metric("Early signals", "low"),
      pending_andas: metric(null, "unknown"),
      biosimilar_developers: metric(null, "unknown"),
    },
    cdmo_matchmaking: { ranked_cdmos: [] },
    api_and_ksm_sourcing: {
      qualified_api_suppliers: metric("Available", "low"),
      dmf_holders: metric("Unknown", "unknown"),
      geographic_concentration_risk: metric("Moderate", "low"),
      price_trend: metric("Stable", "low"),
    },
    regulatory_pathway: { filing_routes_by_country: [] },
    risk_score: {
      composite: { score: 0.42, explanation: "Moderate-risk demo profile", confidence_note: null, evidence: [] },
      ip_litigation_risk: { score: 0.5, explanation: null, confidence_note: null, evidence: [] },
      regulatory_risk: { score: 0.35, explanation: null, confidence_note: null, evidence: [] },
      supply_concentration_risk: { score: 0.4, explanation: null, confidence_note: null, evidence: [] },
      price_erosion_velocity: { score: 0.55, explanation: null, confidence_note: null, evidence: [] },
      fx_risk: { score: 0.2, explanation: null, confidence_note: null, evidence: [] },
      country_risk: { score: 0.3, explanation: null, confidence_note: null, evidence: [] },
    },
    financial_model: {
      pnl_5y_by_country: [],
      sensitivities: metric("Price and speed-to-market sensitive", "low"),
      npv: metric(186_400_000, "low"),
      irr: metric("28.7%", "low"),
      payback: metric("3.2 years", "low"),
      capex_and_tooling_estimate: metric(6_000_000, "low"),
    },
    strategic_recommendation: {
      go_no_go: "go",
      launch_sequence_by_country: [leadCountry, secondCountry],
      partnership_vs_in_house: "Partner-led entry recommended.",
      first_to_file_urgency: "High in first target country.",
      confidence_note: "Demo-mode synthetic report.",
      evidence: [],
    },
    evidence_pack: { claims: [] },
  };
}

function getSonarClient(client?: ISonarClient): ISonarClient {
  return client ?? new SonarClient();
}

function getPinnedDemoPatentId() {
  const raw = process.env.DEMO_TARGET_PATENT_ID?.trim();
  return raw && raw.length > 0 ? raw : null;
}

async function resolveSupabaseAdmin(): Promise<MinimalSupabase> {
  const mod = await import("../../lib/supabase/admin");
  return mod.getSupabaseAdmin() as unknown as MinimalSupabase;
}

async function loadPendingReports(
  supabase: MinimalSupabase,
  scoutId?: string,
): Promise<OpportunityReportRow[]> {
  let query = supabase.from("opportunity_reports").select("*").eq("report_status", "pending");
  if (scoutId) query = query.eq("scout_id", scoutId);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpportunityReportRow[];
}

async function loadContext(
  supabase: MinimalSupabase,
  opportunity: OpportunityReportRow,
): Promise<DeepDiveContext> {
  if (!opportunity.scout_id || !opportunity.patent_id) {
    throw new Error("Opportunity report is missing scout_id or patent_id");
  }

  const [{ data: scout }, { data: patent }, { data: wipo }, { data: epo }, { data: family }] =
    await Promise.all([
      supabase.from("scouts").select("*").eq("id", opportunity.scout_id).single(),
      supabase.from("patents").select("*").eq("patent_id", opportunity.patent_id).single(),
      supabase.from("wipo_publications").select("*").eq("patent_id", opportunity.patent_id).order("created_at", { ascending: true }),
      supabase.from("epo_publications").select("*").eq("patent_id", opportunity.patent_id).order("created_at", { ascending: true }),
      supabase.from("epo_family_members").select("*").eq("patent_id", opportunity.patent_id).order("created_at", { ascending: true }),
    ]);

  if (!scout) throw new Error("Scout not found");
  if (!patent) throw new Error("Patent not found");

  return {
    opportunity,
    scout: scout as ScoutRow,
    patent: patent as PatentRow,
    wipoPublications: (wipo ?? []) as WipoPublicationRow[],
    epoPublications: (epo ?? []) as EpoPublicationRow[],
    epoFamilyMembers: (family ?? []) as EpoFamilyMemberRow[],
  };
}

function deriveRegion(report: DeepDiveReport, fallbackRegion: string | null, scoutCountries: string[]): string | null {
  const countries = report.market_sizing.revenue_by_country.map((x) => x.country).filter(Boolean);
  if (countries.length > 0) return countries.join(", ");
  if (fallbackRegion?.trim()) return fallbackRegion;
  return scoutCountries.length > 0 ? scoutCountries.join(", ") : null;
}

function deriveMarketSizeUsd(report: DeepDiveReport): number | null {
  let sum = 0;
  let found = false;
  for (const row of report.market_sizing.revenue_by_country) {
    if (typeof row.value === "number") {
      sum += row.value;
      found = true;
    }
  }
  return found ? sum : null;
}

function deriveDrugName(report: DeepDiveReport, patentTitle: string | null): string | null {
  const inn = report.asset_summary.inn.value;
  if (typeof inn === "string" && inn.trim()) return inn.trim();
  const brand = report.asset_summary.originator_brand.value;
  if (typeof brand === "string" && brand.trim()) return brand.trim();
  return patentTitle?.trim() || null;
}

async function updateReport(
  supabase: MinimalSupabase,
  reportId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("opportunity_reports").update(values).eq("id", reportId);
  if (error) throw new Error(error.message);
}

export async function processPendingDeepDiveReports(input: {
  scoutId?: string;
  supabase?: MinimalSupabase;
  sonarClient?: ISonarClient;
} = {}): Promise<ProcessDeepDiveResult> {
  const supabase = input.supabase ?? (await resolveSupabaseAdmin());
  const sonarClient = getSonarClient(input.sonarClient);
  const demoMode = process.env.DEMO_FORCE_REPORTS === "1";
  const pinnedDemoPatentId = getPinnedDemoPatentId();

  if (demoMode && input.scoutId && pinnedDemoPatentId) {
    const { error: requeueError } = await supabase
      .from("opportunity_reports")
      .update({
        report_status: "pending",
        error_message: null,
      })
      .eq("scout_id", input.scoutId)
      .eq("patent_id", pinnedDemoPatentId);
    if (requeueError) {
      throw new Error(
        `Unable to requeue pinned demo report: ${requeueError.message}`,
      );
    }
  }

  const pending = await loadPendingReports(supabase, input.scoutId);

  let succeeded = 0;
  let failed = 0;

  for (const opportunity of pending) {
    try {
      await updateReport(supabase, opportunity.id, {
        report_status: "generating",
        error_message: null,
      });

      const ctx = await loadContext(supabase, opportunity);
      const prompt = buildDeepDivePatentPrompt({
        opportunity: ctx.opportunity,
        scout: ctx.scout,
        patent: ctx.patent,
        wipoPublications: ctx.wipoPublications,
        epoPublications: ctx.epoPublications,
        epoFamilyMembers: ctx.epoFamilyMembers,
      });
      const report = demoMode
        ? buildDemoDeepDiveReport(ctx)
        : await sonarClient.generateDeepDive(prompt);

      await updateReport(supabase, opportunity.id, {
        report_json: report,
        drug_name: deriveDrugName(report, ctx.patent.title),
        region: deriveRegion(report, opportunity.region, ctx.scout.countries),
        market_size_usd: deriveMarketSizeUsd(report),
        report_status: "generating",
        error_message: null,
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      await updateReport(supabase, opportunity.id, {
        report_status: "error",
        error_message: `Deep dive generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`.slice(0, 4000),
      });
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
  };
}
