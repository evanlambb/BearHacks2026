"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { createScout, type CreateScoutInput } from "./actions";

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Switzerland",
  "Japan",
  "China",
  "South Korea",
  "India",
  "Brazil",
  "Mexico",
  "Australia",
] as const;

type SignalType = "patent_expiry" | "non_filed_region";

type FieldErrors = Partial<{
  countries: string;
  therapeutic_area: string;
  modality: string;
  expiry_time_horizon_months: string;
  non_filed_lookback_years: string;
  capex: string;
  market_floor_usd: string;
  minimum_unit_volume: string;
}>;

function parseNumber(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function CreateScoutForm() {
  const [name, setName] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [therapeuticArea, setTherapeuticArea] = useState("");
  const [signalType, setSignalType] = useState<SignalType>("patent_expiry");
  const [expiryMonths, setExpiryMonths] = useState("");
  const [lookbackYears, setLookbackYears] = useState("");
  const [modality, setModality] = useState("");
  const [marketFloor, setMarketFloor] = useState("");
  const [minUnits, setMinUnits] = useState("");
  const [capexMin, setCapexMin] = useState("");
  const [capexMax, setCapexMax] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {};
    if (countries.length === 0) e.countries = "Select at least one country.";
    if (!therapeuticArea.trim())
      e.therapeutic_area = "Therapeutic area is required.";
    if (!modality.trim()) e.modality = "Modality is required.";

    if (signalType === "patent_expiry") {
      const v = parseNumber(expiryMonths);
      if (v == null || Number.isNaN(v) || !Number.isInteger(v) || v <= 0) {
        e.expiry_time_horizon_months =
          "Provide a positive whole number of months.";
      }
    } else {
      const v = parseNumber(lookbackYears);
      if (v == null || Number.isNaN(v) || !Number.isInteger(v) || v <= 0) {
        e.non_filed_lookback_years =
          "Provide a positive whole number of years.";
      }
    }

    const mf = parseNumber(marketFloor);
    if (mf != null && (Number.isNaN(mf) || mf < 0))
      e.market_floor_usd = "Must be a non-negative number.";

    const mu = parseNumber(minUnits);
    if (mu != null && (Number.isNaN(mu) || mu < 0 || !Number.isInteger(mu)))
      e.minimum_unit_volume = "Must be a non-negative whole number.";

    const cmin = parseNumber(capexMin);
    const cmax = parseNumber(capexMax);
    if (cmin != null && (Number.isNaN(cmin) || cmin < 0))
      e.capex = "Capex min must be a non-negative number.";
    if (cmax != null && (Number.isNaN(cmax) || cmax < 0))
      e.capex = "Capex max must be a non-negative number.";
    if (
      cmin != null &&
      cmax != null &&
      !Number.isNaN(cmin) &&
      !Number.isNaN(cmax) &&
      cmax < cmin
    ) {
      e.capex = "Capex max must be greater than or equal to capex min.";
    }

    return e;
  }, [
    countries,
    therapeuticArea,
    modality,
    signalType,
    expiryMonths,
    lookbackYears,
    marketFloor,
    minUnits,
    capexMin,
    capexMax,
  ]);

  const isValid = Object.keys(errors).length === 0;
  const signalLabel =
    signalType === "patent_expiry" ? "Patent Expiry" : "Non-Filed Region";

  function toggleCountry(country: string) {
    setCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country],
    );
    setTouched((t) => ({ ...t, countries: true }));
  }

  function showError(field: keyof FieldErrors): string | undefined {
    if (!touched[field]) return undefined;
    return errors[field];
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setTouched({
      countries: true,
      therapeutic_area: true,
      modality: true,
      expiry_time_horizon_months: true,
      non_filed_lookback_years: true,
      capex: true,
      market_floor_usd: true,
      minimum_unit_volume: true,
    });
    if (!isValid) return;

    const input: CreateScoutInput = {
      name: name.trim() || null,
      countries,
      therapeutic_area: therapeuticArea.trim(),
      patent_signal_type: signalType,
      expiry_time_horizon_months:
        signalType === "patent_expiry"
          ? Number(parseNumber(expiryMonths))
          : null,
      non_filed_lookback_years:
        signalType === "non_filed_region"
          ? Number(parseNumber(lookbackYears))
          : null,
      modality: modality.trim(),
      market_floor_usd: parseNumber(marketFloor),
      minimum_unit_volume: parseNumber(minUnits),
      capex_min_usd: parseNumber(capexMin),
      capex_max_usd: parseNumber(capexMax),
    };

    startTransition(async () => {
      try {
        const result = await createScout(input);
        // On success the action redirects via Next, so this is only reached on error.
        if (result && !result.ok) setServerError(result.error);
      } catch (err) {
        // NEXT_REDIRECT throws by design — let Next handle it.
        if (
          err instanceof Error &&
          (err.message === "NEXT_REDIRECT" ||
            err.message.startsWith("NEXT_REDIRECT"))
        ) {
          return;
        }
        setServerError(
          err instanceof Error ? err.message : "Failed to create scout.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="create-scout-form"
      className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]"
      noValidate
    >
      <div className="space-y-8">
        {/* ─────────────── Name (optional) ─────────────── */}
        <Section
          title="Identifier"
          description="An optional label to help you recognise this scout in lists and reports."
        >
          <Field label="Name" hint="Optional">
            <input
              type="text"
              data-testid="scout-name"
              className="input"
              placeholder="e.g. NSCLC expiry watch — US/EU"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </Section>

        {/* ─────────────── Geography ─────────────── */}
        <Section
          title="Geography"
          description="Jurisdictions to scout. We ingest WIPO + EPO filings for each selected country."
        >
        <Field
          label="Countries"
          required
          error={showError("countries")}
        >
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
            data-testid="scout-countries"
          >
            {COUNTRIES.map((c) => {
              const active = countries.includes(c);
              return (
                <label
                  key={c}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-[13px] transition-colors",
                    active
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-ink)]"
                      : "border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-muted)]",
                  )}
                >
                  <input
                    type="checkbox"
                    data-testid={`country-${c}`}
                    className="h-3.5 w-3.5 accent-[color:var(--color-accent)]"
                    checked={active}
                    onChange={() => toggleCountry(c)}
                  />
                  <span>{c}</span>
                </label>
              );
            })}
          </div>
        </Field>
        </Section>

        {/* ─────────────── Thesis ─────────────── */}
        <Section
        title="Thesis"
        description="Define the therapeutic area and modality that the scout should target."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Therapeutic area"
            required
            error={showError("therapeutic_area")}
          >
            <input
              type="text"
              data-testid="scout-therapeutic-area"
              className="input"
              placeholder="e.g. NSCLC, multiple sclerosis, solid tumors, diabetes"
              value={therapeuticArea}
              onChange={(e) => setTherapeuticArea(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, therapeutic_area: true }))
              }
            />
          </Field>
          <Field label="Modality" required error={showError("modality")}>
            <input
              type="text"
              data-testid="scout-modality"
              className="input"
              placeholder="e.g. small molecule, monoclonal antibody, peptide, mRNA, siRNA"
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, modality: true }))}
            />
          </Field>
        </div>
        </Section>

        {/* ─────────────── Patent signal ─────────────── */}
        <Section
        title="Patent signal"
        description="Select the type of opportunity the scout should surface."
      >
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          data-testid="scout-signal-type"
          role="radiogroup"
          aria-label="Patent signal type"
        >
          <SignalCard
            active={signalType === "patent_expiry"}
            title="Patent expiry"
            description="Surface molecules whose primary patent expires inside the chosen window."
            onClick={() => setSignalType("patent_expiry")}
            testId="signal-patent-expiry"
          />
          <SignalCard
            active={signalType === "non_filed_region"}
            title="Patent in non-filed region"
            description="Surface molecules patented elsewhere but never filed in the selected jurisdictions."
            onClick={() => setSignalType("non_filed_region")}
            testId="signal-non-filed-region"
          />
        </div>

        <div className="mt-5">
          {signalType === "patent_expiry" ? (
            <Field
              label="Expiry time horizon (months)"
              required
              error={showError("expiry_time_horizon_months")}
              hint="Common values: 12, 24, 36, 60"
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                data-testid="scout-expiry-months"
                className="input max-w-xs"
                placeholder="24"
                value={expiryMonths}
                onChange={(e) => setExpiryMonths(e.target.value)}
                onBlur={() =>
                  setTouched((t) => ({
                    ...t,
                    expiry_time_horizon_months: true,
                  }))
                }
              />
            </Field>
          ) : (
            <Field
              label="Lookback (years)"
              required
              error={showError("non_filed_lookback_years")}
              hint="Common values: 3, 5, 10, 15"
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                data-testid="scout-lookback-years"
                className="input max-w-xs"
                placeholder="5"
                value={lookbackYears}
                onChange={(e) => setLookbackYears(e.target.value)}
                onBlur={() =>
                  setTouched((t) => ({ ...t, non_filed_lookback_years: true }))
                }
              />
            </Field>
          )}
        </div>
        </Section>

        {/* ─────────────── Market floor ─────────────── */}
        <Section
        title="Market floor"
        description="Optional minimum addressable market across the selected jurisdictions."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Minimum addressable market (USD)"
            error={showError("market_floor_usd")}
            hint="Optional"
          >
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              data-testid="scout-market-floor"
              className="input"
              placeholder="e.g. 50000000"
              value={marketFloor}
              onChange={(e) => setMarketFloor(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, market_floor_usd: true }))
              }
            />
          </Field>
          <Field
            label="Minimum unit volume"
            error={showError("minimum_unit_volume")}
            hint="Optional"
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              data-testid="scout-min-units"
              className="input"
              placeholder="e.g. 250000"
              value={minUnits}
              onChange={(e) => setMinUnits(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, minimum_unit_volume: true }))
              }
            />
          </Field>
        </div>
        </Section>

        {/* ─────────────── Capex ─────────────── */}
        <Section
        title="Capex range"
        description="Optional range of capital expenditure you're willing to deploy."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Capex min (USD)" hint="Optional">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              data-testid="scout-capex-min"
              className="input"
              placeholder="e.g. 5000000"
              value={capexMin}
              onChange={(e) => setCapexMin(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, capex: true }))}
            />
          </Field>
          <Field label="Capex max (USD)" hint="Optional">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              data-testid="scout-capex-max"
              className="input"
              placeholder="e.g. 50000000"
              value={capexMax}
              onChange={(e) => setCapexMax(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, capex: true }))}
            />
          </Field>
        </div>
        {touched.capex && errors.capex ? (
          <p className="mt-2 text-[12px] text-[color:var(--color-danger)]">
            {errors.capex}
          </p>
        ) : null}
        </Section>

        {/* ─────────────── Footer ─────────────── */}
        {serverError ? (
          <div
            role="alert"
            data-testid="scout-form-error"
            className="rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-muted)] px-3 py-2 text-[12px] text-[color:var(--color-danger)]"
          >
            {serverError}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-[color:var(--color-border)] pt-6">
          <Link
            href="/dashboard"
            data-testid="scout-cancel"
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button
            type="submit"
            data-testid="scout-submit"
            disabled={pending}
            aria-busy={pending}
            className="btn btn-primary"
          >
            {pending ? "Creating…" : "Create Scout"}
          </button>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="surface p-5">
          <div className="text-[24px] font-semibold tracking-tight">Scout Summary</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="pill bg-[color:var(--color-surface-muted)]">Patent Signal</span>
            <span className="pill bg-[color:var(--color-surface-muted)]">{signalLabel}</span>
            <span className="pill bg-[color:var(--color-surface-muted)]">{countries.length} countries</span>
            {modality.trim() ? (
              <span className="pill bg-[color:var(--color-surface-muted)]">{modality.trim()}</span>
            ) : null}
          </div>
          <div className="mt-5 space-y-3 text-[13px] text-[color:var(--color-ink-muted)]">
            <p>Search WIPO and EPO every 6 hours.</p>
            <p>Filter candidates with Gemini.</p>
            <p>Generate evidence-backed reports.</p>
            <p>Create downloadable PDF output.</p>
          </div>
          <p className="mt-5 text-[12px] text-[color:var(--color-ink-subtle)]">
            This scout runs automatically until paused or deleted.
          </p>
        </div>
      </aside>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Small layout primitives                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 border-b border-[color:var(--color-border)] pb-8 lg:grid-cols-[260px_1fr]">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight text-[color:var(--color-ink)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label !mb-0">
          {label}
          {required ? (
            <span className="ml-1 text-[color:var(--color-danger)]">*</span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-ink-subtle)]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p
          role="alert"
          className="mt-1.5 text-[12px] text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SignalCard({
  active,
  title,
  description,
  onClick,
  testId,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      data-testid={testId}
      className={cn(
        "flex w-full flex-col gap-1 rounded-[var(--radius-md)] border p-4 text-left transition-colors",
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)]"
          : "border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-muted)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-3.5 w-3.5 place-items-center rounded-full border",
            active
              ? "border-[color:var(--color-accent)]"
              : "border-[color:var(--color-border-strong)]",
          )}
        >
          {active ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent)]" />
          ) : null}
        </span>
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      <p className="pl-5 text-[12px] leading-relaxed text-[color:var(--color-ink-muted)]">
        {description}
      </p>
    </button>
  );
}
