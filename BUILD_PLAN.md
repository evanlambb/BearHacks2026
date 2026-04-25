# Pharma Scout — Build Plan (BearHacks 2026)

> **Purpose of this document:** Single source of truth for the build. If the current chat context is lost, a fresh AI session (or a sleep-deprived human) should be able to read this file top-to-bottom and resume work without losing momentum.
>
> **Companion doc:** `plans.md` contains the original strategic framing and pitch defenses. This doc is the *executable* spec.

---

## 0. Project Identity

- **Name:** Pharma Scout (working title)
- **Tagline:** "8 months to 8 seconds — autonomous patent-cliff opportunity scouting for generic pharma BD teams."
- **Hackathon:** BearHacks 2026 — already underway
- **Build budget:** ~10 hours of focused build, then remaining time for demo polish & rehearsal
- **Demo format:** Live demo (with a 90-second screen recording as backup-backup)
- **Repo:** `c:\Users\Evan\github\BearHacks2026`
- **Builder:** Solo developer
- **Deployment:** Local only (`npm run dev`) — no Vercel, no remote hosting

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
| LLM provider | **Google Gemini (paid tier — confirmed working)** | Pro tier required because `gemini-2.5-pro` is `limit: 0` on free tier. |
| Triage model | `gemini-2.5-flash` | Cheap match-or-skip step |
| Synthesis model | `gemini-2.5-pro` | Long-form structured dossier generation |
| Frontend | **Next.js 15 (App Router) + Tailwind + shadcn/ui** | Premium enterprise look in zero time |
| Backend | **Next.js API routes (all TypeScript, no Python, no FastAPI)** | Single dev server, single language. The Python venv was just for key-testing — discarded. |
| LLM SDK | **`@google/genai`** Node SDK called directly | No Vercel AI SDK — lighter, fewer abstractions, fine for a 10-hour MVP |
| Charts | Hand-rolled SVG (preferred) or Recharts (fallback) | Patent timeline is the only viz — avoid the dependency if possible |
| Hosting | **Local only** (`npm run dev`, demoed from laptop) | Eliminates "works locally / broken in prod" bugs |
| Data source | FDA Orange Book zip → parsed once → `data/orange-book.json` static asset | No runtime ETL, no scraping, free |
| Streaming UX | **Section-by-section reveal**: two separate API endpoints (`/api/scout/summary`, `/api/scout/timeline`) called sequentially from the client; each section animates in when its endpoint resolves | Way simpler than partial-JSON streaming; same magical feel |
| Demo safety | `DEMO_MODE=true` env flag → routes serve `data/golden-dossier.json` with simulated delays instead of hitting Gemini | **NON-NEGOTIABLE** — saves the live demo |
| Accent color | **Teal `#0d9488`** | shadcn theme primary |

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
│  Next.js 15 App (local: npm run dev on :3000)                │
│                                                              │
│  app/                                                        │
│    page.tsx                       ← Dashboard                │
│    scouts/new/page.tsx            ← Setup form               │
│    scouts/[id]/page.tsx           ← Dossier viewer           │
│    api/scout/triage/route.ts      ← POST: triage             │
│    api/scout/summary/route.ts     ← POST: §1 drug summary    │
│    api/scout/timeline/route.ts    ← POST: §2 patent timeline │
│                                                              │
│  components/                                                 │
│    DossierSection.tsx                                        │
│    PatentTimeline.tsx                                        │
│    CitationsSidebar.tsx                                      │
│    ScoutCard.tsx                                             │
│                                                              │
│  lib/                                                        │
│    schema.ts             ← Zod DossierSchema                 │
│    gemini.ts             ← @google/genai client + helpers    │
│    pipeline.ts           ← triage() + summarize() + timeline()│
│    prompts.ts            ← prompt templates                  │
│    orange-book.ts        ← data loader                       │
│                                                              │
│  data/                                                       │
│    orange-book.json      ← parsed FDA data (Ibrance + ~5     │
│                            filler drugs for realism)         │
│    golden-dossier.json   ← cached demo output                │
│                                                              │
│  scripts/                                                    │
│    parse-orange-book.ts  ← one-shot ETL                      │
│    test-pipeline.ts      ← CLI prompt iteration              │
│    cache-golden.ts       ← run pipeline, save output         │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  Google Gemini API     │
                │  2.5-flash + 2.5-pro   │
                │  (paid tier)           │
                └────────────────────────┘
