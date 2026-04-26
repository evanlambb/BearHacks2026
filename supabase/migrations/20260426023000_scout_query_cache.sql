-- ─────────────────────────────────────────────────────────────────────────────
-- Scout query cache (BigQuery spend guard)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.scout_query_cache (
  scout_id          uuid not null references public.scouts(id) on delete cascade,
  query_fingerprint text not null,
  fetched_at        timestamptz not null default now(),
  primary key (scout_id, query_fingerprint)
);

create index if not exists scout_query_cache_fetched_at_idx
  on public.scout_query_cache (fetched_at desc);

alter table public.scout_query_cache enable row level security;

create policy scout_query_cache_service_role_all
  on public.scout_query_cache for all
  to service_role
  using (true) with check (true);
