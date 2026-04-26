import crypto from "node:crypto";

import type {
  EpoFamilyMemberInsert,
  EpoPublicationInsert,
  PatentInsert,
  ScoutRow,
  WipoPublicationInsert,
} from "../../lib/supabase";

import { normalizeEpoPublication, normalizeWipoPublication } from "./normalizePatent";
import { buildPatentSearchQuery } from "./queryBuilder";
import type {
  EpoRawPublication,
  IEpoClient,
  IWipoClient,
  RunScoutResult,
  WipoRawPublication,
} from "./types";

type SupabaseLike = {
  from: (table: string) => any;
};

type RunScoutDeps = {
  supabase?: SupabaseLike;
  wipoClient?: IWipoClient;
  epoClient?: IEpoClient;
};

async function resolveSupabaseAdmin(): Promise<SupabaseLike> {
  const mod = await import("../../lib/supabase/admin");
  return mod.getSupabaseAdmin() as unknown as SupabaseLike;
}

async function resolveDefaultClients(): Promise<{ wipoClient: IWipoClient; epoClient: IEpoClient }> {
  const bigQueryModule = await import("./bigQueryClient");
  const sharedClient = new bigQueryModule.BigQueryPatentClient();
  return {
    wipoClient: new bigQueryModule.BigQueryWipoClient(sharedClient),
    epoClient: new bigQueryModule.BigQueryEpoClient(sharedClient),
  };
}

async function loadScoutOrThrow(supabase: SupabaseLike, scoutId: string): Promise<ScoutRow> {
  const { data, error } = await supabase.from("scouts").select("*").eq("id", scoutId).single();
  if (error || !data) throw new Error(error?.message ?? "Scout not found");
  return data as ScoutRow;
}

