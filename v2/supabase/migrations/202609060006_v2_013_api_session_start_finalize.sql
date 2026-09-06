-- V2-013: trusted API initialization and terminal Session persistence.
-- No clinical decision is made in this migration.

alter table public.simulation_sessions
  drop constraint simulation_sessions_session_status_check;
alter table public.simulation_sessions
  add constraint simulation_sessions_session_status_check
  check (session_status in ('ACTIVE', 'ENDED'));

alter table public.simulation_sessions
  add column start_idempotency_key public.contract_identifier,
  add column start_request_hash public.sha256_hex,
  add constraint simulation_sessions_start_idempotency_pair_check check (
    (start_idempotency_key is null and start_request_hash is null)
    or (start_idempotency_key is not null and start_request_hash is not null)
  );

create unique index simulation_sessions_start_idempotency_unique
  on public.simulation_sessions(learner_user_id, start_idempotency_key)
  where start_idempotency_key is not null;

create or replace function public.start_authoritative_session_v2_013(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aggregate jsonb := p_request -> 'aggregate';
  v_session_id text := v_aggregate ->> 'session_id';
  v_institution_id text := p_request ->> 'institution_id';
  v_user_id uuid := nullif(p_request ->> 'principal_user_id', '')::uuid;
  v_membership_id text := p_request ->> 'membership_id';
  v_idempotency_key text := p_request ->> 'idempotency_key';
  v_request_hash text := p_request ->> 'request_hash';
  v_role text;
  v_existing public.simulation_sessions%rowtype;
begin
  if jsonb_typeof(p_request) <> 'object'
    or jsonb_typeof(v_aggregate) <> 'object'
    or v_session_id is null
    or v_institution_id is null
    or v_user_id is null
    or v_membership_id is null
    or v_idempotency_key is null
    or v_request_hash is null
    or (v_aggregate ->> 'status') <> 'ACTIVE'
    or (v_aggregate ->> 'next_sequence_no')::bigint <> 1
    or jsonb_array_length(v_aggregate -> 'committed_events') <> 0
    or jsonb_array_length(v_aggregate -> 'idempotency_records') <> 0
    or v_aggregate ? 'finalization'
  then
    return jsonb_build_object('status', 'INVALID_START');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || v_idempotency_key, 13013)
  );

  select * into v_existing
  from public.simulation_sessions
  where learner_user_id = v_user_id
    and start_idempotency_key = v_idempotency_key;
  if found then
    if v_existing.start_request_hash = v_request_hash then
      return jsonb_build_object(
        'status', 'REPLAYED',
        'aggregate', v_existing.aggregate_payload
      );
    end if;
    return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
  end if;

  select membership.membership_role into v_role
  from public.institution_memberships as membership
  where membership.membership_id = v_membership_id
    and membership.institution_id = v_institution_id
    and membership.user_id = v_user_id
    and membership.membership_status = 'ACTIVE';
  if not found then
    return jsonb_build_object('status', 'UNAUTHORIZED');
  end if;
  if (
    (v_aggregate #>> '{pinned_case,execution_authority}') = 'PUBLISHED_PRODUCTION'
    and v_role <> 'LEARNER'
  ) or (
    (v_aggregate #>> '{pinned_case,execution_authority}') = 'REVIEW_ONLY'
    and v_role not in ('FACULTY', 'REVIEWER')
  ) then
    return jsonb_build_object('status', 'UNAUTHORIZED');
  end if;

  insert into public.simulation_sessions (
    session_id, institution_id, learner_user_id, learner_membership_id,
    aggregate_schema_version, session_status, simulation_mode,
    execution_authority, case_package_id, case_version_id, case_version,
    published_package_hash, review_execution_hash, review_subject_hash,
    patient_state_version, clinical_time_seconds, clock_status,
    next_event_sequence, trusted_real_time_anchor_utc,
    patient_state_payload, scheduler_state_payload, clinical_clock_payload,
    aggregate_payload, start_idempotency_key, start_request_hash
  ) values (
    v_session_id, v_institution_id, v_user_id, v_membership_id,
    v_aggregate ->> 'aggregate_schema_version', v_aggregate ->> 'status',
    v_aggregate ->> 'mode', v_aggregate #>> '{pinned_case,execution_authority}',
    v_aggregate #>> '{pinned_case,case_package_id}',
    v_aggregate #>> '{pinned_case,case_version_id}',
    v_aggregate #>> '{pinned_case,case_version}',
    nullif(v_aggregate #>> '{pinned_case,package_hash}', ''),
    nullif(v_aggregate #>> '{pinned_case,review_execution_hash}', ''),
    nullif(v_aggregate #>> '{pinned_case,review_subject_hash}', ''),
    (v_aggregate #>> '{patient_state,state_version}')::bigint,
    (v_aggregate #>> '{patient_state,clinical_time}')::numeric,
    v_aggregate #>> '{clinical_clock,status}',
    (v_aggregate ->> 'next_sequence_no')::bigint,
    nullif(v_aggregate ->> 'trusted_real_time_anchor_utc', '')::timestamptz,
    v_aggregate -> 'patient_state', v_aggregate -> 'scheduler_state',
    v_aggregate -> 'clinical_clock', v_aggregate,
    v_idempotency_key, v_request_hash
  );

  insert into public.patient_state_checkpoints (
    session_id, state_schema_version, patient_state_version,
    last_event_sequence, clinical_time_seconds, clock_status,
    trusted_real_time_anchor_utc, patient_state_payload,
    scheduler_state_payload, clinical_clock_payload, aggregate_payload,
    checkpoint_hash
  ) values (
    v_session_id, v_aggregate #>> '{patient_state,state_schema_version}',
    (v_aggregate #>> '{patient_state,state_version}')::bigint, 0,
    (v_aggregate #>> '{patient_state,clinical_time}')::numeric,
    v_aggregate #>> '{clinical_clock,status}',
    nullif(v_aggregate ->> 'trusted_real_time_anchor_utc', '')::timestamptz,
    v_aggregate -> 'patient_state', v_aggregate -> 'scheduler_state',
    v_aggregate -> 'clinical_clock', v_aggregate, null
  );

  return jsonb_build_object('status', 'CREATED', 'aggregate', v_aggregate);
exception
  when foreign_key_violation or check_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('status', 'INVALID_START');
end;
$$;

create or replace function public.commit_authoritative_session_v2_013(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposed jsonb := p_request -> 'proposed_session';
  v_active_request jsonb;
  v_active_proposed jsonb;
  v_commit jsonb;
  v_session public.simulation_sessions%rowtype;
  v_last_event jsonb;
begin
  if (v_proposed ->> 'status') <> 'ENDED' then
    return public.commit_authoritative_session_v2_012a(p_request);
  end if;

  select * into v_session
  from public.simulation_sessions
  where session_id = p_request ->> 'session_id'
  for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_session.session_status <> 'ACTIVE'
    or jsonb_typeof(v_proposed -> 'finalization') <> 'object'
    or jsonb_array_length(v_proposed -> 'committed_events') = 0
  then
    return jsonb_build_object('status', 'AUTHORITY_MISMATCH');
  end if;
  v_last_event := v_proposed -> 'committed_events'
    -> (jsonb_array_length(v_proposed -> 'committed_events') - 1);
  if (v_last_event ->> 'event_type') <> 'SIMULATION_ENDED'
    or (v_last_event ->> 'event_id') <> (v_proposed #>> '{finalization,event_id}')
    or (v_last_event ->> 'sequence_no')::bigint
      <> (v_proposed #>> '{finalization,event_sequence}')::bigint
    or (v_proposed #>> '{clinical_clock,status}') <> 'PAUSED'
  then
    return jsonb_build_object('status', 'INVALID_COMMIT');
  end if;

  -- Let the existing V2-012 transaction primitive persist all pre-terminal
  -- synchronized work. The terminal Event and checkpoint are then appended
  -- below in this same transaction; historical checkpoints are never updated.
  v_active_proposed := v_proposed - 'finalization';
  v_active_proposed := jsonb_set(v_active_proposed, '{status}', '"ACTIVE"'::jsonb, false);
  v_active_proposed := jsonb_set(
    v_active_proposed,
    '{committed_events}',
    (v_proposed -> 'committed_events')
      - (jsonb_array_length(v_proposed -> 'committed_events') - 1),
    false
  );
  v_active_proposed := jsonb_set(
    v_active_proposed,
    '{next_sequence_no}',
    to_jsonb((v_proposed ->> 'next_sequence_no')::bigint - 1),
    false
  );
  v_active_request := jsonb_set(
    p_request,
    '{proposed_session}',
    v_active_proposed,
    false
  );
  if v_active_proposed is not distinct from v_session.aggregate_payload then
    if (p_request #>> '{expected_token,token_schema_version}') <> '1.0'
      or (p_request #>> '{expected_token,session_id}') <> v_session.session_id
      or (p_request #>> '{expected_token,patient_state_version}')::bigint
        <> v_session.patient_state_version
      or (p_request #>> '{expected_token,next_event_sequence}')::bigint
        <> v_session.next_event_sequence
      or (p_request #>> '{expected_token,clock_status}') <> v_session.clock_status
      or (p_request #>> '{expected_token,clinical_time}')::numeric
        <> v_session.clinical_time_seconds
      or (p_request #>> '{expected_token,trusted_real_time_anchor_utc}')::timestamptz
        is distinct from v_session.trusted_real_time_anchor_utc
    then
      return jsonb_build_object('status', 'VERSION_CONFLICT');
    end if;
    v_commit := jsonb_build_object('status', 'COMMITTED');
  else
    v_commit := public.commit_authoritative_session_v2_012a(v_active_request);
  end if;
  if v_commit ->> 'status' <> 'COMMITTED' then
    return v_commit;
  end if;

  insert into public.session_events (
    event_id, session_id, event_sequence, event_schema_version,
    clinical_time_seconds, real_time_utc, actor_type, actor_id,
    event_source, correlation_id, causation_event_id, action_request_id,
    action_id, rule_id, event_type, event_status, state_version_before,
    state_version_after, idempotency_key, supersedes_event_id, envelope_payload
  ) values (
    (v_last_event ->> 'event_id')::uuid,
    p_request ->> 'session_id',
    (v_last_event ->> 'sequence_no')::bigint,
    v_last_event ->> 'event_schema_version',
    (v_last_event ->> 'clinical_time')::numeric,
    (v_last_event ->> 'real_time_utc')::timestamptz,
    v_last_event ->> 'actor_type',
    nullif(v_last_event ->> 'actor_id', ''),
    v_last_event ->> 'source',
    v_last_event ->> 'correlation_id',
    nullif(v_last_event ->> 'causation_event_id', '')::uuid,
    nullif(v_last_event ->> 'action_request_id', ''),
    nullif(v_last_event ->> 'action_id', ''),
    nullif(v_last_event ->> 'rule_id', ''),
    v_last_event ->> 'event_type',
    v_last_event ->> 'status',
    nullif(v_last_event ->> 'state_version_before', '')::bigint,
    nullif(v_last_event ->> 'state_version_after', '')::bigint,
    v_last_event ->> 'idempotency_key',
    nullif(v_last_event ->> 'supersedes_event_id', '')::uuid,
    v_last_event
  );

  insert into public.patient_state_checkpoints (
    session_id, state_schema_version, patient_state_version,
    last_event_sequence, clinical_time_seconds, clock_status,
    trusted_real_time_anchor_utc, patient_state_payload,
    scheduler_state_payload, clinical_clock_payload, aggregate_payload,
    checkpoint_hash
  ) values (
    p_request ->> 'session_id',
    v_proposed #>> '{patient_state,state_schema_version}',
    (v_proposed #>> '{patient_state,state_version}')::bigint,
    (v_proposed ->> 'next_sequence_no')::bigint - 1,
    (v_proposed #>> '{patient_state,clinical_time}')::numeric,
    v_proposed #>> '{clinical_clock,status}',
    nullif(v_proposed ->> 'trusted_real_time_anchor_utc', '')::timestamptz,
    v_proposed -> 'patient_state',
    v_proposed -> 'scheduler_state',
    v_proposed -> 'clinical_clock',
    v_proposed,
    null
  );

  update public.simulation_sessions
  set session_status = 'ENDED',
      finalized_at = (v_proposed #>> '{finalization,finalized_at_utc}')::timestamptz,
      next_event_sequence = (v_proposed ->> 'next_sequence_no')::bigint,
      aggregate_payload = v_proposed
  where session_id = p_request ->> 'session_id';

  return jsonb_build_object('status', 'COMMITTED', 'aggregate', v_proposed);
end;
$$;

revoke all on function public.start_authoritative_session_v2_013(jsonb)
  from public, anon, authenticated;
revoke all on function public.commit_authoritative_session_v2_013(jsonb)
  from public, anon, authenticated;
grant execute on function public.start_authoritative_session_v2_013(jsonb)
  to service_role;
grant execute on function public.commit_authoritative_session_v2_013(jsonb)
  to service_role;

comment on function public.start_authoritative_session_v2_013(jsonb) is
  'V2-013 trusted atomic Session plus initial checkpoint creation; contains no clinical logic.';
comment on function public.commit_authoritative_session_v2_013(jsonb) is
  'V2-013 storage-only extension permitting the frozen ACTIVE to ENDED Session transition.';

create or replace function public.resolve_api_production_case_v2_013(
  p_user_id uuid,
  p_case_id public.namespaced_identifier
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
begin
  select membership.membership_id, membership.institution_id,
    membership.membership_role, package.package_payload
  into v_row
  from public.institution_memberships as membership
  join public.case_packages as package
    on package.institution_id = membership.institution_id
  join public.case_versions as version
    on version.case_version_id = package.case_version_id
   and version.institution_id = package.institution_id
  where membership.user_id = p_user_id
    and membership.membership_role = 'LEARNER'
    and membership.membership_status = 'ACTIVE'
    and version.case_id = p_case_id
    and package.execution_authority = 'PUBLISHED_PRODUCTION'
    and package.package_lifecycle = 'PUBLISHED'
  order by package.published_at desc, package.case_version_id desc
  limit 1;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'status', 'AUTHORIZED',
    'membership_id', v_row.membership_id,
    'institution_id', v_row.institution_id,
    'role', v_row.membership_role,
    'artifact', v_row.package_payload
  );
end;
$$;

create or replace function public.resolve_api_review_case_v2_013(
  p_user_id uuid,
  p_case_id public.namespaced_identifier
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
begin
  select membership.membership_id, membership.institution_id,
    membership.membership_role, artifact.artifact_payload
  into v_row
  from public.institution_memberships as membership
  join public.review_execution_artifacts as artifact
    on artifact.institution_id = membership.institution_id
  join public.case_versions as version
    on version.case_version_id = artifact.case_version_id
   and version.institution_id = artifact.institution_id
  where membership.user_id = p_user_id
    and membership.membership_role in ('FACULTY', 'REVIEWER')
    and membership.membership_status = 'ACTIVE'
    and version.case_id = p_case_id
    and artifact.execution_authority = 'REVIEW_ONLY'
    and artifact.source_lifecycle = 'UNDER_REVIEW'
  order by artifact.created_at desc, artifact.review_execution_hash desc
  limit 1;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'status', 'AUTHORIZED',
    'membership_id', v_row.membership_id,
    'institution_id', v_row.institution_id,
    'role', v_row.membership_role,
    'artifact', v_row.artifact_payload
  );
end;
$$;

create or replace function public.authorize_api_session_v2_013(
  p_user_id uuid,
  p_session_id public.contract_identifier
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
begin
  select session.institution_id, membership.membership_id,
    membership.membership_role, session.execution_authority,
    case when session.execution_authority = 'PUBLISHED_PRODUCTION'
      then package.package_payload else artifact.artifact_payload end as artifact_payload
  into v_row
  from public.simulation_sessions as session
  join public.institution_memberships as membership
    on membership.membership_id = session.learner_membership_id
   and membership.institution_id = session.institution_id
   and membership.user_id = session.learner_user_id
  left join public.case_packages as package
    on package.case_package_id = session.case_package_id
   and package.package_hash = session.published_package_hash
  left join public.review_execution_artifacts as artifact
    on artifact.review_execution_hash = session.review_execution_hash
  where session.session_id = p_session_id
    and session.learner_user_id = p_user_id
    and membership.user_id = p_user_id
    and membership.membership_status = 'ACTIVE';
  if not found or v_row.artifact_payload is null then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  return jsonb_build_object(
    'status', 'AUTHORIZED',
    'institution_id', v_row.institution_id,
    'membership_id', v_row.membership_id,
    'role', v_row.membership_role,
    'execution_authority', v_row.execution_authority,
    'artifact', v_row.artifact_payload
  );
end;
$$;

revoke all on function public.resolve_api_production_case_v2_013(uuid, public.namespaced_identifier)
  from public, anon, authenticated;
revoke all on function public.resolve_api_review_case_v2_013(uuid, public.namespaced_identifier)
  from public, anon, authenticated;
revoke all on function public.authorize_api_session_v2_013(uuid, public.contract_identifier)
  from public, anon, authenticated;
grant execute on function public.resolve_api_production_case_v2_013(uuid, public.namespaced_identifier)
  to service_role;
grant execute on function public.resolve_api_review_case_v2_013(uuid, public.namespaced_identifier)
  to service_role;
grant execute on function public.authorize_api_session_v2_013(uuid, public.contract_identifier)
  to service_role;
