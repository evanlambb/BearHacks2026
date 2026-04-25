import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PatentReportPage({
  params,
}: {
  params: Promise<{ scout_id: string; patent_id: string }>;
}) {
  const { scout_id, patent_id } = await params;
  const { supabase, user } = await requireUser();

  // Verify scout ownership before exposing any patent or report data.
  const { data: scout } = await supabase
    .from("scouts")
    .select("id, name, therapeutic_area")
    .eq("id", scout_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!scout) notFound();

  const { data: report } = await supabase
    .from("opportunity_reports")
    .select("*")
    .eq("scout_id", scout.id)
    .eq("patent_id", patent_id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/scouts/${scout.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {scout.name ?? "Scout"}
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            Opportunity report
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {report?.drug_name ?? patent_id}
          </h1>
          <p className="mt-1.5 text-[13px] text-[color:var(--color-ink-muted)]">
            <span className="mono">{patent_id}</span>
            {report?.region ? <> · {report.region}</> : null}
            {report?.signal_type ? (
              <>
                {" "}
                · <span className="kbd">{report.signal_type}</span>
              </>
            ) : null}
          </p>
        </div>

        {report?.pdf_storage_path ? (
          <Link
            href={`/api/reports/${report.id}/download`}
            className="btn btn-primary"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Link>
        ) : null}
      </div>

      {!report ? (
        <div className="surface p-6 text-[13px] text-[color:var(--color-ink-muted)]">
          No report exists for this patent yet.
        </div>
      ) : report.report_status !== "complete" ? (
        <div className="surface p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
            Status
          </div>
          <div className="mt-1 text-[15px] capitalize">{report.report_status}</div>
          {report.error_message ? (
            <div className="mt-3 text-[12px] text-[color:var(--color-danger)]">
              {report.error_message}
            </div>
          ) : (
            <p className="mt-3 max-w-xl text-[13px] text-[color:var(--color-ink-muted)]">
              The deep-research pipeline is still running. This page will show
              the rendered report once Sonar and GPT have finished.
            </p>
          )}
        </div>
      ) : (
        <article className="surface prose-sm prose max-w-none p-8">
          {report.report_markdown ? (
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-ink)]">
              {report.report_markdown}
            </pre>
          ) : (
            <div className="text-[13px] text-[color:var(--color-ink-muted)]">
              Report rendered. Use the download button to retrieve the PDF.
            </div>
          )}
        </article>
      )}
    </div>
  );
}
