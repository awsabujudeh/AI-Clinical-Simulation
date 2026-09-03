-- V2-011A: immutable-history protection and fail-closed RLS scaffolding.
-- V2-011B owns the complete tenant/role policy and grant matrix.

create function public.reject_immutable_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I is append-only and cannot be updated or deleted', tg_table_name);
end;
$$;

revoke execute on function public.reject_immutable_history_mutation() from public;

create trigger review_execution_artifacts_are_immutable
before update or delete on public.review_execution_artifacts
for each row execute function public.reject_immutable_history_mutation();

create trigger case_packages_are_immutable
before update or delete on public.case_packages
for each row execute function public.reject_immutable_history_mutation();

create trigger session_events_are_immutable
before update or delete on public.session_events
for each row execute function public.reject_immutable_history_mutation();

create trigger patient_state_checkpoints_are_immutable
before update or delete on public.patient_state_checkpoints
for each row execute function public.reject_immutable_history_mutation();

create trigger assessments_are_immutable
before update or delete on public.assessments
for each row execute function public.reject_immutable_history_mutation();

create trigger assessment_domain_scores_are_immutable
before update or delete on public.assessment_domain_scores
for each row execute function public.reject_immutable_history_mutation();

create trigger assessment_findings_are_immutable
before update or delete on public.assessment_findings
for each row execute function public.reject_immutable_history_mutation();

create trigger assessment_debriefs_are_immutable
before update or delete on public.assessment_debriefs
for each row execute function public.reject_immutable_history_mutation();

-- No client policies are installed in Slice A. Enabling RLS without policies is
-- intentionally fail-closed for non-owner roles until V2-011B is reviewed.
alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.clinical_cases enable row level security;
alter table public.case_versions enable row level security;
alter table public.case_modules enable row level security;
alter table public.clinical_sources enable row level security;
alter table public.clinical_source_versions enable row level security;
alter table public.case_source_links enable row level security;
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_source_versions enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.curriculum_mappings enable row level security;
alter table public.case_reviews enable row level security;
alter table public.case_approvals enable row level security;
alter table public.case_approval_review_refs enable row level security;
alter table public.review_execution_artifacts enable row level security;
alter table public.case_packages enable row level security;
alter table public.media_assets enable row level security;
alter table public.visual_manifests enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.session_commands enable row level security;
alter table public.session_events enable row level security;
alter table public.patient_state_checkpoints enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_domain_scores enable row level security;
alter table public.assessment_findings enable row level security;
alter table public.assessment_debriefs enable row level security;
