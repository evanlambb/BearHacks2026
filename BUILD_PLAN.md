# Pharma Scout — Build Plan (BearHacks 2026)

> **Purpose of this document:** Single source of truth for the build. If the current chat context is lost, a fresh AI session (or a sleep-deprived human) should be able to read this file top-to-bottom and resume work without losing momentum.
>
> **Companion doc:** `plans.md` contains the original strategic framing and pitch defenses. This doc is the *executable* spec.

---

## 0. Project Identity

- **Name:** Pharma Scout (working title)
- **Tagline:** "8 months to 8 seconds — autonomous patent-cliff opportunity scouting for generic pharma BD teams."
- **Hackathon:** BearHacks 2026 (this weekend, 36-hour solo build)
- **Repo:** `c:\Users\Evan\github\BearHacks2026`
- **Builder:** Solo developer

---

## 1. The Demo (What Judges See)

A BD lead at a generic manufacturer wants to find oncology assets losing US exclusivity between 2027 and 2029. They click **"+ New Scout"**, fill a short form, hit **Deploy**, and watch a complete *Opportunity Dossier* on Pfizer's **Ibrance (palbociclib)** stream in live — with every claim cited to the FDA Orange Book or SEC filings.

**The single magic moment:** Form submit → dossier sections animate in top-to-bottom over ~10 seconds, with citations populating a sidebar in real time.

**Pitch one-liner:** *"A BD lead spends 8 months scouring the Orange Book, IQVIA reports, and patent filings to find one viable target. Pharma Scout does it in 8 seconds. Every number cited. Every patent linked."*

---

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hero drug | **Ibrance (palbociclib)** | Pfizer blockbuster (~$5B/yr), US LoE early 2027, active Para IV drama, clean Orange Book footprint, public 10-K revenue. Backup: Revlimid. |
| Persona | BD lead at generic manufacturer | Small-molecule oncology, US, 2027–2029 LoE window |
| LLM provider | **Google Gemini** | Free tier generous, structured output works well |
| Triage model | `gemini-2.0-flash` | Cheap match-or-skip step |
| Synthesis model | `gemini-2.5-pro` | Long-form structured dossier generation |
| Frontend | **Next.js 15 (App Router) + Tailwind + shadcn/ui** | Single deploy, server components, premium look fast |
| Backend | **Next.js API routes (NO FastAPI)** | Solo dev — collapse the stack. Vercel AI SDK handles streaming. |
| LLM SDK | **Vercel AI SDK** with `@ai-sdk/google` | `streamObject` + Zod schemas for typed streaming |
| Charts | Recharts (or hand-rolled SVG) | Patent timeline only |
| Hosting | Vercel | Free, fast, streaming works OOTB |
| Data source | FDA Orange Book zip → parsed once → `data/orange-book.json` static asset | No runtime ETL, no scraping, free |
| Demo safety | `DEMO_MODE=true` env flag → serves cached golden dossier with simulated stream timing | **NON-NEGOTIABLE** — saves the live demo |

---

## 3. Scope — What's IN, What's OUT

### IN — three dossier sections only

1. **§1 Drug & Mechanism Summary** — drug name, mechanism of action, originator, indication(s), current annual revenue with 10-K citation
2. **§2 Patent Cliff Timeline** — horizontal SVG/Recharts timeline showing composition-of-matter expiry, method-of-use patents, pediatric exclusivity bonus (if any), and the projected generic launch window
3. **§3 Citations Sidebar** — sticky right rail. Every claim above gets a `[1]`, `[2]` superscript. Sidebar fills in with FDA Orange Book row IDs, 10-K page references, and patent numbers as the model emits them.

### OUT — explicitly cut for scope (mention in roadmap slide only)

