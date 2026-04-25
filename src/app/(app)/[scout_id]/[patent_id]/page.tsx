import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ChevronLeft, Download, FileText, Loader2 } from "lucide-react";

import { requireUser } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

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

  const { data: report, error: reportError } = await supabase
    .from("opportunity_reports")
    .select("*")
    .eq("scout_id", scout.id)
    .eq("patent_id", patent_id)
    .maybeSingle();

  if (reportError) {
    throw reportError;
  }

  const { data: patent } = await supabase
    .from("patents")
    .select(
      "patent_id, canonical_publication_number, title, applicants, inventors, filing_date, publication_date, priority_date, jurisdictions, ipc_codes, cpc_codes",
    )
    .eq("patent_id", patent_id)
    .maybeSingle();

  const [{ data: wipo }, { data: epo }] = await Promise.all([
    supabase
      .from("wipo_publications")
      .select(
        "publication_number, title, applicants, inventors, filing_date, publication_date, priority_date, ipc_codes",
      )
      .eq("patent_id", patent_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("epo_publications")
      .select(
        "publication_number_docdb, title, applicants, inventors, filing_date, publication_date, ipc_codes, cpc_codes, jurisdiction_code",
      )
      .eq("patent_id", patent_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const merged = {
    patentId: patent?.patent_id ?? patent_id,
    publicationNumber:
      patent?.canonical_publication_number ??
      wipo?.publication_number ??
      epo?.publication_number_docdb ??
      "—",
    title: patent?.title ?? wipo?.title ?? epo?.title ?? "—",
    applicants: patent?.applicants ?? wipo?.applicants ?? epo?.applicants ?? [],
    inventors: patent?.inventors ?? wipo?.inventors ?? epo?.inventors ?? [],
    filingDate: patent?.filing_date ?? wipo?.filing_date ?? epo?.filing_date ?? null,
    publicationDate:
      patent?.publication_date ?? wipo?.publication_date ?? epo?.publication_date ?? null,
    priorityDate: patent?.priority_date ?? wipo?.priority_date ?? null,
    jurisdictions:
      patent?.jurisdictions ??
      (epo?.jurisdiction_code ? [epo.jurisdiction_code] : []),
    ipcCodes: patent?.ipc_codes ?? wipo?.ipc_codes ?? epo?.ipc_codes ?? [],
    cpcCodes: patent?.cpc_codes ?? epo?.cpc_codes ?? [],
  };

  const signalLabel = readableSignal(report?.signal_type ?? null);

  return (
    <div className="space-y-6" data-testid="report-detail-page">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
          data-testid="back-to-dashboard"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <span className="mx-2 text-[color:var(--color-ink-subtle)]">/</span>
        <Link
          href={`/scouts/${scout.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
          data-testid="back-to-scout"
        >
          Scout
        </Link>
      </div>

      <div className="surface sticky top-4 z-10 flex flex-wrap items-end justify-between gap-4 px-5 py-4 backdrop-blur-sm">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            Opportunity report
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {report?.drug_name ?? patent_id}
          </h1>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--color-ink-muted)]"
            data-testid="report-header-meta"
          >
            <span className="mono">{merged.patentId}</span>
            <span>·</span>
            <span>{report?.region ?? "Region unavailable"}</span>
            <span>·</span>
            <span>{formatCurrency(report?.market_size_usd ?? null)}</span>
            <span>·</span>
            <span className="kbd">{signalLabel}</span>
            <StatusPill status={report?.report_status ?? "pending"} />
          </div>
        </div>

        {report?.pdf_storage_path ? (
          <Link
            href={`/api/reports/${scout_id}/${patent_id}/pdf`}
            className="btn btn-primary"
            target="_blank"
            rel="noreferrer"
            data-testid="download-pdf-button"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Link>
        ) : (
          <button className="btn" disabled data-testid="download-pdf-disabled">
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        )}
      </div>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="patent-metadata-panel"
      >
        <Field label="Patent ID" value={merged.patentId} mono />
        <Field label="Publication number" value={merged.publicationNumber} mono />
        <Field label="Title" value={merged.title} />
        <Field label="Applicants" value={listOrDash(merged.applicants)} />
        <Field label="Inventors" value={listOrDash(merged.inventors)} />
        <Field label="Filing date" value={formatDate(merged.filingDate)} mono />
        <Field label="Publication date" value={formatDate(merged.publicationDate)} mono />
        <Field label="Priority date" value={formatDate(merged.priorityDate)} mono />
        <Field label="Jurisdictions" value={listOrDash(merged.jurisdictions)} />
        <Field label="IPC codes" value={listOrDash(merged.ipcCodes)} mono />
        <Field label="CPC codes" value={listOrDash(merged.cpcCodes)} mono />
      </section>

      {!report ? (
        <div
          className="surface p-6 text-[13px] text-[color:var(--color-ink-muted)]"
          data-testid="report-empty-state"
        >
          No report exists for this patent yet.
        </div>
      ) : report.report_status === "pending" || report.report_status === "generating" ? (
        <div className="surface p-6" data-testid="report-progress-state">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Report is {report.report_status}
          </div>
          <p className="mt-2 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
            The scout pipeline is compiling evidence and modeling the opportunity.
            Refresh shortly for completed analysis and downloadable output.
          </p>
        </div>
      ) : report.report_status === "error" ? (
        <div className="surface p-6" data-testid="report-error-state">
          <div className="flex items-center gap-2 text-[15px] font-medium text-[color:var(--color-danger)]">
            <AlertTriangle className="h-4 w-4" />
            Report generation failed
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-danger)]">
            {report.error_message ?? "The report failed with an unknown error."}
          </p>
        </div>
      ) : (
        <article className="surface overflow-hidden p-0" data-testid="report-content">
          {report.report_markdown ? (
            <div className="prose prose-sm max-w-none px-6 py-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {report.report_markdown}
              </ReactMarkdown>
            </div>
          ) : report.report_json ? (
            <ReportJsonSections reportJson={report.report_json} />
          ) : (
            <div className="text-[13px] text-[color:var(--color-ink-muted)]">
              Report is complete, but no content payload was attached.
            </div>
          )}
        </article>
      )}
    </div>
  );
}

function ReportJsonSections({ reportJson }: { reportJson: Json }) {
  const sectionNames = [
    "Asset Summary",
    "Patent and Exclusivity Landscape",
    "Originator and Filer Intelligence",
    "Market Sizing",
    "Competitive Density",
    "CDMO Matchmaking",
    "API and KSM Sourcing",
    "Regulatory Pathway",
    "Risk Score",
    "Financial Model",
    "Strategic Recommendation",
    "Evidence Pack",
  ];
  const sectionMap = normalizeSectionMap(reportJson);

  return (
    <div className="space-y-3 px-4 py-4" data-testid="report-json-sections">
      {sectionNames.map((name) => {
        const key = canonicalize(name);
        const value =
          sectionMap.get(key) ??
          sectionMap.get(key.replace(/and/g, "")) ??
          sectionMap.get(key.replace(/ksm/g, "ksms"));

        return (
          <section key={name} className="surface p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
              {name}
            </h3>
            <div className="mt-2 text-[13px] text-[color:var(--color-ink)]">
              {renderJsonValue(value)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function normalizeSectionMap(input: Json): Map<string, Json> {
  const map = new Map<string, Json>();
  if (!input || typeof input !== "object" || Array.isArray(input)) return map;
  for (const [k, v] of Object.entries(input)) {
    map.set(canonicalize(k), v as Json);
  }
  return map;
}

function renderJsonValue(value: Json | undefined): React.ReactNode {
  if (value == null) {
    return <span className="text-[color:var(--color-ink-muted)]">Not available.</span>;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[color:var(--color-ink-muted)]">No entries.</span>;
    }
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={index}>{renderJsonValue(item)}</li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <span className="text-[color:var(--color-ink-muted)]">No fields.</span>;
  }
  return (
    <dl className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-ink-subtle)]">
            {humanize(k)}
          </dt>
          <dd className="mt-0.5">{renderJsonValue(v as Json)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="surface px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div
        className={`mt-1 line-clamp-3 text-[13px] text-[color:var(--color-ink)] ${mono ? "mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete:
      "text-[color:var(--color-success)] border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8",
    pending:
      "text-[color:var(--color-ink-muted)] border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-muted)]",
    generating:
      "text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8",
    error:
      "text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/8",
  };
  return (
    <span
      data-testid="report-status-badge"
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}

function readableSignal(signal: string | null) {
  if (signal === "patent_expiry") return "Patent Expiry";
  if (signal === "non_filed_region") return "Non-Filed Region";
  return signal ?? "Unknown signal";
}

function formatCurrency(v: number | null) {
  if (v == null) return "Market size unavailable";
  return `$${v.toLocaleString()}`;
}

function listOrDash(v: string[] | null | undefined) {
  if (!v || v.length === 0) return "—";
  return v.join(", ");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

function canonicalize(key: string) {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
