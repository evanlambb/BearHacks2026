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
