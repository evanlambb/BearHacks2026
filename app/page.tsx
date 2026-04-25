import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoutCard, type ScoutCardData } from "@/components/scout-card";

const SCOUTS: ScoutCardData[] = [
  {
    id: "demo",
    title: "Oncology Small Molecules — US 2027–2029",
    scope: "Small molecule · United States · LoE 2027-01 to 2029-12",
    status: "completed",
    hits: 1,
    hero: "Ibrance (palbociclib), Pfizer · LoE Mar 2029",
    updated: "moments ago",
  },
  {
    id: "cardio",
    title: "Cardiovascular Biologics — EU 2026–2028",
    scope: "Biologic · European Union · LoE 2026-01 to 2028-12",
    status: "in_progress",
    hits: 0,
    updated: "2 min ago",
  },
  {
    id: "glp1",
    title: "GLP-1 Analogs — Global 2028+",
    scope: "Peptide · Worldwide · LoE 2028-01 onwards",
    status: "no_hits",
    hits: 0,
    updated: "1 hr ago",
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Pharma Scout
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Welcome, Sarah</span>
          <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground/80">
            SC
          </div>
        </div>
      </header>

      {/* Hero / page header */}
      <section className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Scout dashboard
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Active scouts
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Autonomous patent-cliff scouts run continuously across the FDA
              Orange Book and surface qualifying assets as opportunity dossiers.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href="/scouts/new">
              <Plus className="size-4" />
              Deploy New Scout
            </Link>
          </Button>
        </div>
      </section>

      {/* Scout grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCOUTS.map((scout) => (
          <ScoutCard key={scout.id} scout={scout} />
        ))}
      </section>

      {/* Footer hint */}
      <p className="mt-auto text-center text-xs text-muted-foreground">
        Click the completed Oncology scout to view its dossier, or deploy a new
        scout to see the live pipeline.
      </p>
    </div>
  );
}
