import { buildReportWriterPrompt } from "./reportMarkdownTemplate";
import type { DeepDiveReport } from "../research/reportSchema";
import type { OpportunityReportRow, PatentRow, ScoutRow } from "../../lib/supabase";

const DEFAULT_MODEL = "gpt-5.5";

export interface IReportWriterClient {
  writeReportMarkdown(input: {
    opportunity: OpportunityReportRow;
    scout: ScoutRow;
    patent: PatentRow;
    report: DeepDiveReport;
  }): Promise<string>;
}

function buildDemoMarkdown(input: {
  opportunity: OpportunityReportRow;
  scout: ScoutRow;
  patent: PatentRow;
  report: DeepDiveReport;
}) {
  const title = input.opportunity.drug_name ?? input.patent.title ?? input.patent.patent_id;
  const npv = input.report.financial_model.npv.value ?? "N/A";
  const irr = input.report.financial_model.irr.value ?? "N/A";
  const payback = input.report.financial_model.payback.value ?? "N/A";
  const region = input.opportunity.region ?? input.scout.countries.join(", ");
  const scoutName = input.scout.name ?? input.scout.therapeutic_area;
  const jurisdictionSummary = input.scout.countries.slice(0, 5).join(", ");
  const launchSequence = input.report.strategic_recommendation.launch_sequence_by_country;
  const launchLine = launchSequence.length > 0 ? launchSequence.join(" -> ") : region;
  const signalDisplay =
    input.opportunity.signal_type === "patent_expiry"
      ? "Patent Expiry"
      : input.opportunity.signal_type === "non_filed_region"
        ? "Non-Filed Region"
        : input.opportunity.signal_type;
  const npvDisplay =
    typeof npv === "number" ? `$${npv.toLocaleString()}` : String(npv);
  const irrDisplay = typeof irr === "number" ? `${irr}%` : String(irr);
  const paybackDisplay =
    typeof payback === "number" ? `${payback} years` : String(payback);

  return [
    `# ${title} - Clinical & Commercial Opportunity Dossier`,
    "",
    "## 1. Executive Decision Brief",
    `This dossier evaluates **${title}** under scout **${scoutName}** for **${region}**, with focus on clinical relevance, regulatory feasibility, and launch economics for a bio-pharma operating model.`,
    "",
    `Recommendation: **${input.report.strategic_recommendation.go_no_go.toUpperCase()}** with staged capital release and clinical-governance gates.`,
    "",
    "### Decision Scorecard (Demo)",
    "- **Strategic fit:** 8.8 / 10",
    "- **Clinical plausibility:** 8.1 / 10",
    "- **Regulatory path clarity:** 7.9 / 10",
    "- **Access and reimbursement readiness:** 7.6 / 10",
    "- **Manufacturing and supply readiness:** 7.4 / 10",
    "",
    "## 2. Asset Profile and Scientific Context",
    `- **Patent / Asset:** ${input.patent.patent_id}`,
    `- **Working title:** ${title}`,
    `- **Therapeutic scope:** ${input.scout.therapeutic_area}`,
    `- **Modality focus:** ${input.scout.modality}`,
    `- **Signal category:** ${signalDisplay}`,
    `- **Target countries in scout mandate:** ${jurisdictionSummary}`,
    "",
    "This opportunity aligns with a differentiated specialty-biopharma profile: focused indication strategy, manageable initial geography, and potential for rapid evidence-to-launch translation if execution risk is controlled.",
    "",
    "## 3. Clinical Value Hypothesis",
    "- **Unmet need posture:** moderate-to-high in defined patient segments.",
    "- **Expected clinical positioning:** adjunct or line-extension strategy with differentiation on dosing, convenience, and market access execution.",
    "- **Evidence maturity (demo assumption):** sufficient for strategic screening; requires indication-specific validation package before commitment.",
    "",
    "### Medical Affairs Readout",
    "- KOL narrative should focus on patient stratification, benefit-risk profile, and practical implementation in routine care.",
    "- Early medical engagement should prioritize treatment pathway fit, not only efficacy signal amplification.",
    "- Publication strategy should be synchronized with access milestones in first-launch countries.",
    "",
    "## 4. Regulatory and Quality Pathway",
    "- **Regulatory route:** jurisdiction-specific submission playbooks with parallel readiness planning.",
    "- **Core filing dependencies:** CMC dossier robustness, product characterization consistency, and labeling strategy alignment.",
    "- **Quality posture:** establish audit-ready documentation package and deviation governance before launch lock.",
    "",
    "### CMC / Supply Considerations",
    "- Dual-sourcing or backup capacity is recommended to reduce single-site dependency risk.",
    "- Lot release cadence and stability data timing are likely critical path items.",
    "- Process performance qualification timeline should be integrated into launch sequence governance.",
    "",
    "## 5. Market Access and HEOR View",
    `- **Region focus:** ${region}`,
    `- **Therapeutic area:** ${input.scout.therapeutic_area}`,
    `- **Modality:** ${input.scout.modality}`,
    "- **Expected demand posture:** steady-to-growing",
    "- **Competitive pressure:** moderate, primarily from incumbent contracting power",
    "",
    "### Access Strategy Notes",
    "- Prioritize country-level payer evidence maps and budget impact scenarios early.",
    "- Build value story around total care pathway impact, not list-price dynamics alone.",
    "- Sequence launch in markets where reimbursement mechanics and provider readiness are most favorable.",
    "",
    "## 6. Financial and Capital Case",
    `- **Risk-adjusted NPV:** ${npvDisplay}`,
    `- **IRR:** ${irrDisplay}`,
    `- **Payback:** ${paybackDisplay}`,
    "- **Capital model:** phased deployment with formal go/no-go gates",
    "",
    "### Capital Committee Framing",
    "- Economics are attractive in base case, but schedule slippage sensitivity remains high.",
    "- Commercial readiness and supply reliability are primary value-protection levers.",
    "- Downside case is manageable if gate discipline is preserved and launch scope is contained.",
    "",
    "## 7. Strategic Recommendation and Launch Blueprint",
    input.report.strategic_recommendation.partnership_vs_in_house ??
      "Partner-led launch recommended for faster entry and lower upfront execution burden.",
    "",
    `- **Launch sequence:** ${launchLine}`,
    `- **Urgency posture:** ${input.report.strategic_recommendation.first_to_file_urgency ?? "High"}`,
    "- **Operating model:** partner-led execution with in-house control over medical governance, compliance, and economics.",
    "- **First 90 days:** finalize country evidence packs, lock regulatory workback plans, complete supply-risk mitigations.",
    "",
    "## 8. Risk Register and Mitigation Controls",
    "- **Clinical evidence risk:** mitigate with indication-specific evidence bridging and advisory-board validation.",
    "- **Regulatory pacing risk:** mitigate with country-by-country submission critical paths and escalation thresholds.",
    "- **Supply continuity risk:** mitigate with secondary capacity, quality reserve strategy, and vendor scorecards.",
    "- **Pricing/access erosion risk:** mitigate through disciplined contracting and differentiated value communication.",
    "- **Execution governance risk:** mitigate with weekly launch PMO and cross-functional decision rights clarity.",
    "",
    "## 9. Governance and Next Decisions",
    "- **Governance cadence:** weekly operating review, bi-weekly capital committee review, monthly board-level KPI review post-launch.",
    "- **Decision checkpoints:** evidence readiness, regulatory readiness, CMC readiness, access readiness, commercial readiness.",
    "- **Immediate executive ask:** approve Gate 1 package and proceed with launch-country preparation activities.",
    "",
    "_Note: This document is generated in demo mode for presentation. Structure and language are tuned to emulate medical strategy and portfolio governance outputs used in pharma decision forums._",
    "",
  ].join("\n");
}

export class GptReportWriterClient implements IReportWriterClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    opts: { apiKey?: string; model?: string; endpoint?: string; fetchImpl?: typeof fetch } = {},
  ) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    this.endpoint = opts.endpoint ?? "https://api.openai.com/v1/chat/completions";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async writeReportMarkdown(input: {
    opportunity: OpportunityReportRow;
    scout: ScoutRow;
    patent: PatentRow;
    report: DeepDiveReport;
  }): Promise<string> {
    if (process.env.DEMO_FORCE_REPORTS === "1") {
      return buildDemoMarkdown(input);
    }
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not set");
    const prompt = buildReportWriterPrompt(input);

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error ${response.status}`);

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("GPT response missing markdown content");
    return content;
  }
}
