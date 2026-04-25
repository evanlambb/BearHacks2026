import assert from "node:assert/strict";
import test from "node:test";

import normalizePatentModule from "./normalizePatent";
import runScoutModule from "./runScout";

const { normalizeEpoPublication, normalizeWipoPublication } = normalizePatentModule as {
  normalizeEpoPublication: (input: Record<string, unknown>) => {
    patent: { patent_id: string; filing_date: string | null; publication_date: string | null };
  } | null;
  normalizeWipoPublication: (input: Record<string, unknown>) => {
    patent: { patent_id: string; filing_date: string | null; publication_date: string | null };
  } | null;
};
const { runScout } = runScoutModule as {
  runScout: (
    scoutId: string,
    deps: { supabase: unknown; wipoClient: unknown; epoClient: unknown },
  ) => Promise<{
    patentsReviewed: number;
    newPatentsSaved: number;
    pendingMatchesCreated: number;
    errors: string[];
  }>;
};

type Row = Record<string, unknown>;
type TableName =
  | "scouts"
  | "patents"
  | "wipo_publications"
  | "epo_publications"
  | "epo_family_members"
  | "scout_patent_matches";

type QueryResult = { data: Row[] | Row | null; error: null | { message: string } };

function splitConflict(conflict: string): string[] {
  return conflict.split(",").map((v) => v.trim());
}

class UpsertBuilder implements PromiseLike<QueryResult> {
  private readonly table: Row[];
  private readonly values: Row | Row[];
  private readonly options: { onConflict?: string; ignoreDuplicates?: boolean };

  constructor(
    table: Row[],
    values: Row | Row[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ) {
    this.table = table;
    this.values = values;
    this.options = options;
  }

  private upsertRows(): Row[] {
    const rows = Array.isArray(this.values) ? this.values : [this.values];
    const inserted: Row[] = [];
    const keys = this.options.onConflict ? splitConflict(this.options.onConflict) : [];

    for (const row of rows) {
      let index = -1;
      if (keys.length > 0) {
        index = this.table.findIndex((candidate) =>
          keys.every((key) => candidate[key] === row[key]),
        );
      }

      if (index >= 0) {
        if (this.options.ignoreDuplicates) continue;
        this.table[index] = { ...this.table[index], ...row };
      } else {
        const withId = row.id ? row : { id: `${this.table.length + 1}`, ...row };
        this.table.push(withId);
        inserted.push(withId);
      }
    }

    return inserted;
  }

  select(): Promise<QueryResult> {
    const inserted = this.upsertRows();
    return Promise.resolve({ data: inserted, error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const inserted = this.upsertRows();
    return Promise.resolve({ data: inserted, error: null }).then(onfulfilled, onrejected);
  }
}

class SelectBuilder {
  private readonly filters: Array<{ key: string; value: unknown }> = [];
  private readonly table: Row[];

  constructor(table: Row[]) {
    this.table = table;
  }

  eq(key: string, value: unknown): this {
    this.filters.push({ key, value });
    return this;
  }

  private run(): Row[] {
    return this.table.filter((row) =>
      this.filters.every((filter) => row[filter.key] === filter.value),
    );
  }

  single(): Promise<QueryResult> {
    const rows = this.run();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: "Not found" },
    });
  }

  maybeSingle(): Promise<QueryResult> {
    const rows = this.run();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: null,
    });
  }

  limit(n: number): Promise<QueryResult> {
    return Promise.resolve({ data: this.run().slice(0, n), error: null });
  }
}

class FakeSupabase {
  readonly tables: Record<TableName, Row[]> = {
    scouts: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        name: "Oncology Scout",
        countries: ["United States", "Japan"],
        therapeutic_area: "Oncology",
        patent_signal_type: "patent_expiry",
        expiry_time_horizon_months: 12,
        non_filed_lookback_years: null,
        modality: "Small Molecule",
        market_floor_usd: null,
        minimum_unit_volume: null,
        capex_min_usd: null,
        capex_max_usd: null,
        status: "active",
        last_run_at: null,
        next_run_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    patents: [],
    wipo_publications: [],
    epo_publications: [],
    epo_family_members: [],
    scout_patent_matches: [],
  };

