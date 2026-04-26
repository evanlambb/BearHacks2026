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

const TOP_LEVEL_KEYS = [
  "asset_summary",
  "patent_and_exclusivity_landscape",
  "originator_and_filer_intelligence",
  "market_sizing",
  "competitive_density",
  "cdmo_matchmaking",
  "api_and_ksm_sourcing",
  "regulatory_pathway",
  "risk_score",
  "financial_model",
  "strategic_recommendation",
  "evidence_pack",
] as const;

function canonicalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeTopLevelKeys(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  const obj = input as Record<string, unknown>;
  const directContainer =
    obj.report && typeof obj.report === "object" && !Array.isArray(obj.report)
      ? (obj.report as Record<string, unknown>)
      : obj;

  const expectedByCanonical = new Map<string, string>(
    TOP_LEVEL_KEYS.map((k) => [canonicalizeKey(k), k]),
  );

  const normalized: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(directContainer)) {
    const canonical = canonicalizeKey(rawKey);
    const mapped = expectedByCanonical.get(canonical) ?? rawKey;
    normalized[mapped] = value;
  }
  return normalized;
}

export function parseDeepDiveReportJson(text: string): DeepDiveReport {
  const parsed = JSON.parse(extractJsonObject(text));
  const normalized = normalizeTopLevelKeys(parsed);
  return deepDiveReportSchema.parse(normalized);
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

    const strictPromptSuffix =
      "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not include markdown fences, prose, or explanations. " +
      `Use exactly these top-level keys: ${TOP_LEVEL_KEYS.join(", ")}.`;

    let lastError: Error | null = null;
    let lastContent: string | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
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
              content: attempt === 1 ? prompt : `${prompt}${strictPromptSuffix}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Sonar error ${response.status}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Sonar response missing content");
      lastContent = content;

      try {
        return parseDeepDiveReportJson(content);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          JSON.stringify({
            ts: new Date().toISOString(),
            scope: "scout-research",
            event: "sonar.parse.retry",
            attempt,
            error: lastError.message,
          }),
        );
      }
    }

    throw new Error(
      `Failed to parse Sonar deep-dive response after retries: ${lastError?.message ?? "Unknown parse error"}${
        lastContent
          ? ` | content_preview=${lastContent.slice(0, 280).replace(/\s+/g, " ")}`
          : ""
      }`,
    );
  }
}

export const __private__ = {
  extractJsonObject,
};
