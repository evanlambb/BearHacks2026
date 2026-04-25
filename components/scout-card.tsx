"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScoutCardData = {
  id: string;
  title: string;
  scope: string;
  status: "completed" | "in_progress" | "no_hits";
  hits: number;
  hero?: string;
  updated: string;
};

export function ScoutCard({ scout }: { scout: ScoutCardData }) {
  const StatusIcon =
    scout.status === "in_progress" ? Loader2 : scout.status === "no_hits" ? Search : null;
  const statusLabel =
    scout.status === "completed"
      ? `${scout.hits} hit${scout.hits === 1 ? "" : "s"}`
      : scout.status === "in_progress"
      ? "Scanning..."
      : "0 hits";
  const statusColor =
    scout.status === "completed"
      ? "border-primary/40 bg-primary/10 text-primary"
      : scout.status === "in_progress"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : "border-border/60 bg-muted/30 text-muted-foreground";

  const isClickable = scout.status === "completed";
  const Wrapper = isClickable ? Link : "div";
  const wrapperProps = isClickable ? { href: `/scouts/${scout.id}` } : {};

  return (
    <Wrapper {...(wrapperProps as { href: string })} className="group block">
      <Card
        className={cn(
          "h-full border-border/60 bg-card/40 backdrop-blur-sm transition-all",
          isClickable && "hover:border-primary/40 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5"
        )}
      >
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="outline"
              className={cn("gap-1.5 border", statusColor)}
            >
              {StatusIcon ? (
                <StatusIcon
                  className={cn(
                    "size-3",
                    scout.status === "in_progress" && "animate-spin"
                  )}
                />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
              {statusLabel}
            </Badge>
            {isClickable ? (
              <ArrowUpRight className="size-4 text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {scout.title}
            </h3>
            <p className="text-xs text-muted-foreground">{scout.scope}</p>
          </div>
          {scout.hero ? (
            <p className="mt-auto pt-2 text-xs text-foreground/80">
              <span className="text-muted-foreground">Top result · </span>
              {scout.hero}
            </p>
          ) : (
            <p className="mt-auto pt-2 text-xs text-muted-foreground italic">
              No assets matched the filter.
            </p>
          )}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Updated {scout.updated}
          </p>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
