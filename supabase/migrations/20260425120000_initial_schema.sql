-- ─────────────────────────────────────────────────────────────────────────────
-- Patent Scout — initial schema
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- scouts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.scouts (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  name                        text,
  countries                   text[] not null,
  therapeutic_area            text not null,
  patent_signal_type          text not null check (patent_signal_type in ('patent_expiry', 'non_filed_region')),
  expiry_time_horizon_months  integer,
  non_filed_lookback_years    integer,
  modality                    text not null,
  market_floor_usd            numeric,
  minimum_unit_volume         integer,
  capex_min_usd               numeric,
  capex_max_usd               numeric,
  status                      text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_run_at                 timestamptz,
  next_run_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger scouts_set_updated_at
  before update on public.scouts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- patents (canonical)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.patents (
  id                            uuid primary key default gen_random_uuid(),
  patent_id                     text unique not null,
  canonical_publication_number  text not null,
  title                         text,
  abstract                      text,
  applicants                    text[],
  inventors                     text[],
  filing_date                   date,
  publication_date              date,
  priority_date                 date,
  grant_date                    date,
  family_id                     text,
  jurisdictions                 text[],
  ipc_codes                     text[],
  cpc_codes                     text[],
  source                        text not null default 'wipo_epo',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger patents_set_updated_at
  before update on public.patents
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- wipo_publications (raw feed)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.wipo_publications (
  id                  uuid primary key default gen_random_uuid(),
  patent_id           text references public.patents(patent_id) on delete cascade,
  publication_number  text not null,
  application_number  text,
  title               text,
  abstract            text,
  applicants          text[],
  inventors           text[],
  filing_date         date,
  publication_date    date,
  priority_date       date,
  ipc_codes           text[],
  language            text,
  raw_xml             text,
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- epo_publications (raw feed)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.epo_publications (
  id                        uuid primary key default gen_random_uuid(),
  patent_id                 text references public.patents(patent_id) on delete cascade,
  publication_number_docdb  text not null,
  application_number        text,
  family_id                 text,
  jurisdiction_code         text,
  title                     text,
  abstract                  text,
  applicants                text[],
  inventors                 text[],
  filing_date               date,
  publication_date          date,
  grant_date                date,
  ipc_codes                 text[],
  cpc_codes                 text[],
  raw_xml                   text,
  created_at                timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- epo_family_members
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.epo_family_members (
  id                        uuid primary key default gen_random_uuid(),
  family_id                 text not null,
  patent_id                 text references public.patents(patent_id) on delete cascade,
  publication_number_docdb  text,
  jurisdiction_code         text,
  application_number        text,
  status                    text,
  filing_date               date,
  publication_date          date,
  created_at                timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- scout_patent_matches
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.scout_patent_matches (
  id                       uuid primary key default gen_random_uuid(),
  scout_id                 uuid references public.scouts(id) on delete cascade,
  patent_id                text references public.patents(patent_id) on delete cascade,
  match_status             text not null default 'pending' check (match_status in ('pending', 'matched', 'rejected', 'error')),
  match_score              numeric,
  match_reason             text,
  location_match           boolean,
  therapeutic_area_match   boolean,
  modality_match           boolean,
  reviewed_at              timestamptz,
  created_at               timestamptz not null default now(),
  unique (scout_id, patent_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- opportunity_reports
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.opportunity_reports (
  id                  uuid primary key default gen_random_uuid(),
  scout_id            uuid references public.scouts(id) on delete cascade,
  patent_id           text references public.patents(patent_id) on delete cascade,
  drug_name           text,
  region              text,
  market_size_usd     numeric,
  signal_type         text not null check (signal_type in ('patent_expiry', 'non_filed_region')),
  report_status       text not null default 'pending' check (report_status in ('pending', 'generating', 'complete', 'error')),
  report_json         jsonb,
  report_markdown     text,
  pdf_storage_path    text,
  error_message       text,
  generated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (scout_id, patent_id)
);

create trigger opportunity_reports_set_updated_at
  before update on public.opportunity_reports
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- scout_runs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.scout_runs (
  id                     uuid primary key default gen_random_uuid(),
  scout_id               uuid references public.scouts(id) on delete cascade,
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  status                 text not null default 'running' check (status in ('running', 'complete', 'error')),
  patents_reviewed       integer not null default 0,
  opportunities_found    integer not null default 0,
  error_message          text
);