```

### Request flow (real pipeline)

```
User clicks "Deploy Scout"
  → router.push("/scouts/new-result")  (client navigates immediately)
  → Dossier page mounts, fires three sequential fetches:

      1) POST /api/scout/triage    { filter }
            → loads data/orange-book.json
            → gemini-2.5-flash returns { match: true, ndaNumber: "207103" }

      2) POST /api/scout/summary   { ndaNumber }
            → gemini-2.5-pro with responseSchema=DrugSummarySchema
            → returns drugSummary + its citations
            → §1 card animates into view

      3) POST /api/scout/timeline  { ndaNumber }
            → gemini-2.5-pro with responseSchema=PatentTimelineSchema
            → returns patentTimeline + its citations
            → §2 card + citations sidebar animate in

  → "Scout complete" badge appears
```

### Request flow (DEMO_MODE=true)

```
Each /api/scout/* route reads data/golden-dossier.json and returns
its slice after a setTimeout delay (250ms / 1500ms / 1800ms) to mimic
the real pipeline timing. No Gemini calls. Network-failure-proof.
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

### Section 1 — Drug Summary prompt (Pro, `responseSchema = DrugSummarySchema + citations`)

```
You are a senior pharma BD analyst. Produce the "Drug & Mechanism Summary" section of an Opportunity Dossier. Output MUST conform exactly to the provided JSON schema.

Drug data (FDA Orange Book row): {{drug_record}}

Rules:
1. Mechanism of action: 1-2 sentences, accurate, no marketing language.
2. Indications: list approved US indications only.
3. annualRevenueUSD: use the originator's most recent published 10-K figure for this product. If you cannot cite a specific 10-K page, omit the field — DO NOT guess.
4. Every numeric claim and indication needs a citationId pointing into the citations array.
5. Citations must reference real, verifiable sources (FDA Orange Book row, SEC 10-K with year and product-segment page, official prescribing information).

Output the JSON object now.
```

### Section 2 — Patent Timeline prompt (Pro, `responseSchema = PatentTimelineSchema + citations`)

```
You are a senior pharma BD analyst. Produce the "Patent Cliff Timeline" section of an Opportunity Dossier. Output MUST conform exactly to the provided JSON schema.

Drug data (FDA Orange Book row, including all patents and exclusivity entries): {{drug_record}}

Rules:
1. Include ONE event per patent listed in the input (type = COMPOSITION_OF_MATTER, METHOD_OF_USE, or FORMULATION based on the patent's drugSubstance/drugProduct flags and known patent claims).
2. If any patent has a pediatric extension, add a separate PEDIATRIC_EXTENSION event 6 months after that patent's expiry.
3. Include exactly one PROJECTED_GENERIC_LAUNCH event = the LATEST of (composition-of-matter expiry + pediatric extension if applicable).
4. loeWindowStart = earliest patent expiry. loeWindowEnd = projected generic launch date.
5. narrative: 2-3 sentence analyst summary. Tight, dispassionate, like Goldman Sachs equity research. No marketing language.
6. Every event needs a citationId pointing into the citations array; cite the FDA Orange Book row for that specific patent number.
7. NEVER invent patent numbers or expiry dates not present in the input.

Output the JSON object now.
```

### Triage prompt (Flash) — unchanged from above.

---

## 8. UI Spec

### Color & vibe
Premium enterprise. Think Stripe Atlas meets Bloomberg Terminal. **Dark mode first** (judges' projectors look better dark). Off-white text on near-black bg, single accent color: **deep teal `#0d9488`**.

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

## 9. The 10-Hour Solo Timeline

> Hard rule: **do not start a block before the previous block's "Done" definition is met.** If you slip, cut from §14 stretch goals or simplify the Patent Timeline visualization first — never cut the cache (block 6).

| # | Block | Hrs | Tasks | "Done" Definition |
|---|---|---|---|---|
| **1** | Scaffold | 0.0 – 1.0 | `npx create-next-app@latest` (TS, App Router, Tailwind, src/ no, app router yes). `npx shadcn@latest init` (teal accent). `npm i @google/genai zod`. Add `.env.local` with `GOOGLE_GENERATIVE_AI_API_KEY`. Write `lib/gemini.ts` with a one-line "hello gemini" helper. Run `npx tsx scripts/hello.ts` and confirm both `gemini-2.5-flash` and `gemini-2.5-pro` respond. Commit. | Both models respond from a Node script. shadcn is initialized with teal theme. |
| **2** | Data | 1.0 – 2.0 | Download Orange Book zip → `data/_raw/`. Write `scripts/parse-orange-book.ts` to extract the Ibrance (NDA 207103) row + ~5 filler oncology drugs (e.g., Tagrisso, Keytruda, Verzenio, Lynparza, Calquence) into `data/orange-book.json`. Run it. Commit the JSON; gitignore `_raw/`. | `data/orange-book.json` exists, contains Ibrance with full patent + exclusivity arrays, plus 5 filler drugs. |
| **3** | Schema + Prompts | 2.0 – 3.0 | Write `lib/schema.ts` exactly as in §6. Write `lib/prompts.ts` with the three prompts from §7. Write `lib/pipeline.ts` exposing `triage()`, `summarize()`, `timeline()`. | Files exist, no TS errors, prompts use `{{drug_record}}` interpolation. |
| **4** | CLI test | 3.0 – 4.0 | Write `scripts/test-pipeline.ts` that runs all three steps end-to-end and prints the assembled Dossier. **Iterate prompts until output validates against `DossierSchema` 3x in a row.** Do not touch UI yet. | `npx tsx scripts/test-pipeline.ts` prints a valid Dossier JSON 3 runs in a row. |
| **5** | Static UI | 4.0 – 7.0 | Build all 3 screens with hardcoded placeholder Dossier data imported from a fixture file. Make Dossier view *gorgeous* — that's what wins. Build `<PatentTimeline />` (hand-rolled SVG, time-box 60 min). Citations sidebar with sticky positioning. | Click through Dashboard → Setup → Dossier with hardcoded data. Looks like a $1M product on a 1080p projector. |
| **6** | Wire pipeline | 7.0 – 8.5 | Implement `/api/scout/triage`, `/api/scout/summary`, `/api/scout/timeline`. Dossier page fires them sequentially with `useEffect`. Each section's "loading skeleton" → "rendered card" transition uses Tailwind's `animate-in fade-in slide-in-from-bottom-4` (or framer-motion if shadcn brings it). | Form submit hits real Gemini, sections appear one after another, citations populate sidebar. |
| **7** | Cache the gold | 8.5 – 9.25 | Write `scripts/cache-golden.ts`: runs the pipeline once, saves to `data/golden-dossier.json`. Add `DEMO_MODE` env flag. Each `/api/scout/*` route checks the flag and returns cached slices with `setTimeout(250/1500/1800)` delays. **Test the demo flow 5x.** | With `DEMO_MODE=true`, demo runs identically without hitting Gemini. Tested 5 reloads in a row, no flicker. |
| **8** | Record + polish | 9.25 – 10.0 | Set `DEMO_MODE=true`. Record a 90s screen capture as backup-backup. Loading skeletons. Error toast. Print the pitch script from §10. **Rehearse the pitch out loud 3x.** | Recorded MP4 exists on disk. Pitch fits in 3:00. |
| **+** | Buffer / polish | 10.0+ | Use any remaining time for typography, micro-interactions, or one stretch goal from §14 (in priority order). | — |

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

## 12. Pre-Build Checklist

- [x] Repo exists at `c:\Users\Evan\github\BearHacks2026`
- [x] Google AI Studio API key created, **paid tier enabled**, both `gemini-2.5-flash` and `gemini-2.5-pro` confirmed responding
- [ ] Key saved to `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY` (and `.env.local` is gitignored)
- [ ] Node 20+ installed (`node --version`)
- [ ] FDA Orange Book zip downloaded → extracted to `data/_raw/` → `_raw/` added to `.gitignore`
- [x] `BUILD_PLAN.md` (this file) and `plans.md` committed
- [ ] Python venv (`.venv/`) added to `.gitignore` — was used only for key testing, not part of the app

---

## 13. Critical Risks & Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Gemini rate limits during dev | High | Paid key with $5 cap; fall back to cached pipeline outputs |
| Section-by-section calls feel sluggish (3 sequential roundtrips) | Medium | Fire `triage` and `summary` in parallel via `Promise.all` once you confirm triage doesn't gate summary; or just trust DEMO_MODE for the live demo |
| `responseSchema` JSON output drifts from Zod schema | Medium | Validate every response with `.safeParse()` and on failure, retry once with the validation errors injected into the prompt |
| Patent timeline rabbit-hole eats Saturday | Medium | 3-hour timebox. Hand-roll SVG if Recharts fights. Worst case: static pre-rendered image of the timeline. |
| Live demo network fails on stage | Medium | `DEMO_MODE=true` deployed by default. 90s screen-recording as backup-backup. |
| Solo dev hits a wall at 3am with no rubber duck | High | Commit early, commit often. Push to GitHub every 2 hours so progress is recoverable. |
| Output sounds generic / not pharma-credible | Medium | Read 2 sample equity research notes on Ibrance Friday before bed; mirror their tone in the synthesis prompt. |
| **LLM hallucinates citation URLs (404 on click)** | **High** | **Fixed in lib/prompts.ts: summary prompt now restricts URLs to a whitelist of stable search/browse endpoints (Drugs@FDA, SEC EDGAR, Orange Book product search). Never deep-link to specific PDFs. Golden dossier URLs hand-verified live.** |

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
7. `app/api/scout/triage/route.ts`
8. `app/api/scout/summary/route.ts`
9. `app/api/scout/timeline/route.ts`
10. `components/DossierSection.tsx`
11. `components/PatentTimeline.tsx`
12. `components/CitationsSidebar.tsx`
13. `app/scouts/[id]/page.tsx` ← the Dossier viewer (where the magic happens)
14. `app/page.tsx` ← Dashboard
15. `app/scouts/new/page.tsx` ← Setup form
16. `data/golden-dossier.json` (via `scripts/cache-golden.ts`)
17. `DEMO_MODE` toggle in all three `/api/scout/*` routes
18. Polish pass

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

## 17. Decisions Log (Resolved)

- [x] **Hackathon timing:** Already underway. ~10 hours of focused build, then polish & rehearse.
- [x] **Presentation format:** Live demo, with a recorded screen capture as backup-backup.
- [x] **Accent color:** Teal `#0d9488`.
- [x] **Backend language:** TypeScript only — Next.js API routes calling `@google/genai` Node SDK directly. The Python venv was throwaway (key testing only).
- [x] **Streaming approach:** Section-by-section reveal via three sequential API endpoints (no partial-JSON streaming, no Vercel AI SDK). For the demo, hardcoded golden-dossier cache replaces real Gemini calls but uses identical UI/animation timing.
- [x] **Hosting:** Local only. No Vercel.
- [x] **Gemini tier:** Paid tier active and confirmed working for both `gemini-2.5-flash` and `gemini-2.5-pro`. Free tier blocks Pro entirely (`limit: 0`).

---

*Last updated: Saturday, April 25, 2026 — 10-hour build budget locked. Owned by: Evan (solo).*
