-- V2-012A: trusted-backend, storage-only Session load and atomic commit.
-- Clinical decisions, event ordering, and Clinical Time are computed before
-- this boundary. Both functions are SECURITY INVOKER and service_role-only.

create function public.load_authoritative_session_v2_012a(
  p_session_id public.contract_identifier
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_session public.simulation_sessions%rowtype;
  v_events jsonb;
  v_commands jsonb;
  v_checkpoint jsonb;
begin
  select *
  into v_session
  from public.simulation_sessions
  where session_id = p_session_id;

  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(envelope_payload order by event_sequence), '[]'::jsonb)
  into v_events
  from public.session_events
  where session_id = p_session_id;

  select coalesce(
    jsonb_agg(committed_result_payload order by first_event_sequence, idempotency_key),
    '[]'::jsonb
  )
  into v_commands
  from public.session_commands
  where session_id = p_session_id;

  select aggregate_payload
  into v_checkpoint
  from public.patient_state_checkpoints
  where session_id = p_session_id
  order by checkpoint_id desc
  limit 1;

  return jsonb_build_object(
    'status', 'LOADED',
    'aggregate', v_session.aggregate_payload,
    'events', v_events,
    'commands', v_commands,
    'checkpoint', v_checkpoint
  );
end;
$$;

create function public.commit_authoritative_session_v2_012a(
  p_request jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_session public.simulation_sessions%rowtype;
  v_expected jsonb := p_request -> 'expected_token';
  v_proposed jsonb := p_request -> 'proposed_session';
  v_session_id text := p_request ->> 'session_id';
  v_current_event_count integer;
  v_proposed_event_count integer;
  v_current_command_count integer;
  v_proposed_command_count integer;
  v_index integer;
  v_event jsonb;
  v_command jsonb;
begin
  if jsonb_typeof(p_request) <> 'object'
    or jsonb_typeof(v_expected) <> 'object'
    or jsonb_typeof(v_proposed) <> 'object'
    or v_session_id is null
    or v_session_id <> v_proposed ->> 'session_id'
    or v_session_id <> v_expected ->> 'session_id'
  then
    return jsonb_build_object('status', 'INVALID_COMMIT');
  end if;

  -- This row lock is the authoritative serialization point. No child row is
  -- written before the lock and composite compare-and-swap checks succeed.
  select *
  into v_session
  from public.simulation_sessions
  where session_id = v_session_id
  for update;

  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  if (v_expected ->> 'token_schema_version') <> '1.0'
    or (v_expected ->> 'patient_state_version')::bigint <> v_session.patient_state_version
    or (v_expected ->> 'next_event_sequence')::bigint <> v_session.next_event_sequence
    or (v_expected ->> 'clock_status') <> v_session.clock_status
    or (v_expected ->> 'clinical_time')::numeric <> v_session.clinical_time_seconds
    or (v_expected ->> 'trusted_real_time_anchor_utc')::timestamptz
      is distinct from v_session.trusted_real_time_anchor_utc
  then
    return jsonb_build_object('status', 'VERSION_CONFLICT');
  end if;

  -- Session authority, ownership, mode, and the entire pinned Case context are
  -- immutable under ordinary Session commits.
  if (v_proposed ->> 'aggregate_schema_version') <> v_session.aggregate_schema_version
    or (v_proposed ->> 'status') <> v_session.session_status
    or (v_proposed ->> 'mode') <> v_session.simulation_mode
    or (v_proposed -> 'pinned_case') is distinct from (v_session.aggregate_payload -> 'pinned_case')
  then
    return jsonb_build_object('status', 'AUTHORITY_MISMATCH');
  end if;

  if jsonb_typeof(v_proposed -> 'committed_events') <> 'array'
    or jsonb_typeof(v_proposed -> 'idempotency_records') <> 'array'
    or (v_proposed #>> '{patient_state,state_version}')::bigint < v_session.patient_state_version
    or (v_proposed #>> '{patient_state,clinical_time}')::numeric < v_session.clinical_time_seconds
  then
    return jsonb_build_object('status', 'INVALID_COMMIT');
  end if;

  v_current_event_count := jsonb_array_length(v_session.aggregate_payload -> 'committed_events');
  v_proposed_event_count := jsonb_array_length(v_proposed -> 'committed_events');
  v_current_command_count := jsonb_array_length(v_session.aggregate_payload -> 'idempotency_records');
  v_proposed_command_count := jsonb_array_length(v_proposed -> 'idempotency_records');

  if v_proposed_event_count < v_current_event_count
    or v_proposed_command_count < v_current_command_count
    or (v_proposed ->> 'next_sequence_no')::bigint <> v_proposed_event_count + 1
  then
    return jsonb_build_object('status', 'INVALID_COMMIT');
  end if;

  if v_current_event_count > 0 then
    for v_index in 0..v_current_event_count - 1 loop
      if (v_proposed -> 'committed_events' -> v_index)
        is distinct from (v_session.aggregate_payload -> 'committed_events' -> v_index)
      then
        return jsonb_build_object('status', 'INVALID_COMMIT');
      end if;
    end loop;
  end if;

  if v_current_command_count > 0 then
    for v_index in 0..v_current_command_count - 1 loop
      if (v_proposed -> 'idempotency_records' -> v_index)
        is distinct from (v_session.aggregate_payload -> 'idempotency_records' -> v_index)
      then
        return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
      end if;
    end loop;
  end if;

  -- Validate every append before the first write. Data-dependent rejection
  -- therefore cannot return normally after partially inserting a batch.
  if v_proposed_event_count > v_current_event_count then
    for v_index in v_current_event_count..v_proposed_event_count - 1 loop
      v_event := v_proposed -> 'committed_events' -> v_index;
      if (v_event ->> 'sequence_no')::bigint <> v_index + 1 then
        return jsonb_build_object('status', 'INVALID_COMMIT');
      end if;
    end loop;
  end if;

  if v_proposed_command_count > v_current_command_count then
    for v_index in v_current_command_count..v_proposed_command_count - 1 loop
      v_command := v_proposed -> 'idempotency_records' -> v_index;
      if exists (
        select 1
        from public.session_commands existing
        where existing.session_id = v_session_id
          and existing.idempotency_key = v_command ->> 'idempotency_key'
          and existing.canonical_request_hash <> v_command ->> 'command_fingerprint'
      ) then
        return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
      end if;
    end loop;
  end if;

  -- Domain-assigned EventId, sequence, Clinical Time, and causal order are
  -- preserved exactly. PostgreSQL never creates or reorders clinical Events.
  if v_proposed_event_count > v_current_event_count then
    for v_index in v_current_event_count..v_proposed_event_count - 1 loop
      v_event := v_proposed -> 'committed_events' -> v_index;
      insert into public.session_events (
        event_id,
        session_id,
        event_sequence,
        event_schema_version,
        clinical_time_seconds,
        real_time_utc,
        actor_type,
        actor_id,
        event_source,
        correlation_id,
        causation_event_id,
        action_request_id,
        action_id,
        rule_id,
        event_type,
        event_status,
        state_version_before,
        state_version_after,
        idempotency_key,
        supersedes_event_id,
        envelope_payload
      ) values (
        (v_event ->> 'event_id')::uuid,
        v_session_id,
        (v_event ->> 'sequence_no')::bigint,
        v_event ->> 'event_schema_version',
        (v_event ->> 'clinical_time')::numeric,
        (v_event ->> 'real_time_utc')::timestamptz,
        v_event ->> 'actor_type',
        nullif(v_event ->> 'actor_id', ''),
        v_event ->> 'source',
        v_event ->> 'correlation_id',
        nullif(v_event ->> 'causation_event_id', '')::uuid,
        nullif(v_event ->> 'action_request_id', ''),
        nullif(v_event ->> 'action_id', ''),
        nullif(v_event ->> 'rule_id', ''),
        v_event ->> 'event_type',
        v_event ->> 'status',
        nullif(v_event ->> 'state_version_before', '')::bigint,
        nullif(v_event ->> 'state_version_after', '')::bigint,
        v_event ->> 'idempotency_key',
        nullif(v_event ->> 'supersedes_event_id', '')::uuid,
        v_event
      );
    end loop;
  end if;

  -- Only successful domain command results are appended. A failure anywhere
  -- later in this function rolls these rows and Events back together.
  if v_proposed_command_count > v_current_command_count then
    for v_index in v_current_command_count..v_proposed_command_count - 1 loop
      v_command := v_proposed -> 'idempotency_records' -> v_index;
      insert into public.session_commands (
        command_id,
        session_id,
        idempotency_key,
        canonical_request_hash,
        expected_patient_state_version,
        command_status,
        first_event_sequence,
        last_event_sequence,
        committed_event_ids,
        command_event_id,
        resulting_patient_state_version,
        resulting_clinical_time_seconds,
        committed_result_payload,
        committed_at
      ) values (
        v_command ->> 'command_id',
        v_session_id,
        v_command ->> 'idempotency_key',
        v_command ->> 'command_fingerprint',
        v_session.patient_state_version,
        'COMMITTED',
        (v_command #>> '{result_event_range,first_sequence_no}')::bigint,
        (v_command #>> '{result_event_range,last_sequence_no}')::bigint,
        v_command -> 'committed_event_ids',
        (v_command ->> 'command_event_id')::uuid,
        (v_command ->> 'resulting_state_version')::bigint,
        (v_command ->> 'resulting_clinical_time')::numeric,
        v_command,
        (v_command ->> 'committed_at_utc')::timestamptz
      );
    end loop;
  end if;

  insert into public.patient_state_checkpoints (
    session_id,
    state_schema_version,
    patient_state_version,
    last_event_sequence,
    clinical_time_seconds,
    clock_status,
    trusted_real_time_anchor_utc,
    patient_state_payload,
    scheduler_state_payload,
    clinical_clock_payload,
    aggregate_payload,
    checkpoint_hash
  ) values (
    v_session_id,
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
  set patient_state_version = (v_proposed #>> '{patient_state,state_version}')::bigint,
      clinical_time_seconds = (v_proposed #>> '{patient_state,clinical_time}')::numeric,
      clock_status = v_proposed #>> '{clinical_clock,status}',
      next_event_sequence = (v_proposed ->> 'next_sequence_no')::bigint,
      trusted_real_time_anchor_utc = nullif(
        v_proposed ->> 'trusted_real_time_anchor_utc',
        ''
      )::timestamptz,
      patient_state_payload = v_proposed -> 'patient_state',
      scheduler_state_payload = v_proposed -> 'scheduler_state',
      clinical_clock_payload = v_proposed -> 'clinical_clock',
      aggregate_payload = v_proposed
  where session_id = v_session_id;

  return jsonb_build_object('status', 'COMMITTED', 'aggregate', v_proposed);
end;
$$;

revoke all on function public.load_authoritative_session_v2_012a(public.contract_identifier)
  from public, anon, authenticated;
revoke all on function public.commit_authoritative_session_v2_012a(jsonb)
  from public, anon, authenticated;
grant execute on function public.load_authoritative_session_v2_012a(public.contract_identifier)
  to service_role;
grant execute on function public.commit_authoritative_session_v2_012a(jsonb)
  to service_role;

comment on function public.commit_authoritative_session_v2_012a(jsonb) is
  'V2-012A storage-only atomic Session CAS commit; contains no clinical decision logic.';
