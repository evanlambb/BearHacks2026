import { requireUser } from "@/lib/auth";
import { CreateScoutForm } from "./create-scout-form";

export const dynamic = "force-dynamic";

export default async function CreateScoutPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="border-b border-[color:var(--color-border)] pb-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
          New scout
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Configure a scout
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
          Define geography, therapeutic area, signal type, and economics. Patent
          Scout will run this scout every six hours against fresh WIPO and EPO
          data and surface investment-grade opportunity reports.
        </p>
      </div>

      <CreateScoutForm />
    </div>
  );
}
