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

function getSonarClient(client?: ISonarClient): ISonarClient {
  return client ?? new SonarClient();
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
      const report = await sonarClient.generateDeepDive(prompt);

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
