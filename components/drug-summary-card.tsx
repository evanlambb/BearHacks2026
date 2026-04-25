"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DrugSummary } from "@/lib/schema";
import { formatRevenue } from "@/lib/format";
import { CitationLink } from "./citation-link";
import { Pill } from "lucide-react";

export function DrugSummaryCard({
  summary,
  loading,
}: {
  summary?: DrugSummary;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm transition-all duration-500 animate-in fade-in slide-in-from-bottom-3">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Pill className="size-3.5" />
          <span>§1 Drug & Mechanism Summary</span>
        </div>
        {loading || !summary ? (
          <Skeleton className="mt-2 h-7 w-2/3" />
        ) : (
          <CardTitle className="mt-2 text-2xl font-semibold tracking-tight">
            {summary.name}
          </CardTitle>
        )}
        {loading || !summary ? (
          <Skeleton className="mt-1 h-4 w-1/3" />
        ) : (
          <CardDescription className="text-sm">
            {summary.originator}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* Mechanism of action */}
        <Section label="Mechanism of action">
          {loading || !summary ? (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-4/5" />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">
              {summary.mechanismOfAction}
            </p>
          )}
        </Section>

        {/* Indications */}
        <Section label="Approved indications (US)">
          {loading || !summary ? (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-3/4" />
            </>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-foreground/90">
              {summary.indications.map((ind, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{ind}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Revenue stat */}
        <Section label="Annual product revenue">
          {loading || !summary ? (
            <Skeleton className="h-9 w-1/3" />
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatRevenue(summary.annualRevenueUSD)}
              </span>
              {summary.revenueYear ? (
                <span className="text-sm text-muted-foreground">
                  FY {summary.revenueYear}
                </span>
              ) : null}
              <CitationLink id={summary.revenueCitationId} />
            </div>
          )}
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </h3>
      {children}
    </div>
  );
}
