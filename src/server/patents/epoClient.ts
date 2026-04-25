import "server-only";

import type { EpoRawPublication, EpoSearchParams, IEpoClient } from "./types";

type EpoClientOptions = {
  endpoint?: string;
  token?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  fetchImpl?: typeof fetch;
  mockResponse?: (params: EpoSearchParams) => Promise<EpoRawPublication[]>;
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

export class EpoClient implements IEpoClient {
  private readonly endpoint: string;
  private readonly token: string | undefined;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly mockResponse?: (params: EpoSearchParams) => Promise<EpoRawPublication[]>;

  constructor(options: EpoClientOptions = {}) {
    this.endpoint =
      options.endpoint ?? process.env.EPO_API_ENDPOINT ?? "https://ops.epo.org/3.2/rest-services/published-data/search";
    this.token = options.token ?? process.env.EPO_API_TOKEN;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.mockResponse = options.mockResponse;
  }

  async searchPublications(params: EpoSearchParams): Promise<EpoRawPublication[]> {
    if (this.mockResponse) return this.mockResponse(params);
    if (!this.token) {
      // TODO: wire production OAuth/token exchange. Empty array allows local ingest tests with mocked clients.
      return [];
    }

    return withRetry(async () => {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          query: params.query.textQuery,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          includeFamily: true,
        }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await sleep(Math.max(1000, retryAfter * 1000));
        throw new Error("EPO rate limited");
      }
      if (response.status >= 500) {
        throw new Error(`EPO transient error ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`EPO error ${response.status}`);
      }

      const payload = (await response.json()) as { publications?: EpoRawPublication[] };
      return payload.publications ?? [];
    }, this.maxRetries, this.initialBackoffMs);
  }
}
