-- ─────────────────────────────────────────────────────────────────────────────
-- Patent Scout — Row Level Security
--
-- Strategy:
--   * scouts                — owner-only direct access
--   * scout_patent_matches  — readable when parent scout belongs to caller
--   * opportunity_reports   — readable when parent scout belongs to caller
--   * patents / wipo_publications / epo_publications / epo_family_members
--                          — NOT exposed to authenticated clients directly.
--                            Patent metadata is served through server routes
--                            using the service role. RLS is enabled with no
--                            authenticated policies => deny by default.
--   * scout_runs            — owner-readable through parent scout
--   * service_role          — bypasses RLS automatically; explicit ALL policy
--                            added for clarity / safety.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scouts                 enable row level security;
alter table public.patents                enable row level security;
alter table public.wipo_publications      enable row level security;
alter table public.epo_publications       enable row level security;
alter table public.epo_family_members     enable row level security;
alter table public.scout_patent_matches   enable row level security;
alter table public.opportunity_reports    enable row level security;
alter table public.scout_runs             enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- scouts — owner CRUD
-- ─────────────────────────────────────────────────────────────────────────────
create policy scouts_select_own
  on public.scouts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy scouts_insert_own
  on public.scouts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy scouts_update_own
  on public.scouts for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy scouts_delete_own
  on public.scouts for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy scouts_service_role_all
  on public.scouts for all
  to service_role
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- scout_patent_matches — read-only, gated on owning scout
-- ─────────────────────────────────────────────────────────────────────────────
create policy scout_patent_matches_select_own
  on public.scout_patent_matches for select
  to authenticated
  using (
    exists (
      select 1
      from public.scouts s
      where s.id = scout_patent_matches.scout_id
        and s.user_id = (select auth.uid())
    )
  );

create policy scout_patent_matches_service_role_all
  on public.scout_patent_matches for all
  to service_role
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- opportunity_reports — read-only, gated on owning scout
-- ─────────────────────────────────────────────────────────────────────────────
create policy opportunity_reports_select_own
  on public.opportunity_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.scouts s
      where s.id = opportunity_reports.scout_id
        and s.user_id = (select auth.uid())
    )
  );

create policy opportunity_reports_service_role_all
  on public.opportunity_reports for all
  to service_role
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- scout_runs — read-only, gated on owning scout
-- ─────────────────────────────────────────────────────────────────────────────
create policy scout_runs_select_own
  on public.scout_runs for select
  to authenticated
  using (
    exists (
      select 1
      from public.scouts s
      where s.id = scout_runs.scout_id
        and s.user_id = (select auth.uid())
    )
  );

create policy scout_runs_service_role_all
  on public.scout_runs for all
  to service_role
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- patents / raw publication tables — service role only.
-- No authenticated policies => RLS denies by default.
-- Patent metadata is served via server routes that use the service role
-- and authorize against the caller's scout/report ownership.
-- ─────────────────────────────────────────────────────────────────────────────
create policy patents_service_role_all
  on public.patents for all
  to service_role
  using (true) with check (true);

create policy wipo_publications_service_role_all
  on public.wipo_publications for all
  to service_role
  using (true) with check (true);

create policy epo_publications_service_role_all
  on public.epo_publications for all
  to service_role
  using (true) with check (true);

create policy epo_family_members_service_role_all
  on public.epo_family_members for all
  to service_role
  using (true) with check (true);
