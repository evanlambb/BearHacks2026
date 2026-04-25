/** Display helpers used across dossier components. */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatRevenue(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return USD.format(value);
}

const DATE_LONG = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_LONG.format(d);
}

export function formatMonthYear(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_MONTH_YEAR.format(d);
}

/**
 * Render styles for patent timeline events. We use explicit literal Tailwind
 * classes (so the JIT scanner picks them up) AND hex values for SVG fills
 * (which can't be computed at runtime via class strings).
 */
export const EVENT_STYLES: Record<
  string,
  { hex: string; bg: string; ring: string; label: string }
> = {
  COMPOSITION_OF_MATTER: {
    hex: "#f43f5e", // rose-500
    bg: "bg-rose-500",
    ring: "ring-rose-500/30",
    label: "Composition-of-matter",
  },
  METHOD_OF_USE: {
    hex: "#f59e0b", // amber-500
    bg: "bg-amber-500",
    ring: "ring-amber-500/30",
    label: "Method-of-use",
  },
  FORMULATION: {
    hex: "#8b5cf6", // violet-500
    bg: "bg-violet-500",
    ring: "ring-violet-500/30",
    label: "Formulation",
  },
  PEDIATRIC_EXTENSION: {
    hex: "#fb923c", // orange-400
    bg: "bg-orange-400",
    ring: "ring-orange-400/30",
    label: "Pediatric +6 mo",
  },
  EXCLUSIVITY: {
    hex: "#0ea5e9", // sky-500
    bg: "bg-sky-500",
    ring: "ring-sky-500/30",
    label: "Exclusivity",
  },
  PROJECTED_GENERIC_LAUNCH: {
    hex: "#2dd4bf", // teal-400
    bg: "bg-teal-400",
    ring: "ring-teal-400/40",
    label: "Projected generic launch",
  },
};

export const SOURCE_LABEL: Record<string, string> = {
  FDA_ORANGE_BOOK: "FDA Orange Book",
  SEC_10K: "SEC 10-K",
  PATENT: "Patent",
  FDA_LABEL: "FDA Label",
  OTHER: "Source",
};
