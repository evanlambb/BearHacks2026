"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DrugSummaryCard } from "@/components/drug-summary-card";
import { PatentTimelineCard } from "@/components/patent-timeline-card";
import { CitationsSidebar } from "@/components/citations-sidebar";
import type {
  Citation,
  DrugSummary,
  PatentTimeline,
  ScoutFilter,
  TriageResponse,
} from "@/lib/schema";
import { formatDate } from "@/lib/format";

const FILTER_STORAGE_KEY = "pharma-scout:filter";

const DEFAULT_FILTER: ScoutFilter = {
  therapeuticArea: "Oncology",
  moleculeType: "Small Molecule",
  loeWindowStart: "2027-01-01",
  loeWindowEnd: "2029-12-31",
  region: "United States",
};

type Stage = "triage" | "summary" | "timeline" | "done";

/**
 * Sequential fetch pipeline:
 *   1. POST /api/scout/triage   -> picks the asset
 *   2. POST /api/scout/summary  -> renders §1 drug summary card
 *   3. POST /api/scout/timeline -> renders §2 patent cliff timeline
 * Each section appears as soon as its data lands ("section-by-section reveal").
 */
export default function DossierPage() {
  const [stage, setStage] = useState<Stage>("triage");
  const [triage, setTriage] = useState<TriageResponse | null>(null);
  const [summary, setSummary] = useState<DrugSummary | null>(null);
  const [timeline, setTimeline] = useState<PatentTimeline | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const filter = readFilter();

        // Stage 1: triage
        setStage("triage");
        const triageRes = await postJSON<TriageResponse>(
          "/api/scout/triage",
          { filter }
        );
        if (cancelled) return;
        setTriage(triageRes);

        // Stage 2: summary (depends on triage's chosen ndaNumber)
        setStage("summary");
        const summaryRes = await postJSON<{
          drugSummary: DrugSummary;
          citations: Citation[];
        }>("/api/scout/summary", { ndaNumber: triageRes.ndaNumber });
        if (cancelled) return;
        setSummary(summaryRes.drugSummary);
        setCitations((prev) => mergeCitations(prev, summaryRes.citations));

        // Stage 3: timeline (re-key its citation ids so they never collide
        // with the summary's even when the live pipeline numbers from 1).
        setStage("timeline");
        const timelineRes = await postJSON<{
          patentTimeline: PatentTimeline;
          citations: Citation[];
        }>("/api/scout/timeline", { ndaNumber: triageRes.ndaNumber });
        if (cancelled) return;
        const { timeline: rekeyedTimeline, citations: rekeyedCitations } =
          rekeyTimeline(timelineRes.patentTimeline, timelineRes.citations, summaryRes.citations);
        setTimeline(rekeyedTimeline);
        setCitations((prev) => mergeCitations(prev, rekeyedCitations));

        setStage("done");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[dossier]", message);
        setError(message);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterBadge = describeFilter(readFilterSafely());

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to scouts
        </Link>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {stage !== "done" && !error ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <Sparkles className="size-3.5 text-primary" />
          )}
          <span>{stageLabel(stage, error)}</span>
        </div>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-primary/40 text-primary">
            {filterBadge}
          </Badge>
        </div>
        {summary ? (
          <h1 className="text-4xl font-semibold tracking-tight">
            {summary.name}
          </h1>
        ) : (
          <Skeleton className="h-10 w-2/3 max-w-md" />
        )}
        {summary && timeline ? (
          <p className="text-muted-foreground max-w-2xl">
            {summary.originator} ·{" "}
            <span className="text-foreground/80">
              Projected generic launch{" "}
              <span className="tabular-nums">
                {formatDate(timeline.loeWindowEnd)}
              </span>
            </span>
          </p>
        ) : (
          <Skeleton className="h-4 w-1/2 max-w-sm" />
        )}
      </header>

      <Separator className="bg-border/60" />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          <strong className="font-semibold">Pipeline error:</strong> {error}
        </div>
      ) : null}

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <main className="flex flex-col gap-6 min-w-0">
          <DrugSummaryCard
            summary={summary ?? undefined}
            loading={!summary}
          />
          <PatentTimelineCard
            timeline={timeline ?? undefined}
            loading={!timeline}
          />
        </main>
        <CitationsSidebar
          citations={citations}
          loading={stage !== "done" && !error}
        />
      </div>
    </div>
  );
}

// ---------- helpers ----------

function readFilter(): ScoutFilter {
  return readFilterSafely() ?? DEFAULT_FILTER;
}

function readFilterSafely(): ScoutFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScoutFilter;
  } catch {
    return null;
  }
}

function describeFilter(f: ScoutFilter | null): string {
  const filter = f ?? DEFAULT_FILTER;
  const startYear = filter.loeWindowStart.slice(0, 4);
  const endYear = filter.loeWindowEnd.slice(0, 4);
  return `${filter.therapeuticArea} · ${filter.moleculeType} · LoE ${startYear}–${endYear}`;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${url} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Merge by id, last-write-wins (won't dup the same id twice in the sidebar). */
function mergeCitations(prev: Citation[], next: Citation[]): Citation[] {
  const map = new Map<number, Citation>();
  for (const c of prev) map.set(c.id, c);
  for (const c of next) map.set(c.id, c);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

/**
 * Re-keys the timeline section's citation ids so they sit above whatever the
 * summary section already used. In DEMO_MODE the golden cache uses 1-3 for
 * summary and 4-7 for timeline so this is effectively a no-op; in live mode
 * each route returns ids starting at 1 and we need an offset.
 */
function rekeyTimeline(
  tl: PatentTimeline,
  tlCitations: Citation[],
  summaryCitations: Citation[]
): { timeline: PatentTimeline; citations: Citation[] } {
  const usedIds = new Set(summaryCitations.map((c) => c.id));
  // If there's no overlap, pass through unchanged (preserves the curated 4-7
  // ids from the golden cache).
  const hasCollision = tlCitations.some((c) => usedIds.has(c.id));
  if (!hasCollision) return { timeline: tl, citations: tlCitations };

  const offset = (summaryCitations.reduce((m, c) => Math.max(m, c.id), 0)) || 0;
  const rekeyedCitations = tlCitations.map((c) => ({ ...c, id: c.id + offset }));
  const rekeyedEvents = tl.events.map((e) => ({
    ...e,
    citationId: e.citationId + offset,
  }));
  return {
    timeline: { ...tl, events: rekeyedEvents },
    citations: rekeyedCitations,
  };
}

function stageLabel(stage: Stage, error: string | null): string {
  if (error) return "Pipeline failed";
  switch (stage) {
    case "triage":
      return "Selecting target asset…";
    case "summary":
      return "Synthesizing drug summary…";
    case "timeline":
      return "Building patent cliff timeline…";
    case "done":
      return "Generated by Pharma Scout";
  }
}
