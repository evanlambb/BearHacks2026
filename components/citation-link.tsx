"use client";

import { cn } from "@/lib/utils";

export function CitationLink({
  id,
  className,
}: {
  id: number | null | undefined;
  className?: string;
}) {
  if (id === null || id === undefined) return null;
  return (
    <a
      href={`#citation-${id}`}
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary/15 px-1 text-[10px] font-semibold text-primary align-super",
        "no-underline hover:bg-primary/30 transition-colors",
        className
      )}
      aria-label={`Citation ${id}`}
    >
      [{id}]
    </a>
  );
}