  from(tableName: string) {
    const table = this.tables[tableName as TableName];
    return {
      select: () => new SelectBuilder(table),
      insert: async (value: Row | Row[]) => {
        const rows = Array.isArray(value) ? value : [value];
        for (const row of rows) {
          table.push({ id: `${table.length + 1}`, ...row });
        }
        return { data: rows, error: null };
      },
      upsert: (
        value: Row | Row[],
        options: { onConflict?: string; ignoreDuplicates?: boolean } = {},
      ) => new UpsertBuilder(table, value, options),
    };
  }
}

test("runScout is idempotent with mocked WIPO/EPO clients", async () => {
  const supabase = new FakeSupabase();
  const scoutId = "11111111-1111-1111-1111-111111111111";

  const wipoClient = {
    async searchPublications() {
      return [
        {
          publicationNumber: "WO 2026/123456",
          applicationNumber: "PCT/US2025/000001",
          title: "Cancer therapy composition",
          abstract: "A therapy for treatment.",
          applicants: ["Acme Bio"],
          inventors: ["Jane Doe"],
          filingDate: "2025-05-01",
          publicationDate: "2026/01/15",
          priorityDate: "2024-12-31",
          ipcCodes: ["A61K31/00"],
          language: "EN",
          rawXml: "<wipo id='1'/>",
        },
        {
          publicationNumber: "WO2026123456",
          applicationNumber: "PCT/US2025/000001",
          title: "Cancer therapy composition duplicate",
          rawXml: "<wipo id='1-dup'/>",
        },
      ];
    },
  };

  const epoClient = {
    async searchPublications() {
      return [
        {
          publicationNumberDocdb: "EP 4455667 A1",
          applicationNumber: "EP2025123456",
          familyId: "FAM-9001",
          jurisdictionCode: "EP",
          title: "Manufacturing route",
          abstract: "A new synthesis route.",
          applicants: ["Acme Bio"],
          inventors: ["John Roe"],
          filingDate: "2025-03-02",
          publicationDate: "2026-01-20",
          grantDate: null,
          ipcCodes: ["C07D401/12"],
          cpcCodes: ["C07D401/12"],
          rawXml: "<epo id='1'/>",
          familyMembers: [
            {
              publicationNumberDocdb: "US 20260123456 A1",
              jurisdictionCode: "US",
              applicationNumber: "US18/123456",
              status: "pending",
              filingDate: "2025-03-02",
              publicationDate: "2026-01-20",
            },
          ],
        },
      ];
    },
  };

  const first = await runScout(scoutId, {
    supabase: supabase as never,
    wipoClient,
    epoClient,
  });
  const second = await runScout(scoutId, {
    supabase: supabase as never,
    wipoClient,
    epoClient,
  });

  assert.equal(first.patentsReviewed, 2);
  assert.equal(first.newPatentsSaved, 2);
  assert.equal(first.pendingMatchesCreated, 2);
  assert.deepEqual(first.errors, []);

  assert.equal(second.patentsReviewed, 2);
  assert.equal(second.newPatentsSaved, 0);
  assert.equal(second.pendingMatchesCreated, 0);
  assert.deepEqual(second.errors, []);

  assert.equal(supabase.tables.patents.length, 2);
  assert.equal(supabase.tables.wipo_publications.length, 1);
  assert.equal(supabase.tables.epo_publications.length, 1);
  assert.equal(supabase.tables.epo_family_members.length, 1);
  assert.equal(supabase.tables.scout_patent_matches.length, 2);
});

test("normalization keeps stable IDs and safe dates", () => {
  const wipo = normalizeWipoPublication({
    publicationNumber: null,
    applicationNumber: "PCT/US2025/999999",
    title: "Fallback ID patent",
    filingDate: "not-a-date",
    publicationDate: "2026-02-11",
    rawXml: "<wipo/>",
  });
  assert.ok(wipo);
  assert.match(wipo!.patent.patent_id, /^wipo-/);
  assert.equal(wipo!.patent.filing_date, null);
  assert.equal(wipo!.patent.publication_date, "2026-02-11");

  const epo = normalizeEpoPublication({
    publicationNumberDocdb: "ep 1234 567 a1",
    applicationNumber: "EP20250001",
    jurisdictionCode: "ep",
    publicationDate: "20260131",
    rawXml: "<epo/>",
  });
  assert.ok(epo);
  assert.equal(epo!.patent.patent_id, "EP1234567A1");
  assert.equal(epo!.patent.publication_date, "2026-01-31");
});
