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
  const npvDisplay =
    typeof npv === "number" ? `$${npv.toLocaleString()}` : String(npv);

  return [
    `# ${title} Opportunity Report`,
    "",
    "## 1. Executive Summary",
    `This investment memo evaluates the commercial and execution potential for **${title}** under scout **${scoutName}** across **${region}**. The opportunity screens positively on strategic fit, expected market access pathway, and modeled returns under a partner-led launch approach.`,
    "",
    `Recommendation: **${input.report.strategic_recommendation.go_no_go.toUpperCase()}** with controlled go-to-market sequencing and milestone-based capital deployment.`,
    "",
    "- Strong thesis alignment with selected therapeutic scope and modality.",
    "- Attractive modeled economics with disciplined risk-adjusted assumptions.",
    "- Feasible launch path in priority markets with manageable operational complexity.",
    "- Main watchouts: evidence maturity, country-by-country regulatory pacing, and supplier concentration.",
    "",
    "## 2. Asset and Strategic Fit",
    `- **Patent / Asset:** ${input.patent.patent_id}`,
    `- **Therapeutic area focus:** ${input.scout.therapeutic_area}`,
    `- **Modality focus:** ${input.scout.modality}`,
    `- **Signal type:** ${input.opportunity.signal_type}`,
    `- **Target countries in scout mandate:** ${jurisdictionSummary}`,
    "",
    "The asset profile is consistent with the scout mandate and appears suitable for a focused regional entry strategy. In demo mode, this summary emphasizes board-level decision support and launch planning over discovery uncertainty.",
    "",
    "## 2. Market Snapshot",
    `- **Region focus:** ${region}`,
    `- **Therapeutic area:** ${input.scout.therapeutic_area}`,
    `- **Modality:** ${input.scout.modality}`,
    `- **Expected demand posture:** steady-to-growing`,
    `- **Competitive intensity:** moderate with room for differentiated execution`,
    "",
    "### Demand and Access View",
    "- Demand assumptions reflect sustained patient need and stable treatment pathway adoption.",
    "- Access outlook is favorable where payer and procurement structures support value-focused entrants.",
    "- The commercial plan should prioritize early reimbursement intelligence and local KOL engagement.",
    "",
    "### Competitive Considerations",
    "- Near-term pressure is expected from incumbent relationships rather than immediate crowding.",
    "- Execution edge comes from launch timing, supply reliability, and pricing discipline.",
    "- Market capture assumptions are intentionally conservative for first 12-18 months.",
    "",
    "## 3. Financial Highlights",
    `- **NPV:** ${npvDisplay}`,
    `- **IRR:** ${irr}`,
    `- **Payback:** ${payback}`,
    `- **Capital stance:** phased deployment with milestone gates`,
    "",
    "### Financial Interpretation",
    "- Base case indicates compelling return potential for a mid-risk profile.",
    "- Early-year cash discipline remains critical; delay or cost drift impacts IRR disproportionately.",
    "- Sensitivity is highest to launch timing, realized price net of access concessions, and supply consistency.",
    "",
    "### Suggested Investment Gates",
    "- Gate 1: country-level regulatory and access validation completed.",
    "- Gate 2: manufacturing and supply-readiness confirmed with contingency capacity.",
    "- Gate 3: commercial readiness package approved for launch markets.",
    "",
    "## 4. Strategic Recommendation",
    input.report.strategic_recommendation.partnership_vs_in_house ??
      "Partner-led launch recommended for faster entry.",
    "",
    `- **Launch sequence:** ${launchLine}`,
    `- **Urgency signal:** ${input.report.strategic_recommendation.first_to_file_urgency ?? "High"}`,
    "- **Operating model:** partner-led market entry with targeted in-house oversight on quality, compliance, and economics.",
    "- **90-day priorities:** finalize evidence package, lock supply plan, and secure launch-country regulatory workback schedule.",
    "",
    "## 5. Risks and Mitigations",
    "- **Regulatory pacing risk:** mitigate with country-specific filing playbooks and parallel dossier preparation.",
    "- **Supply concentration risk:** mitigate via dual-sourcing strategy and quality reserve capacity.",
    "- **Pricing / erosion risk:** mitigate through disciplined contracting and indication-specific positioning.",
    "- **Execution risk:** mitigate by stage-gated rollout and weekly launch readiness governance.",
    "",
    "## 6. Evidence and Governance Notes",
    "This report body is generated in demo mode for presentation purposes, but it follows the same executive structure used by production reports: thesis fit, market framing, return profile, risk analysis, and clear go-forward actions.",
    "",
    "Recommended governance cadence: weekly operating review during pre-launch, bi-weekly capital committee updates, and monthly board-level KPI review post-launch.",
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
