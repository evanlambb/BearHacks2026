import "server-only";

import { BigQuery } from "@google-cloud/bigquery";

import type {
  EpoRawPublication,
  EpoSearchParams,
  IEpoClient,
  IWipoClient,
  WipoRawPublication,
  WipoSearchParams,
} from "./types";

type BigQueryPatentRecord = {
  publicationNumber: string | null;
  applicationNumber: string | null;
  familyId: string | null;
  jurisdictionCode: string | null;
  title: string | null;
  abstract: string | null;
  applicants: string[] | null;
  inventors: string[] | null;
  filingDate: string | null;
  publicationDate: string | null;
  priorityDate: string | null;
  grantDate: string | null;
  ipcCodes: string[] | null;
  cpcCodes: string[] | null;
  rawRecordJson: string;
};

type BigQueryPatentClientOptions = {
  projectId?: string;
  location?: string;
  publicationsTable?: string;
  maxRows?: number;
};

function resolveProjectId(explicitProjectId?: string): string | undefined {
  const raw = explicitProjectId?.trim();
  if (!raw) return undefined;

  // GCP project IDs are lowercase strings; project numbers are numeric.
  // If a project number is provided here, let the SDK infer from the
  // credentials file instead of hard-failing against a non-existent project ID.
  if (/^\d+$/.test(raw)) return undefined;

  return raw;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    return text;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(Math.trunc(value));
    if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  return null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((entry) => (typeof entry === "string" ? entry : null))
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .map((entry) => entry.trim());
  return out.length > 0 ? out : null;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

const COUNTRY_TO_CODE: Record<string, string> = {
  "united states": "us",
  canada: "ca",
  "united kingdom": "gb",
  germany: "de",
  france: "fr",
  italy: "it",
  spain: "es",
  netherlands: "nl",
  switzerland: "ch",
  japan: "jp",
  china: "cn",
  "south korea": "kr",
  india: "in",
  brazil: "br",
  mexico: "mx",
  australia: "au",
};

function normalizeCountryToken(country: string): string {
  const normalized = country.trim().toLowerCase();
  return COUNTRY_TO_CODE[normalized] ?? normalized;
}

function tokenizeQuery(textQuery: string): string[] {
  return textQuery
    .split(/AND|OR|\(|\)|:/g)
    .map((v) => v.replace(/"/g, "").trim())
    .filter((v) => v.length > 2);
}

function matchesCountry(record: BigQueryPatentRecord, countries: string[]): boolean {
  if (countries.length === 0) return true;
  if (!record.jurisdictionCode) return false;

  const jurisdiction = record.jurisdictionCode.toLowerCase();
  return countries.some((country) => {
    const normalized = normalizeCountryToken(country);
    return (
      normalized === jurisdiction ||
      normalized.startsWith(jurisdiction) ||
      jurisdiction.startsWith(normalized)
    );
  });
}

function filterRecords(
  records: BigQueryPatentRecord[],
  opts: { countries: string[]; queryTokens: string[]; ignoreCountry?: boolean; ignoreText?: boolean },
): BigQueryPatentRecord[] {
  return records.filter((record) => {
    const text = `${record.title ?? ""} ${record.abstract ?? ""}`;
    const countryOk = opts.ignoreCountry ? true : matchesCountry(record, opts.countries);
    const textOk = opts.ignoreText ? true : opts.queryTokens.length === 0 || containsAny(text, opts.queryTokens);
    return Boolean(record.publicationNumber || record.applicationNumber) && countryOk && textOk;
  });
}

function extractRecord(row: Record<string, unknown>): BigQueryPatentRecord {
  const publicationNumber = pickString(row, [
    "publication_number",
    "publicationNumber",
    "docdb_family_id",
    "patent_id",
  ]);
  const applicationNumber = pickString(row, ["application_number", "applicationNumber"]);
  const jurisdictionCode = pickString(row, ["country_code", "jurisdiction_code", "office"]);
  const title = pickString(row, ["invention_title", "title", "invention_title_english"]);
  const abstract = pickString(row, ["abstract", "abstract_text"]);

  return {
    publicationNumber,
    applicationNumber,
    familyId: pickString(row, ["family_id", "docdb_family_id"]),
    jurisdictionCode,
    title,
    abstract,
    applicants: toStringArray(row.applicants) ?? toStringArray(row.assignee_harmonized),
    inventors: toStringArray(row.inventors) ?? toStringArray(row.inventor_harmonized),
    filingDate: normalizeDate(row.filing_date),
    publicationDate: normalizeDate(row.publication_date),
    priorityDate: normalizeDate(row.priority_date),
    grantDate: normalizeDate(row.grant_date),
    ipcCodes: toStringArray(row.ipc),
    cpcCodes: toStringArray(row.cpc),
    rawRecordJson: JSON.stringify(row),
  };
}

function makeCacheKey(query: string, countries: string[]): string {
  return `${query}::${countries.sort().join(",")}`;
}

export class BigQueryPatentClient {
  private readonly bigquery: BigQuery;
  private readonly location: string;
  private readonly publicationsTable: string;
  private readonly maxRows: number;
  private readonly cache = new Map<string, BigQueryPatentRecord[]>();

  constructor(options: BigQueryPatentClientOptions = {}) {
    const configuredProjectId = resolveProjectId(
      options.projectId ?? process.env.BIGQUERY_PROJECT_ID,
    );

    this.bigquery = new BigQuery({
      projectId: configuredProjectId,
    });
    this.location = options.location ?? process.env.BIGQUERY_LOCATION ?? "US";
    this.publicationsTable =
      options.publicationsTable ??
      process.env.BIGQUERY_PUBLICATIONS_TABLE ??
      "patents-public-data.patents.publications";
    this.maxRows = options.maxRows ?? Number(process.env.BIGQUERY_MAX_ROWS ?? 200);
  }

  async search(params: { textQuery: string; countries: string[] }): Promise<BigQueryPatentRecord[]> {
    const cacheKey = makeCacheKey(params.textQuery, [...params.countries]);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const [rows] = await this.bigquery.query({
      location: this.location,
      query: `SELECT * FROM \`${this.publicationsTable}\` LIMIT @maxRows`,
      params: { maxRows: this.maxRows },
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `BigQuery query failed (${message}). Check BIGQUERY_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.`,
      );
    });

    const allRecords = (rows as Record<string, unknown>[]).map((row) => extractRecord(row));
    const queryTokens = tokenizeQuery(params.textQuery);

    // Progressive relaxation avoids empty runs when sampled rows don't satisfy
    // strict country/text constraints simultaneously.
    let records = filterRecords(allRecords, {
      countries: params.countries,
      queryTokens,
    });
    if (records.length === 0) {
      records = filterRecords(allRecords, {
        countries: params.countries,
        queryTokens,
        ignoreCountry: true,
      });
    }
    if (records.length === 0) {
      records = filterRecords(allRecords, {
        countries: params.countries,
        queryTokens,
        ignoreText: true,
      });
    }
    if (records.length === 0) {
      records = filterRecords(allRecords, {
        countries: params.countries,
        queryTokens,
        ignoreCountry: true,
        ignoreText: true,
      });
    }

    this.cache.set(cacheKey, records);
    return records;
  }
}

export class BigQueryWipoClient implements IWipoClient {
  constructor(private readonly patentClient: BigQueryPatentClient) {}

  async searchPublications(params: WipoSearchParams): Promise<WipoRawPublication[]> {
    const records = await this.patentClient.search({
      textQuery: params.query.textQuery,
      countries: params.query.countries,
    });

    return records.map((record) => ({
      publicationNumber: record.publicationNumber,
      applicationNumber: record.applicationNumber,
      title: record.title,
      abstract: record.abstract,
      applicants: record.applicants,
      inventors: record.inventors,
      filingDate: record.filingDate,
      publicationDate: record.publicationDate,
      priorityDate: record.priorityDate,
      ipcCodes: record.ipcCodes,
      language: "EN",
      rawXml: record.rawRecordJson,
    }));
  }
}

export class BigQueryEpoClient implements IEpoClient {
  constructor(private readonly patentClient: BigQueryPatentClient) {}

  async searchPublications(params: EpoSearchParams): Promise<EpoRawPublication[]> {
    const records = await this.patentClient.search({
      textQuery: params.query.textQuery,
      countries: params.query.countries,
    });

    return records.map((record) => ({
      publicationNumberDocdb: record.publicationNumber,
      applicationNumber: record.applicationNumber,
      familyId: record.familyId,
      jurisdictionCode: record.jurisdictionCode,
      title: record.title,
      abstract: record.abstract,
      applicants: record.applicants,
      inventors: record.inventors,
      filingDate: record.filingDate,
      publicationDate: record.publicationDate,
      grantDate: record.grantDate,
      ipcCodes: record.ipcCodes,
      cpcCodes: record.cpcCodes,
      rawXml: record.rawRecordJson,
      familyMembers: record.familyId
        ? [
            {
              publicationNumberDocdb: record.publicationNumber,
              jurisdictionCode: record.jurisdictionCode,
              applicationNumber: record.applicationNumber,
              status: null,
              filingDate: record.filingDate,
              publicationDate: record.publicationDate,
            },
          ]
        : [],
    }));
  }
}
