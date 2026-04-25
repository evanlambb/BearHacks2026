import crypto from "node:crypto";

import type { PatentInsert } from "../../lib/supabase";

import type {
  EpoRawFamilyMember,
  EpoRawPublication,
  NormalizedPatentBundle,
  WipoRawPublication,
} from "./types";

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function canonicalizePublicationNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact || null;
}

function parseDateSafe(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function deterministicPatentId(source: string, publication: string | null, application: string | null): string {
  if (publication) return publication;

  const basis = `${source}|${(application ?? "").toUpperCase()}`;
  const hash = crypto.createHash("sha256").update(basis).digest("hex").slice(0, 24);
  return `${source}-${hash}`;
}

function compactStringArray(values: string[] | null | undefined): string[] | null {
  if (!values || values.length === 0) return null;
  const seen = new Set<string>();
  for (const value of values) {
    const cleaned = normalizeSpaces(value);
    if (!cleaned) continue;
    seen.add(cleaned);
  }
  return seen.size > 0 ? [...seen] : null;
}

function getBestPatentCore(params: {
  source: "wipo" | "epo";
  publication: string | null;
  application: string | null;
  title: string | null | undefined;
  abstract: string | null | undefined;
  applicants: string[] | null | undefined;
  inventors: string[] | null | undefined;
  filingDate: string | null | undefined;
  publicationDate: string | null | undefined;
  priorityDate?: string | null | undefined;
  grantDate?: string | null | undefined;
  familyId?: string | null | undefined;
  jurisdictions?: string[] | null | undefined;
  ipcCodes?: string[] | null | undefined;
  cpcCodes?: string[] | null | undefined;
}): PatentInsert {
  const canonicalPublication = params.publication ?? params.application ?? `${params.source.toUpperCase()}UNKNOWN`;
  const patentId = deterministicPatentId(params.source, params.publication, params.application);

  return {
    patent_id: patentId,
    canonical_publication_number: canonicalPublication,
    title: params.title?.trim() || null,
    abstract: params.abstract?.trim() || null,
    applicants: compactStringArray(params.applicants),
    inventors: compactStringArray(params.inventors),
    filing_date: parseDateSafe(params.filingDate),
    publication_date: parseDateSafe(params.publicationDate),
    priority_date: parseDateSafe(params.priorityDate),
    grant_date: parseDateSafe(params.grantDate),
    family_id: params.familyId?.trim() || null,
    jurisdictions: compactStringArray(params.jurisdictions),
    ipc_codes: compactStringArray(params.ipcCodes),
    cpc_codes: compactStringArray(params.cpcCodes),
    source: "wipo_epo",
  };
}

export function normalizeWipoPublication(raw: WipoRawPublication): NormalizedPatentBundle | null {
  const publication = canonicalizePublicationNumber(raw.publicationNumber);
  const application = raw.applicationNumber?.trim() || null;
  if (!publication && !application) return null;

  const patent = getBestPatentCore({
    source: "wipo",
    publication,
    application,
    title: raw.title,
    abstract: raw.abstract,
    applicants: raw.applicants,
    inventors: raw.inventors,
    filingDate: raw.filingDate,
    publicationDate: raw.publicationDate,
    priorityDate: raw.priorityDate,
    ipcCodes: raw.ipcCodes,
    jurisdictions: publication?.slice(0, 2) ? [publication.slice(0, 2)] : null,
  });

  return {
    patent,
    wipoPublication: {
      patent_id: patent.patent_id,
      publication_number: publication ?? application ?? patent.patent_id,
      application_number: application,
      title: raw.title?.trim() || null,
      abstract: raw.abstract?.trim() || null,
      applicants: compactStringArray(raw.applicants),
      inventors: compactStringArray(raw.inventors),
      filing_date: parseDateSafe(raw.filingDate),
      publication_date: parseDateSafe(raw.publicationDate),
      priority_date: parseDateSafe(raw.priorityDate),
      ipc_codes: compactStringArray(raw.ipcCodes),
      language: raw.language?.trim() || null,
      raw_xml: raw.rawXml,
    },
    epoFamilyMembers: [],
  };
}

function normalizeFamilyMembers(
  familyId: string | null,
  patentId: string,
  members: EpoRawFamilyMember[] | null | undefined,
) {
  if (!familyId || !members || members.length === 0) return [];
  return members.map((member) => ({
    family_id: familyId,
    patent_id: patentId,
    publication_number_docdb:
      canonicalizePublicationNumber(member.publicationNumberDocdb) ?? null,
    jurisdiction_code: member.jurisdictionCode?.trim() || null,
    application_number: member.applicationNumber?.trim() || null,
    status: member.status?.trim() || null,
    filing_date: parseDateSafe(member.filingDate),
    publication_date: parseDateSafe(member.publicationDate),
  }));
}

export function normalizeEpoPublication(raw: EpoRawPublication): NormalizedPatentBundle | null {
  const publication = canonicalizePublicationNumber(raw.publicationNumberDocdb);
  const application = raw.applicationNumber?.trim() || null;
  if (!publication && !application) return null;

  const jurisdiction = raw.jurisdictionCode?.trim().toUpperCase() || null;
  const familyId = raw.familyId?.trim() || null;

  const patent = getBestPatentCore({
    source: "epo",
    publication,
    application,
    title: raw.title,
    abstract: raw.abstract,
    applicants: raw.applicants,
    inventors: raw.inventors,
    filingDate: raw.filingDate,
    publicationDate: raw.publicationDate,
    grantDate: raw.grantDate,
    familyId,
    ipcCodes: raw.ipcCodes,
    cpcCodes: raw.cpcCodes,
    jurisdictions: jurisdiction ? [jurisdiction] : null,
  });

  return {
    patent,
    epoPublication: {
      patent_id: patent.patent_id,
      publication_number_docdb: publication ?? application ?? patent.patent_id,
      application_number: application,
      family_id: familyId,
      jurisdiction_code: jurisdiction,
      title: raw.title?.trim() || null,
      abstract: raw.abstract?.trim() || null,
      applicants: compactStringArray(raw.applicants),
      inventors: compactStringArray(raw.inventors),
      filing_date: parseDateSafe(raw.filingDate),
      publication_date: parseDateSafe(raw.publicationDate),
      grant_date: parseDateSafe(raw.grantDate),
      ipc_codes: compactStringArray(raw.ipcCodes),
      cpc_codes: compactStringArray(raw.cpcCodes),
      raw_xml: raw.rawXml,
    },
    epoFamilyMembers: normalizeFamilyMembers(familyId, patent.patent_id, raw.familyMembers),
  };
}
