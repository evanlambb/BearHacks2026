import { requireUser } from "@/lib/auth";
import { CreateScoutForm } from "./create-scout-form";

export const dynamic = "force-dynamic";

export default async function CreateScoutPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Create Scout</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-[color:var(--color-ink-muted)]">
          Define the filters your scout will use to identify patent-driven drug opportunities.
        </p>
      </div>

      <CreateScoutForm />
    </div>
  );
}
