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

export async function runScout(scoutId: string, deps: RunScoutDeps = {}): Promise<RunScoutResult> {
  const supabase = deps.supabase ?? (await resolveSupabaseAdmin());
  const defaults =
    deps.wipoClient && deps.epoClient ? null : await resolveDefaultClients();
  const wipoClient = deps.wipoClient ?? defaults!.wipoClient;
  const epoClient = deps.epoClient ?? defaults!.epoClient;
  const errors: string[] = [];

  const scout = await loadScoutOrThrow(supabase, scoutId);
  const query = buildPatentSearchQuery(scout);

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

  return {
    patentsReviewed: capped.patents.length,
    newPatentsSaved,
    pendingMatchesCreated,
    errors,
  };
}
