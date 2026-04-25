import { deepDiveReportSchema, type DeepDiveReport } from "./reportSchema";

const DEFAULT_MODEL = "sonar-pro";

function extractJsonObject(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("No JSON object found in Sonar response");
}

export function parseDeepDiveReportJson(text: string): DeepDiveReport {
  const parsed = JSON.parse(extractJsonObject(text));
  return deepDiveReportSchema.parse(parsed);
}

export interface ISonarClient {
  generateDeepDive(prompt: string): Promise<DeepDiveReport>;
}

export class SonarClient implements ISonarClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    opts: {
      apiKey?: string;
      model?: string;
      endpoint?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {
    this.apiKey = opts.apiKey ?? process.env.SONAR_API_KEY;
    this.model = opts.model ?? process.env.SONAR_MODEL ?? DEFAULT_MODEL;
    this.endpoint = opts.endpoint ?? process.env.SONAR_API_ENDPOINT ?? "https://api.perplexity.ai/chat/completions";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async generateDeepDive(prompt: string): Promise<DeepDiveReport> {
    if (!this.apiKey) throw new Error("SONAR_API_KEY is not set");

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Sonar error ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Sonar response missing content");
    return parseDeepDiveReportJson(content);
  }
}

export const __private__ = {
  extractJsonObject,
};
