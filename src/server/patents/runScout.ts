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
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          eq: (column: string, value: unknown) => {
            limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
          limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
          single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
        };
        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
        single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    upsert: (
      value: unknown,
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => Promise<{ data: unknown; error: { message: string } | null }> & {
      select: (columns: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    insert: (value: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
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
  const [wipoModule, epoModule] = await Promise.all([import("./wipoClient"), import("./epoClient")]);
  return {
    wipoClient: new wipoModule.WipoClient(),
    epoClient: new epoModule.EpoClient(),
  };
}

async function loadScoutOrThrow(supabase: SupabaseLike, scoutId: string): Promise<ScoutRow> {
  const { data, error } = await supabase.from("scouts").select("*").eq("id", scoutId).single();
  if (error || !data) throw new Error(error?.message ?? "Scout not found");
  return data;
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

  let newPatentsSaved = 0;
  let pendingMatchesCreated = 0;

  for (const patent of uniquePatents) {
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

  for (const bundle of normalized) {
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
    patentsReviewed: uniquePatents.length,
    newPatentsSaved,
    pendingMatchesCreated,
    errors,
  };
}
