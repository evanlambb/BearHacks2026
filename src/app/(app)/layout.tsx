import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { TopNav } from "./_components/top-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  const email = user.email ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-bg)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center gap-6 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-accent)]" />
            <span className="text-[14px] font-semibold tracking-tight">
              Patent Scout
            </span>
            <span className="kbd ml-1">beta</span>
          </Link>

          <TopNav email={email} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex h-12 w-full max-w-[1320px] items-center justify-between px-6 text-[11px] text-[color:var(--color-ink-subtle)]">
          <span>Patent Scout · WIPO + EPO ingestion · 6h cadence</span>
          <span className="mono">{user.id.slice(0, 8)}</span>
        </div>
      </footer>
    </div>
  );
}
