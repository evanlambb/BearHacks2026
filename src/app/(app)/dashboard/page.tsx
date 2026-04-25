import Link from "next/link";
import { ArrowUpRight, FileText, Microscope, Plus, Radar } from "lucide-react";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`Welcome back, ${user.email ?? "operator"}. Your scouts run every six hours and surface generic-eligible molecules and unfiled-region windows.`}
        action={
          <Link href="/create-scout" className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" />
            Create Scout
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Active scouts" value="0" hint="No scouts yet" />
        <StatCard label="Patents reviewed" value="0" hint="Last 24h" />
        <StatCard label="Opportunities" value="0" hint="Ready reports" />
        <StatCard label="Next scheduled run" value="—" hint="Awaiting first scout" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <EmptyCard
          icon={<Radar className="h-4 w-4" />}
          title="No scouts configured"
          description="Define filters once. Patent Scout will continuously ingest WIPO and EPO filings and triage candidates against your thesis."
          action={
            <Link href="/create-scout" className="btn btn-primary">
              <Plus className="h-3.5 w-3.5" />
              Create your first scout
            </Link>
          }
        />
        <EmptyCard
          icon={<Microscope className="h-4 w-4" />}
          title="Triage activity"
          description="Recent Gemini triage decisions will appear here once a scout has run."
        />
        <EmptyCard
          icon={<FileText className="h-4 w-4" />}
          title="Latest reports"
          description="GPT-generated PDF reports will be listed here as Sonar deep-research completes."
          action={
            <Link
              href="/scouts"
              className="btn btn-ghost text-[color:var(--color-ink)]"
            >
              View all scouts
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
      <div>
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-[color:var(--color-ink-subtle)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col p-5">
      <div className="flex items-center gap-2 text-[color:var(--color-ink-muted)]">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--color-surface-muted)]">
          {icon}
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>
      <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
