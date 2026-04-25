import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth";
import { LoginCard } from "./login-card";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { user } = await getOptionalUser();
  const { next, error } = await searchParams;

  if (user) {
    redirect(next && next.startsWith("/") ? next : "/dashboard");
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-grid">
      <div className="absolute inset-x-0 top-0 h-px bg-[color:var(--color-border)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <div className="grid w-full grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          {/* Brand / context column */}
          <div className="hidden lg:block">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent)]" />
              Patent Scout
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--color-ink)]">
              Continuous scouting<br />
              for drug patent opportunities.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[color:var(--color-ink-muted)]">
              Define a scout once. Every six hours we ingest fresh WIPO and EPO
              filings, triage candidates with Gemini, deep-research with Sonar,
              and deliver an investment-grade PDF report.
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-[color:var(--color-border)] pt-8">
              <Stat label="Scout cadence" value="6h" />
              <Stat label="Sources" value="WIPO · EPO" />
              <Stat label="Triage model" value="Gemini 3.1" />
              <Stat label="Research" value="Sonar" />
            </dl>
          </div>

          {/* Auth card column */}
          <div className="mx-auto w-full max-w-sm">
            <div className="surface p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_30px_60px_-20px_rgba(15,23,42,0.10)]">
              <div className="mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
                  Sign in
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  Access your scouts
                </h2>
                <p className="mt-1.5 text-[13px] text-[color:var(--color-ink-muted)]">
                  Authenticate with a connected provider to continue.
                </p>
              </div>

              <LoginCard initialError={error} next={next} />

              <p className="mt-6 text-[11px] leading-relaxed text-[color:var(--color-ink-subtle)]">
                By continuing you agree to allow Patent Scout to read your basic
                profile from the OAuth provider for authentication only.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between px-1 text-[11px] text-[color:var(--color-ink-subtle)]">
              <span className="mono">v0.1.0</span>
              <span>Need access? Contact your administrator.</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium tracking-tight text-[color:var(--color-ink)]">
        {value}
      </dd>
    </div>
  );
}
