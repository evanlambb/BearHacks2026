import Link from "next/link";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CreateScoutPage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <div className="border-b border-[color:var(--color-border)] pb-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
          New scout
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Configure a scout
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
          Define the geography, therapeutic area, signal type, and economic
          floor. Patent Scout will run the scout every six hours.
        </p>
      </div>

      <div className="surface p-6">
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          Scout configuration form ships in the next phase. Schema, RLS, and
          server actions are already in place under{" "}
          <code className="mono">scouts</code>.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/dashboard" className="btn btn-secondary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
