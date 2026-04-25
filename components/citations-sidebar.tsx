"use client";

import type { Citation } from "@/lib/schema";
import { SOURCE_LABEL } from "@/lib/format";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function CitationsSidebar({
  citations,
  loading,
}: {
  citations: Citation[];
  loading?: boolean;
}) {
  return (
    <aside className="sticky top-6 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Citations
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {citations.length} source{citations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {citations.map((c) => (
          <a
            id={`citation-${c.id}`}
            key={c.id}
            href={c.url ?? "#"}
            target={c.url ? "_blank" : undefined}
            rel={c.url ? "noopener noreferrer" : undefined}
            className="group rounded-md border border-border/60 bg-card/50 p-3 text-xs transition-colors hover:border-primary/40 hover:bg-card"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-[10px] font-semibold text-primary">
                {c.id}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {SOURCE_LABEL[c.source] ?? c.source}
              </span>
              {c.url ? (
                <ExternalLink className="ml-auto size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </div>
            <p className="mt-1.5 leading-relaxed text-foreground/85">
              {c.reference}
            </p>
          </a>
        ))}

        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className="rounded-md border border-border/40 bg-card/30 p-3"
              >
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-4/5" />
              </div>
            ))
          : null}

        {!loading && citations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Citations will appear here as the dossier is built.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
