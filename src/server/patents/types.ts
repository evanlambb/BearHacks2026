import type {
  EpoFamilyMemberInsert,
  EpoPublicationInsert,
  PatentInsert,
  ScoutRow,
  WipoPublicationInsert,
} from "../../lib/supabase";

export type PatentSearchQuery = {
  textQuery: string;
  countries: string[];
  signalType: ScoutRow["patent_signal_type"];
  expiryTimeHorizonMonths: number | null;
  nonFiledLookbackYears: number | null;
};

export type WipoSearchParams = {
  query: PatentSearchQuery;
  page?: number;
  pageSize?: number;
};

export type EpoSearchParams = {
  query: PatentSearchQuery;
  page?: number;
  pageSize?: number;
};

export type WipoRawPublication = {
  publicationNumber?: string | null;
  applicationNumber?: string | null;
  title?: string | null;
  abstract?: string | null;
  applicants?: string[] | null;
  inventors?: string[] | null;
  filingDate?: string | null;
  publicationDate?: string | null;
  priorityDate?: string | null;
  ipcCodes?: string[] | null;
  language?: string | null;
  rawXml: string;
};

export type EpoRawFamilyMember = {
  publicationNumberDocdb?: string | null;
  jurisdictionCode?: string | null;
  applicationNumber?: string | null;
  status?: string | null;
  filingDate?: string | null;
  publicationDate?: string | null;
};

export type EpoRawPublication = {
  publicationNumberDocdb?: string | null;
  applicationNumber?: string | null;
  familyId?: string | null;
  jurisdictionCode?: string | null;
  title?: string | null;
  abstract?: string | null;
  applicants?: string[] | null;
  inventors?: string[] | null;
  filingDate?: string | null;
  publicationDate?: string | null;
  grantDate?: string | null;
  ipcCodes?: string[] | null;
  cpcCodes?: string[] | null;
  rawXml: string;
  familyMembers?: EpoRawFamilyMember[] | null;
};

export interface IWipoClient {
  searchPublications(params: WipoSearchParams): Promise<WipoRawPublication[]>;
}

export interface IEpoClient {
  searchPublications(params: EpoSearchParams): Promise<EpoRawPublication[]>;
}

export type NormalizedPatentBundle = {
  patent: PatentInsert;
  wipoPublication?: WipoPublicationInsert;
  epoPublication?: EpoPublicationInsert;
  epoFamilyMembers: EpoFamilyMemberInsert[];
};

export type RunScoutResult = {
  patentsReviewed: number;
  newPatentsSaved: number;
  pendingMatchesCreated: number;
  errors: string[];
};
