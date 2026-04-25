-- ─────────────────────────────────────────────────────────────────────────────
-- Patent Scout — indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists scouts_user_id_idx
  on public.scouts (user_id);

create index if not exists scouts_next_run_at_status_idx
  on public.scouts (next_run_at, status);

create index if not exists patents_patent_id_idx
  on public.patents (patent_id);

create index if not exists patents_canonical_publication_number_idx
  on public.patents (canonical_publication_number);

create index if not exists wipo_publications_patent_id_idx
  on public.wipo_publications (patent_id);

create index if not exists epo_publications_patent_id_idx
  on public.epo_publications (patent_id);

create index if not exists epo_publications_family_id_idx
  on public.epo_publications (family_id);

create index if not exists epo_family_members_family_id_idx
  on public.epo_family_members (family_id);

create index if not exists scout_patent_matches_scout_id_patent_id_idx
  on public.scout_patent_matches (scout_id, patent_id);

create index if not exists opportunity_reports_scout_id_patent_id_idx
  on public.opportunity_reports (scout_id, patent_id);

create index if not exists opportunity_reports_report_status_idx
  on public.opportunity_reports (report_status);
