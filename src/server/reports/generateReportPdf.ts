import type { OpportunityReportRow, PatentRow, ScoutRow } from "../../lib/supabase";
import { GptReportWriterClient, type IReportWriterClient } from "./gptReportWriter";
import { renderReportPdf } from "./pdfRenderer";
import { deepDiveReportSchema, type DeepDiveReport } from "../research/reportSchema";

type MinimalSupabase = {
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer,
        options?: { upsert?: boolean; contentType?: string },
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

type GenerateReportsResult = {
  processed: number;
  completed: number;
  failed: number;
};

type ReportContext = {
  opportunity: OpportunityReportRow;
  scout: ScoutRow;
  patent: PatentRow;
  reportJson: DeepDiveReport;
};

async function resolveSupabaseAdmin(): Promise<MinimalSupabase> {
  const mod = await import("../../lib/supabase/admin");
  return mod.getSupabaseAdmin() as unknown as MinimalSupabase;
}

function getWriter(client?: IReportWriterClient): IReportWriterClient {
  return client ?? new GptReportWriterClient();
}

async function loadGeneratingReports(
  supabase: MinimalSupabase,
  scoutId?: string,
): Promise<OpportunityReportRow[]> {
  let query = supabase
    .from("opportunity_reports")
    .select("*")
    .eq("report_status", "generating")
    .not("report_json", "is", null);

  if (scoutId) query = query.eq("scout_id", scoutId);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpportunityReportRow[];
}

async function loadContext(
  supabase: MinimalSupabase,
  opportunity: OpportunityReportRow,
): Promise<ReportContext> {
  if (!opportunity.scout_id || !opportunity.patent_id) {
    throw new Error("Opportunity report is missing scout_id or patent_id");
  }
  const reportJson = deepDiveReportSchema.parse(opportunity.report_json);

  const [{ data: scout }, { data: patent }] = await Promise.all([
    supabase.from("scouts").select("*").eq("id", opportunity.scout_id).single(),
    supabase.from("patents").select("*").eq("patent_id", opportunity.patent_id).single(),
  ]);
  if (!scout) throw new Error("Scout not found");
  if (!patent) throw new Error("Patent not found");

  return {
    opportunity,
    scout: scout as ScoutRow,
    patent: patent as PatentRow,
    reportJson,
  };
}

async function updateReport(
  supabase: MinimalSupabase,
  reportId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("opportunity_reports").update(values).eq("id", reportId);
  if (error) throw new Error(error.message);
}

function buildStoragePath(ctx: ReportContext): string {
  return `reports/${ctx.scout.user_id}/${ctx.scout.id}/${ctx.patent.patent_id}.pdf`;
}

export async function processGeneratingOpportunityReports(input: {
  scoutId?: string;
  supabase?: MinimalSupabase;
  writer?: IReportWriterClient;
  pdfRenderer?: (input: { title: string; markdown: string }) => Promise<Buffer>;
} = {}): Promise<GenerateReportsResult> {
  const supabase = input.supabase ?? (await resolveSupabaseAdmin());
  const writer = getWriter(input.writer);
  const render = input.pdfRenderer ?? renderReportPdf;
  const bucket = process.env.REPORT_BUCKET_NAME ?? "opportunity-reports";
  const generatingReports = await loadGeneratingReports(supabase, input.scoutId);

  let completed = 0;
  let failed = 0;

  for (const row of generatingReports) {
    try {
      const ctx = await loadContext(supabase, row);
      const markdown = await writer.writeReportMarkdown({
        opportunity: ctx.opportunity,
        scout: ctx.scout,
        patent: ctx.patent,
        report: ctx.reportJson,
      });

      const title = ctx.opportunity.drug_name ?? ctx.patent.title ?? ctx.patent.patent_id;
      const pdfBuffer = await render({ title, markdown });
      if (pdfBuffer.length === 0) throw new Error("Rendered PDF is empty");

      const storagePath = buildStoragePath(ctx);
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, pdfBuffer, { upsert: true, contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      await updateReport(supabase, row.id, {
        report_markdown: markdown,
        pdf_storage_path: storagePath,
        report_status: "complete",
        generated_at: new Date().toISOString(),
        error_message: null,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      await updateReport(supabase, row.id, {
        report_status: "error",
        error_message: `Final report generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`.slice(0, 4000),
      });
    }
  }

  return {
    processed: generatingReports.length,
    completed,
    failed,
  };
}
