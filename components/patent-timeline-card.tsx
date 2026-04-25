"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PatentTimeline } from "@/lib/schema";
import { PatentTimelineChart } from "./patent-timeline";
import { formatDate } from "@/lib/format";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PatentTimelineCard({
  timeline,
  loading,
}: {
  timeline?: PatentTimeline;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm transition-all duration-500 animate-in fade-in slide-in-from-bottom-3">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>§2 Patent Cliff Timeline</span>
        </div>
        <CardTitle className="mt-2 text-lg font-semibold tracking-tight">
          Loss-of-exclusivity outlook
        </CardTitle>
        {loading || !timeline ? (
          <Skeleton className="mt-1 h-4 w-1/2" />
        ) : (
          <CardDescription className="text-sm">
            <span className="tabular-nums">
              {formatDate(timeline.loeWindowStart)}
            </span>
            <span className="mx-2 text-muted-foreground">→</span>
            <span className="tabular-nums text-foreground">
              {formatDate(timeline.loeWindowEnd)}
            </span>
            <span className="ml-2 text-muted-foreground">
              projected generic launch
            </span>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="grid gap-6">
        <PatentTimelineChart timeline={timeline} loading={loading} />

        {!loading && timeline ? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4">
            <h4 className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Analyst note
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {timeline.narrative}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-5/6" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
