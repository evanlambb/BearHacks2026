import "server-only";

import type { IWipoClient, WipoRawPublication, WipoSearchParams } from "./types";

type WipoClientOptions = {
  endpoint?: string;
  apiKey?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  fetchImpl?: typeof fetch;
  mockResponse?: (params: WipoSearchParams) => Promise<WipoRawPublication[]>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialBackoffMs: number,
): Promise<T> {
  let attempt = 0;
  let backoff = initialBackoffMs;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      await sleep(backoff);
      backoff *= 2;
      attempt += 1;
    }
  }

  throw lastError;
}

export class WipoClient implements IWipoClient {
  private readonly endpoint: string;
  private readonly apiKey: string | undefined;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly mockResponse?: (params: WipoSearchParams) => Promise<WipoRawPublication[]>;

  constructor(options: WipoClientOptions = {}) {
    this.endpoint =
      options.endpoint ?? process.env.WIPO_API_ENDPOINT ?? "https://patentscope.wipo.int/api/v1/search";
    this.apiKey = options.apiKey ?? process.env.WIPO_API_KEY;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.mockResponse = options.mockResponse;
  }

  async searchPublications(params: WipoSearchParams): Promise<WipoRawPublication[]> {
    if (this.mockResponse) return this.mockResponse(params);
    if (!this.apiKey) {
      // TODO: wire production credentials/secrets. This keeps the pipeline runnable in local/mock mode.
      return [];
    }

    return withRetry(async () => {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query: params.query.textQuery,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
        }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await sleep(Math.max(1000, retryAfter * 1000));
        throw new Error("WIPO rate limited");
      }
      if (response.status >= 500) {
        throw new Error(`WIPO transient error ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`WIPO error ${response.status}`);
      }

      const payload = (await response.json()) as { publications?: WipoRawPublication[] };
      return payload.publications ?? [];
    }, this.maxRetries, this.initialBackoffMs);
  }
}
