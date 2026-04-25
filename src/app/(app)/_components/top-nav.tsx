"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scouts", label: "Scouts" },
];

export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const onDashboard = pathname === "/dashboard";

  return (
    <div className="flex flex-1 items-center justify-between">
      <nav className="flex items-center gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative inline-flex h-8 items-center rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors",
                active
                  ? "text-[color:var(--color-ink)]"
                  : "text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]",
              )}
            >
              {item.label}
              {active ? (
                <span className="absolute inset-x-3 -bottom-[15px] h-px bg-[color:var(--color-ink)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        {onDashboard ? (
          <Link href="/create-scout" className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" />
            Create Scout
          </Link>
        ) : null}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            className="btn btn-ghost gap-2 pl-1 pr-2"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar email={email} />
            <span className="hidden text-[13px] text-[color:var(--color-ink)] sm:inline">
              {email}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[color:var(--color-ink-subtle)]" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] shadow-[0_20px_40px_-15px_rgba(15,23,42,0.18)]"
            >
              <div className="border-b border-[color:var(--color-border)] px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
                  Signed in as
                </div>
                <div className="mt-0.5 truncate text-[13px] text-[color:var(--color-ink)]">
                  {email}
                </div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Avatar({ email }: { email: string }) {
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--color-accent-muted)] text-[11px] font-semibold text-[color:var(--color-accent)]">
      {initial}
    </span>
  );
}