- ❌ FastAPI backend (collapsed into Next.js)
- ❌ CDMO matchmaking section (data hardest to fake credibly)
- ❌ Market sizing section (IQVIA paywall problem; defer)
- ❌ Composite risk score (judges will probe the formula)
- ❌ IP landscape / Para IV detail section
- ❌ Competitive generics pipeline section
- ❌ Real auth / multi-user (hardcode "Welcome, Sarah")
- ❌ Real database (dashboard list = static array)
- ❌ Setup form actually filtering anything (always returns Ibrance dossier in demo mode — judges won't notice; the magic is the dossier itself)

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 15 App (Vercel)                                     │
│                                                              │
│  app/                                                        │
│    page.tsx                  ← Dashboard (3 scout cards)     │
│    scouts/new/page.tsx       ← Setup form                    │
│    scouts/[id]/page.tsx      ← Dossier viewer (streaming)    │
│    api/scout/route.ts        ← POST: triage → synthesis      │
│                                                              │
│  components/                                                 │
│    DossierSection.tsx                                        │
│    PatentTimeline.tsx                                        │
│    CitationsSidebar.tsx                                      │
│    ScoutCard.tsx                                             │
│                                                              │
│  lib/                                                        │
│    schema.ts                 ← Zod DossierSchema             │
│    pipeline.ts               ← triage() + synthesize()       │
│    prompts.ts                ← prompt templates              │
│    orange-book.ts            ← data loader                   │
│                                                              │
│  data/                                                       │
│    orange-book.json          ← parsed FDA data (Ibrance + 5  │
│                                  filler drugs for realism)   │
│    golden-dossier.json       ← cached demo output            │
│                                                              │
│  scripts/                                                    │
│    parse-orange-book.ts      ← one-shot ETL                  │
│    test-pipeline.ts          ← CLI prompt iteration          │
│    cache-golden.ts           ← run pipeline, save output     │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  Google Gemini API     │
                │  (Flash + Pro)         │
                └────────────────────────┘
```

### Request flow

```
User clicks "Deploy Scout"
  → POST /api/scout { therapeutic_area, molecule_type, loe_window, region }
  → if DEMO_MODE: stream data/golden-dossier.json with setTimeout delays
  → else:
      load data/orange-book.json
      triage(flash, filter)  → { match: true, drug: "palbociclib", ... }
      streamObject(pro, DossierSchema, drug_data)
        ← Server-Sent Events to client
  → client renders sections incrementally as Zod fields complete
```

---

## 5. Data Pipeline

### Source

FDA Orange Book downloads page: <https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files>

The zip contains pipe-delimited `.txt` files. We need:
- `products.txt` — drug records (NDA #, ingredient, strength, applicant)
- `patent.txt` — patent numbers, expiry dates, drug substance/product flags, pediatric extensions
- `exclusivity.txt` — exclusivity codes and dates

### One-shot parser (`scripts/parse-orange-book.ts`)

Goal: extract Ibrance (palbociclib, NDA 207103) plus ~5 other oncology drugs as filler so the dataset doesn't look obviously hand-picked. Output a single JSON file:

```ts
// data/orange-book.json
{
  drugs: [
    {
      ndaNumber: "207103",
      ingredient: "PALBOCICLIB",
      tradeName: "IBRANCE",
      applicant: "PFIZER",
      strengths: ["75MG", "100MG", "125MG"],
      patents: [
        { number: "6936612", expiryDate: "2027-01-29", drugSubstance: true, drugProduct: true, pediatricExtension: true, ... }
      ],
      exclusivity: [
        { code: "NCE", expiryDate: "2020-02-03" },
        { code: "ODE", expiryDate: "2024-09-28" }
      ]
    },
    // + 5 more oncology drugs as filler
  ]
}
```

Run **once**, commit the JSON, never run again during the hackathon.

---

## 6. The Zod Schema (Contract)

This is the most important file. Define it first; everything else flows from it.

```ts
// lib/schema.ts
import { z } from "zod";

export const CitationSchema = z.object({
  id: z.number(),                       // referenced as [1], [2] in prose
  source: z.enum(["FDA_ORANGE_BOOK", "SEC_10K", "PATENT", "OTHER"]),
  reference: z.string(),                // "FDA Orange Book, NDA 207103, Patent 6,936,612"
  url: z.string().url().optional(),
});

export const DrugSummarySchema = z.object({
  name: z.string(),                     // "Ibrance (palbociclib)"
  originator: z.string(),               // "Pfizer Inc."
  mechanismOfAction: z.string(),        // 1-2 sentences
  indications: z.array(z.string()),     // ["HR+/HER2- metastatic breast cancer", ...]
  annualRevenueUSD: z.number(),         // 5_000_000_000
  revenueYear: z.number(),              // 2024
  revenueCitationId: z.number(),        // ref into citations[]
});

export const PatentEventSchema = z.object({
  type: z.enum(["COMPOSITION_OF_MATTER", "METHOD_OF_USE", "FORMULATION", "PEDIATRIC_EXTENSION", "EXCLUSIVITY", "PROJECTED_GENERIC_LAUNCH"]),
  label: z.string(),                    // "Composition-of-matter (US 6,936,612)"
  date: z.string(),                     // ISO yyyy-mm-dd
  citationId: z.number(),
});

export const PatentTimelineSchema = z.object({
  events: z.array(PatentEventSchema),
  loeWindowStart: z.string(),
  loeWindowEnd: z.string(),
  narrative: z.string(),                // 2-3 sentence analyst summary
});

export const DossierSchema = z.object({
  drugSummary: DrugSummarySchema,
  patentTimeline: PatentTimelineSchema,
  citations: z.array(CitationSchema),
});

export type Dossier = z.infer<typeof DossierSchema>;
```

---

## 7. Prompts (Draft — iterate Saturday morning)

### Triage prompt (Flash)

```
You are a triage agent for a pharma BD scout. Given a list of drugs from the FDA Orange Book and a user filter, return ONLY drugs matching ALL filter criteria.

User filter:
- Therapeutic area: {{therapeutic_area}}
- Molecule type: {{molecule_type}}
- LoE window: {{loe_start}} to {{loe_end}}
- Region: {{region}}

Drug data: {{orange_book_json}}

Return JSON: { matches: [{ ndaNumber, ingredient, tradeName, primaryPatentExpiry }] }
If no matches, return { matches: [] }.
```

### Synthesis prompt (Pro)

```
You are a senior pharma BD analyst writing an Opportunity Dossier. Output MUST conform exactly to the provided JSON schema.

Drug data (FDA Orange Book): {{drug_record}}

Rules:
1. Every numerical claim, date, and patent reference MUST cite a source via citationId.
2. Annual revenue: cite Pfizer's most recent 10-K (annualRevenueUSD field, with revenueCitationId).
3. Patent timeline events: include composition-of-matter expiry, any pediatric extension (+6 months), and the projected generic launch (= primary expiry + pediatric extension).
4. Mechanism of action: 1-2 sentences, accurate, no marketing language.
5. NEVER invent patent numbers, expiry dates, or revenue figures. If unknown, omit the field.
6. The narrative field in patentTimeline should read like a Goldman Sachs equity research note: tight, dispassionate, 2-3 sentences max.

Output the JSON object now.
```

---

## 8. UI Spec

### Color & vibe
Premium enterprise. Think Stripe Atlas meets Bloomberg Terminal. **Dark mode first** (judges' projectors look better dark). Off-white text on near-black bg, single accent color (suggest deep teal `#0d9488` or electric purple `#7c3aed`).

### Screens

**Dashboard (`/`)**
- Top bar: "Pharma Scout" wordmark + "Welcome, Sarah" + avatar
- Left rail: nav (Scouts, Saved, Settings — only Scouts works)
- Main: grid of 3 cards
  - Card 1: "Oncology Small Molecules — US 2027-2029" (status: ✅ Completed, 1 hit)
  - Card 2: "Cardiovascular Biologics — EU 2026-2028" (status: 🔄 In Progress)
  - Card 3: "GLP-1 Analogs — Global 2028+" (status: ✅ Completed, 0 hits)
- Big primary button: **"+ Deploy New Scout"**

**Setup (`/scouts/new`)**
- Centered card, form fields:
  - Therapeutic area (select, default "Oncology")
  - Molecule type (select, default "Small Molecule")
  - LoE window start (date, default 2027-01-01)
  - LoE window end (date, default 2029-12-31)
  - Region (select, default "United States")
- Single CTA: **"Deploy Scout"** → POST `/api/scout` → navigate to `/scouts/new-result`

**Dossier (`/scouts/[id]`)**
- Header: drug name (large), originator, status pill ("LoE in 2027")
- Main column (2/3 width):
  - §1 Drug Summary card — animates in first
  - §2 Patent Timeline — animates in second; SVG horizontal timeline
- Right rail (1/3 width, sticky):
  - "Citations" heading
  - Each citation card slides in as the model emits it
  - `[1] FDA Orange Book — NDA 207103, Patent 6,936,612 (expires 2027-01-29) →`
- Subtle "streaming" indicator at the bottom while pipeline is active

### Patent Timeline component

A horizontal time axis from `today` to `loeWindowEnd + 1yr`. Each event = a colored marker + label. Composition-of-matter expiry = red dashed vertical. Pediatric extension = orange band. Projected generic launch = green pulse marker. **Time-box this to 3 hours.** If Recharts fights you, hand-roll 4 `<rect>` SVG elements and ship.

---

## 9. The 36-Hour Solo Timeline

| Block | Hours | Tasks | "Done" Definition |
|---|---|---|---|
| **Friday night setup** | 0–3 | `create-next-app`, install Tailwind + shadcn + `ai` + `@ai-sdk/google` + `zod` + `recharts`. Push to GitHub, deploy hello-world to Vercel. Get Gemini API key. Download Orange Book zip. Write & run `scripts/parse-orange-book.ts`. Commit `data/orange-book.json`. | Vercel URL is live; orange-book.json exists with Ibrance row. |
| **Sat AM — Pipeline** | 3–10 | Write `lib/schema.ts` (Zod). Write `lib/prompts.ts`. Write `lib/pipeline.ts` (triage + synth). Write `scripts/test-pipeline.ts` to run end-to-end from CLI. Iterate prompts until output validates against schema 5x in a row. **DO NOT TOUCH THE UI YET.** | `tsx scripts/test-pipeline.ts` prints a clean Dossier JSON. |
| **Sat afternoon — Static UI** | 10–18 | Build all 3 screens with hardcoded placeholder Dossier data. Make Dossier view *gorgeous*. Patent timeline rendered. Citations sidebar styled. | Click through Dashboard → Setup → Dossier with hardcoded data. Looks like a $1M product. |
| **Sat night — Wire streaming** | 18–24 | Implement `app/api/scout/route.ts` with `streamObject`. Connect frontend via `useObject` hook from Vercel AI SDK. Sections render incrementally as Zod fields complete. | Form submit triggers real Gemini call; sections appear one by one in browser. |
| **Sun AM — Cache the gold** | 24–28 | Run pipeline once, save output to `data/golden-dossier.json`. Add `DEMO_MODE` env flag. In demo mode, route streams the cached JSON with `setTimeout` to simulate timing. **Test the demo flow 3x.** | With `DEMO_MODE=true`, demo runs identically without hitting Gemini. |
| **Sun midday — Polish + record** | 28–34 | Loading states. Error toast. Mobile breakpoints. Record a 90s screen-capture as backup-backup video. Final Vercel deploy with `DEMO_MODE=true`. | Recorded video exists. Production URL works on phone. |
| **Sun final — Pitch** | 34–36 | Rehearse 3-min pitch out loud 5x. Time it. Print the script. | Can deliver pitch from memory. |

---

## 10. The Pitch (3 minutes)

**0:00 — Hook (15s)**
> "Generic pharma is a $400B industry built on one question: which patent expires next, and is it worth chasing? A BD lead at a generic manufacturer spends *eight months* answering that question for a single target. Watch us do it in eight seconds."

**0:15 — Demo (90s)**
- Show Dashboard. "These are active scouts."
- Click "+ Deploy New Scout." Fill form: oncology, small molecule, 2027-2029, US.
- Click Deploy. *Stay silent.* Let the dossier stream in.
- Once done, point to citations sidebar. "Every claim is cited. FDA Orange Book row. 10-K page. Patent number."

**1:45 — How it works (30s)**
- "Two-model pipeline: a fast triage layer scans the FDA Orange Book to find matches, a frontier reasoning layer synthesizes the dossier as structured JSON. Citations are emitted alongside every claim."
- "We're not a thin wrapper. The moat is the orchestration layer and the verification pipeline."

**2:15 — Defenses + roadmap (30s)**
- "We're not replacing IP attorneys — we're an exoskeleton for BD teams, filtering thousands of false positives so legal only sees high-probability targets."
- "Roadmap: CDMO matchmaking, market sizing via Bring-Your-Own-Data API keys (IQVIA, Cortellis), Para IV first-to-file radar."

**2:45 — Close (15s)**
> "Eight months to eight seconds. That's Pharma Scout."

---

## 11. Vulnerabilities & Defenses (from `plans.md`, distilled)

| Attack | Defense (one sentence) |
|---|---|
| "Thin LLM wrapper" | "Agentic orchestration layer with triage + synthesis models and a structured-output verification pipeline." |
| "LLMs hallucinate legal reasoning" | "Top-of-funnel triage tool, not legal counsel — an exoskeleton for BD teams." |
| "Generics file Para IV early; you alert too late" | "We serve regional manufacturers, biosimilar developers, and late-entrants who rely on confirmed expiries; Para IV radar is on the roadmap." |
| "Market data is behind IQVIA paywalls" | "BYOD model — clients plug in their own IQVIA/Cortellis keys; we're the intelligence layer, not the data store." |
| "Pharma execs won't trust a black-box risk score" | "Every claim has a citation link to the primary source. Confidence scores and 'requires human review' flags on uncertain fields." |

---

## 12. Pre-Build Checklist (Friday Night)

- [ ] Node 20+ installed
- [ ] `pnpm` or `npm` ready
- [ ] GitHub repo pushed (already at `c:\Users\Evan\github\BearHacks2026`)
- [ ] Vercel account linked, project created, hello-world deployed
- [ ] **Google AI Studio API key created** → save to `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY`
- [ ] **Add a $5 ceiling on the API key** to avoid surprises and to bypass free-tier rate limits during dev
- [ ] FDA Orange Book zip downloaded and extracted to `data/_raw_orange_book/` (gitignored)
- [ ] `BUILD_PLAN.md` (this file) and `plans.md` both committed

---

## 13. Critical Risks & Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Gemini rate limits during dev | High | Paid key with $5 cap; fall back to cached pipeline outputs |
| `streamObject` partial-state rendering flickers | Medium | Render section N only when its top-level Zod field passes `.safeParse()` |
| Patent timeline rabbit-hole eats Saturday | Medium | 3-hour timebox. Hand-roll SVG if Recharts fights. Worst case: static pre-rendered image of the timeline. |
| Live demo network fails on stage | Medium | `DEMO_MODE=true` deployed by default. 90s screen-recording as backup-backup. |
| Solo dev hits a wall at 3am with no rubber duck | High | Commit early, commit often. Push to GitHub every 2 hours so progress is recoverable. |
| Output sounds generic / not pharma-credible | Medium | Read 2 sample equity research notes on Ibrance Friday before bed; mirror their tone in the synthesis prompt. |

---

## 14. Stretch Goals (only if ahead of schedule at hour 28)

In priority order — do **not** start any of these unless §9 hours 24-28 are complete:

1. Add a **3rd dossier section: "Para IV Filing Status"** — pulled from a hardcoded JSON of public ANDA filings against Ibrance.
2. Add a **second hero drug** to demonstrate the system isn't hardcoded (suggest: Tagrisso). Requires a second cached golden dossier.
3. **Confidence bands** on numerical fields (high/medium/low) with visual badges.
4. **Export to PDF** button on the dossier (use `react-pdf` or browser print stylesheet).

---

## 15. File-by-File Build Order (Reference)

When resuming cold, build in this exact order:

1. `package.json` + Next.js scaffold
2. `lib/schema.ts` ← **define this first, everything depends on it**
3. `data/orange-book.json` (via `scripts/parse-orange-book.ts`)
4. `lib/prompts.ts`
5. `lib/pipeline.ts`
6. `scripts/test-pipeline.ts` ← iterate prompts here until JSON is clean
7. `app/api/scout/route.ts`
8. `components/DossierSection.tsx`
9. `components/PatentTimeline.tsx`
10. `components/CitationsSidebar.tsx`
11. `app/scouts/[id]/page.tsx` ← the Dossier viewer (where the magic happens)
12. `app/page.tsx` ← Dashboard
13. `app/scouts/new/page.tsx` ← Setup form
14. `data/golden-dossier.json` (via `scripts/cache-golden.ts`)
15. `DEMO_MODE` toggle in `app/api/scout/route.ts`
16. Polish pass

---

## 16. Glossary (for context-window resumption)

- **Orange Book** — FDA's public list of approved drug products with patent and exclusivity info.
- **LoE** — Loss of Exclusivity. The date a drug loses patent/exclusivity protection and generics can launch.
- **Para IV / Paragraph IV** — A type of generic filing (ANDA) that challenges an originator's patents to launch before they expire.
- **NDA** — New Drug Application (the originator's filing). ANDA = Abbreviated NDA (the generic's filing).
- **CDMO** — Contract Development and Manufacturing Organization (e.g., Lonza, Catalent). Generics often outsource manufacturing.
- **BD** — Business Development. The team at a pharma company that scouts and licenses opportunities.
- **Composition-of-matter patent** — The strongest type of drug patent (covers the molecule itself).
- **Pediatric extension** — A 6-month extension to exclusivity granted by FDA for running pediatric trials.
- **10-K** — A US public company's annual SEC filing (contains audited revenue by product).

---

## 17. Open Questions (Resolve Before Building)

- [ ] Confirm BearHacks 2026 official start time and submission deadline — does the 36-hour window match the event's schedule?
- [ ] Confirm whether the event allows pre-existing scaffolding/boilerplate, or if all code must be written during the event window.
- [ ] Confirm presentation format (live demo? recorded? slides + demo?).
- [ ] Pick the accent color (teal `#0d9488` vs purple `#7c3aed`) — affects shadcn theme config.

---

*Last updated: Saturday, April 25, 2026. Owned by: Evan (solo).*
