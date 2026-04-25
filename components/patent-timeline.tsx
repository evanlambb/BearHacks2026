"use client";

import type { PatentTimeline } from "@/lib/schema";
import { EVENT_STYLES, formatDate, formatMonthYear } from "@/lib/format";
import { CitationLink } from "./citation-link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const PADDING = { left: 24, right: 24, top: 60, bottom: 56 };
const HEIGHT = 220;

export function PatentTimelineChart({
  timeline,
  loading,
}: {
  timeline?: PatentTimeline;
  loading?: boolean;
}) {
  if (loading || !timeline) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  const events = [...timeline.events].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No patent events to display.
      </p>
    );
  }

  // Domain: extend slightly past the last event for breathing room.
  const minDate = new Date(events[0].date).getTime();
  const maxDate = new Date(events[events.length - 1].date).getTime();
  const domainPad = Math.max((maxDate - minDate) * 0.05, 30 * 24 * 3600 * 1000);
  const domainStart = minDate - domainPad;
  const domainEnd = maxDate + domainPad;

  const today = Date.now();
  const todayInRange = today >= domainStart && today <= domainEnd;

  // We use a viewBox so the SVG scales fluidly with container width.
  const VIEW_W = 1000;
  const innerW = VIEW_W - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (iso: string) => {
    const t = new Date(iso).getTime();
    return PADDING.left + ((t - domainStart) / (domainEnd - domainStart)) * innerW;
  };
  const xForMs = (ms: number) =>
    PADDING.left + ((ms - domainStart) / (domainEnd - domainStart)) * innerW;

  const loeStartX = xFor(timeline.loeWindowStart);
  const loeEndX = xFor(timeline.loeWindowEnd);

  // Build year tick positions across the domain.
  const startYear = new Date(domainStart).getUTCFullYear();
  const endYear = new Date(domainEnd).getUTCFullYear();
  const yearTicks: { year: number; x: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const x = xForMs(Date.UTC(y, 0, 1));
    if (x >= PADDING.left && x <= VIEW_W - PADDING.right) {
      yearTicks.push({ year: y, x });
    }
  }

  // Stagger vertical positions so labels don't overlap when events cluster.
  const baselineY = PADDING.top + innerH / 2;
  const labelOffsets = stripeOffsets(events.length);

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${VIEW_W} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Patent cliff timeline"
      >
        {/* LoE window shaded band */}
        <rect
          x={loeStartX}
          y={PADDING.top - 8}
          width={Math.max(loeEndX - loeStartX, 2)}
          height={innerH + 16}
          className="fill-primary/10"
          rx={4}
        />

        {/* Baseline */}
        <line
          x1={PADDING.left}
          x2={VIEW_W - PADDING.right}
          y1={baselineY}
          y2={baselineY}
          className="stroke-border"
          strokeWidth={1}
        />

        {/* Year ticks */}
        {yearTicks.map((t) => (
          <g key={t.year}>
            <line
              x1={t.x}
              x2={t.x}
              y1={baselineY - 4}
              y2={baselineY + 4}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={t.x}
              y={HEIGHT - 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {t.year}
            </text>
          </g>
        ))}

        {/* Today marker */}
        {todayInRange ? (
          <g>
            <line
              x1={xForMs(today)}
              x2={xForMs(today)}
              y1={PADDING.top - 4}
              y2={baselineY + 8}
              className="stroke-foreground/40"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={xForMs(today)}
              y={PADDING.top - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] uppercase tracking-wider"
            >
              today
            </text>
          </g>
        ) : null}

        {/* Events */}
        {events.map((ev, i) => {
          const x = xFor(ev.date);
          const above = labelOffsets[i] < 0;
          const labelY = baselineY + labelOffsets[i] * 14;
          const style = EVENT_STYLES[ev.type] ?? {
            hex: "#a1a1aa",
            bg: "bg-foreground",
            ring: "ring-foreground/30",
            label: ev.type,
          };
          return (
            <g key={`${ev.type}-${ev.date}-${i}`}>
              {/* Connector line from baseline to label */}
              <line
                x1={x}
                x2={x}
                y1={baselineY}
                y2={labelY + (above ? 6 : -6)}
                className="stroke-border"
                strokeWidth={1}
              />
              {/* Marker dot */}
              <circle
                cx={x}
                cy={baselineY}
                r={5}
                fill={style.hex}
                className="stroke-background"
                strokeWidth={2}
              />
              {/* Date label */}
              <text
                x={x}
                y={labelY + (above ? 0 : 4)}
                textAnchor="middle"
                className="fill-foreground/90 text-[10px] tabular-nums"
              >
                {formatMonthYear(ev.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend + event list below the chart */}
      <ol className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        {events.map((ev, i) => {
          const style = EVENT_STYLES[ev.type];
          return (
            <li
              key={`${ev.date}-${i}`}
              className="flex items-start gap-2 rounded-sm px-1 py-0.5"
            >
              <span
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full ring-2",
                  style?.bg ?? "bg-foreground",
                  style?.ring ?? "ring-foreground/20"
                )}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-foreground">{ev.label}</span>
                  <CitationLink id={ev.citationId} />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">{formatDate(ev.date)}</span>
                  {ev.notes ? (
                    <span className="truncate" title={ev.notes}>
                      · {ev.notes}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/**
 * Returns a series of -2..+2 multipliers so that labels above/below the
 * baseline stagger and avoid overlapping when events cluster.
 */
function stripeOffsets(n: number): number[] {
  const stripes = [-2, 2, -1, 1];
  return Array.from({ length: n }, (_, i) => stripes[i % stripes.length]);
}
