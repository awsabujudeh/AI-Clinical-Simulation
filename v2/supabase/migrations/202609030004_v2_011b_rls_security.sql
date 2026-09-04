-- V2-011B: final client-facing RLS and grant boundary for the 28 V2-011
-- application tables. Trusted atomic Session writes remain V2-012 scope.

create function public.current_user_has_active_membership(
  target_institution_id public.institution_identifier,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_memberships as membership
    where membership.user_id = (select auth.uid())
      and (
        target_institution_id is null
        or membership.institution_id = target_institution_id
      )
      and membership.membership_status = 'ACTIVE'
      and membership.membership_role = any (allowed_roles)
  );
$$;

revoke all on function public.current_user_has_active_membership(
  public.institution_identifier,
  text[]
) from public, anon;

grant execute on function public.current_user_has_active_membership(
  public.institution_identifier,
  text[]
) to authenticated, service_role;

-- Remove any platform-default table/sequence capabilities before adding the
-- narrow audited client surface below. service_role is the future trusted
-- backend principal and bypasses RLS in Supabase; no credential is stored here.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Normal clients may read only their own identity/membership metadata.
grant select on table
  public.institutions,
  public.profiles,
  public.institution_memberships
to authenticated;

grant update (display_alias, preferred_locale)
on table public.profiles
to authenticated;

-- Faculty authoring reads are institution-scoped. Mutation remains denied
-- until the future assignment/workflow model is explicitly authorized.
grant select on table
  public.clinical_cases,
  public.case_versions,
  public.case_modules,
  public.clinical_sources,
  public.clinical_source_versions,
  public.case_source_links,
  public.curriculum_sources,
  public.curriculum_source_versions,
  public.learning_objectives,
  public.curriculum_mappings
to authenticated;

create policy institutions_select_active_membership
on public.institutions
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['LEARNER', 'FACULTY', 'REVIEWER']::text[]
  )
);

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy profiles_update_safe_own
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy institution_memberships_select_own
on public.institution_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

create policy clinical_cases_select_own_institution_faculty
on public.clinical_cases
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy case_versions_select_own_institution_faculty
on public.case_versions
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy case_modules_select_own_institution_faculty
on public.case_modules
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy clinical_sources_select_faculty_scope
on public.clinical_sources
for select
to authenticated
using (
  public.current_user_has_active_membership(
    case
      when source_scope = 'GLOBAL' then null
      else owner_institution_id
    end,
    array['FACULTY']::text[]
  )
);

create policy clinical_source_versions_select_faculty_scope
on public.clinical_source_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.clinical_sources as source
    where source.source_id = clinical_source_versions.source_id
  )
);

create policy case_source_links_select_own_institution_faculty
on public.case_source_links
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy curriculum_sources_select_own_institution_faculty
on public.curriculum_sources
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy curriculum_source_versions_select_own_institution_faculty
on public.curriculum_source_versions
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy learning_objectives_select_own_institution_faculty
on public.learning_objectives
for select
to authenticated
using (
  public.current_user_has_active_membership(
    institution_id,
    array['FACULTY']::text[]
  )
);

create policy curriculum_mappings_select_case_owner_faculty
on public.curriculum_mappings
for select
to authenticated
using (
  public.current_user_has_active_membership(
    case_owner_institution_id,
    array['FACULTY']::text[]
  )
);

-- FORCE closes accidental table-owner bypass. Supabase service_role retains
-- its platform BYPASSRLS trusted-backend behavior; tests use non-owner roles.
alter table public.institutions force row level security;
alter table public.profiles force row level security;
alter table public.institution_memberships force row level security;
alter table public.clinical_cases force row level security;
alter table public.case_versions force row level security;
alter table public.case_modules force row level security;
alter table public.clinical_sources force row level security;
alter table public.clinical_source_versions force row level security;
alter table public.case_source_links force row level security;
alter table public.curriculum_sources force row level security;
alter table public.curriculum_source_versions force row level security;
alter table public.learning_objectives force row level security;
alter table public.curriculum_mappings force row level security;
alter table public.case_reviews force row level security;
alter table public.case_approvals force row level security;
alter table public.case_approval_review_refs force row level security;
alter table public.review_execution_artifacts force row level security;
alter table public.case_packages force row level security;
alter table public.media_assets force row level security;
alter table public.visual_manifests force row level security;
alter table public.simulation_sessions force row level security;
alter table public.session_commands force row level security;
alter table public.session_events force row level security;
alter table public.patient_state_checkpoints force row level security;
alter table public.assessments force row level security;
alter table public.assessment_domain_scores force row level security;
alter table public.assessment_findings force row level security;
alter table public.assessment_debriefs force row level security;