async function upsertPatent(supabase: SupabaseLike, patent: PatentInsert): Promise<boolean> {
  const { data: existing, error: findError } = await supabase
    .from("patents")
    .select("id")
    .eq("patent_id", patent.patent_id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  const { error } = await supabase.from("patents").upsert(patent, {
    onConflict: "patent_id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
  return !existing;
}

async function ensureWipoPublication(
  supabase: SupabaseLike,
  publication: WipoPublicationInsert,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("wipo_publications")
    .select("id")
    .eq("patent_id", publication.patent_id ?? "")
    .eq("publication_number", publication.publication_number)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if ((existing ?? []).length > 0) return;

  const { error } = await supabase.from("wipo_publications").insert(publication);
  if (error) throw new Error(error.message);
}

async function ensureEpoPublication(
  supabase: SupabaseLike,
  publication: EpoPublicationInsert,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("epo_publications")
    .select("id")
    .eq("patent_id", publication.patent_id ?? "")
    .eq("publication_number_docdb", publication.publication_number_docdb)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if ((existing ?? []).length > 0) return;

  const { error } = await supabase.from("epo_publications").insert(publication);
  if (error) throw new Error(error.message);
}

async function ensureFamilyMember(
  supabase: SupabaseLike,
  member: EpoFamilyMemberInsert,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("epo_family_members")
    .select("id")
    .eq("family_id", member.family_id)
    .eq("publication_number_docdb", member.publication_number_docdb ?? "")
    .eq("application_number", member.application_number ?? "")
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if ((existing ?? []).length > 0) return;

  const { error } = await supabase.from("epo_family_members").insert(member);
  if (error) throw new Error(error.message);
}

async function createPendingScoutMatch(
  supabase: SupabaseLike,
  scoutId: string,
  patentId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("scout_patent_matches")
    .upsert(
      {
        scout_id: scoutId,
        patent_id: patentId,
        match_status: "pending",
      },
      { onConflict: "scout_id,patent_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

function dedupePatents(patents: PatentInsert[]): PatentInsert[] {
  const byKey = new Map<string, PatentInsert>();
  for (const patent of patents) {
    const canonical = patent.canonical_publication_number || "";
    const key = `${patent.patent_id}::${canonical}`;
    if (byKey.has(key)) continue;
    byKey.set(key, patent);
  }
  return [...byKey.values()];
}

function buildQueryFingerprint(input: {
  therapeutic_area: string;
  modality: string;
  countries: string[];
  patent_signal_type: string;
  expiry_time_horizon_months: number | null;
  non_filed_lookback_years: number | null;
}) {
  const canonical = JSON.stringify({
    therapeutic_area: input.therapeutic_area.trim().toLowerCase(),
    modality: input.modality.trim().toLowerCase(),
    countries: [...input.countries].map((c) => c.trim().toLowerCase()).sort(),
    patent_signal_type: input.patent_signal_type,
    expiry_time_horizon_months: input.expiry_time_horizon_months,
    non_filed_lookback_years: input.non_filed_lookback_years,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

async function hasFreshScoutQueryCache(
  supabase: SupabaseLike,
  scoutId: string,
  queryFingerprint: string,
): Promise<boolean> {
  const bypassCache = process.env.SCOUT_BIGQUERY_CACHE_BYPASS === "true";
  if (bypassCache) return false;

  const cacheHours = Number(process.env.SCOUT_BIGQUERY_CACHE_HOURS ?? 24);
  if (!Number.isFinite(cacheHours) || cacheHours <= 0) return false;
  const cutoffIso = new Date(Date.now() - cacheHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("scout_query_cache")
    .select("fetched_at")
    .eq("scout_id", scoutId)
    .eq("query_fingerprint", queryFingerprint)
    .gte("fetched_at", cutoffIso)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function upsertScoutQueryCache(
  supabase: SupabaseLike,
  scoutId: string,
  queryFingerprint: string,
): Promise<void> {
  const { error } = await supabase.from("scout_query_cache").upsert(
    {
      scout_id: scoutId,
      query_fingerprint: queryFingerprint,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "scout_id,query_fingerprint", ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);
}

export async function runScout(scoutId: string, deps: RunScoutDeps = {}): Promise<RunScoutResult> {
  const supabase = deps.supabase ?? (await resolveSupabaseAdmin());
  const defaults =
    deps.wipoClient && deps.epoClient ? null : await resolveDefaultClients();
  const wipoClient = deps.wipoClient ?? defaults!.wipoClient;
  const epoClient = deps.epoClient ?? defaults!.epoClient;
  const errors: string[] = [];

  const scout = await loadScoutOrThrow(supabase, scoutId);
  const query = buildPatentSearchQuery(scout);
  const queryFingerprint = buildQueryFingerprint({
    therapeutic_area: scout.therapeutic_area,
    modality: scout.modality,
    countries: scout.countries,
    patent_signal_type: scout.patent_signal_type,
    expiry_time_horizon_months: scout.expiry_time_horizon_months,
    non_filed_lookback_years: scout.non_filed_lookback_years,
  });

  if (await hasFreshScoutQueryCache(supabase, scout.id, queryFingerprint)) {
    return {
      patentsReviewed: 0,
      newPatentsSaved: 0,
      pendingMatchesCreated: 0,
      errors,
    };
  }

  let wipoRaw: WipoRawPublication[] = [];
  let epoRaw: EpoRawPublication[] = [];
  try {
    wipoRaw = await wipoClient.searchPublications({ query });
  } catch (error) {
    errors.push(`WIPO search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    epoRaw = await epoClient.searchPublications({ query });
  } catch (error) {
    errors.push(`EPO search failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const normalized = [
    ...wipoRaw.map(normalizeWipoPublication).filter((v) => v !== null),
    ...epoRaw.map(normalizeEpoPublication).filter((v) => v !== null),
  ];

  const uniquePatents = dedupePatents(normalized.map((entry) => entry.patent));

  const ingestMax = Number(process.env.SCOUT_INGEST_MAX_PATENTS ?? "");
  const capped =
    Number.isFinite(ingestMax) && ingestMax > 0
      ? (() => {
          const patents = uniquePatents.slice(0, ingestMax);
          const allowed = new Set(patents.map((p) => p.patent_id));
          const bundles = normalized.filter((b) => allowed.has(b.patent.patent_id));
          return { patents, bundles };
        })()
      : { patents: uniquePatents, bundles: normalized };

  let newPatentsSaved = 0;
  let pendingMatchesCreated = 0;

  for (const patent of capped.patents) {
    try {
      const isNew = await upsertPatent(supabase, patent);
      if (isNew) newPatentsSaved += 1;
    } catch (error) {
      errors.push(
        `Patent upsert failed for ${patent.patent_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  for (const bundle of capped.bundles) {
    try {
      if (bundle.wipoPublication) await ensureWipoPublication(supabase, bundle.wipoPublication);
      if (bundle.epoPublication) await ensureEpoPublication(supabase, bundle.epoPublication);
      for (const member of bundle.epoFamilyMembers) {
        await ensureFamilyMember(supabase, member);
      }
      pendingMatchesCreated += await createPendingScoutMatch(
        supabase,
        scout.id,
        bundle.patent.patent_id,
      );
    } catch (error) {
      errors.push(
        `Persistence failed for ${bundle.patent.patent_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (errors.length === 0) {
    await upsertScoutQueryCache(supabase, scout.id, queryFingerprint);
  }

  return {
    patentsReviewed: capped.patents.length,
    newPatentsSaved,
    pendingMatchesCreated,
    errors,
  };
}
