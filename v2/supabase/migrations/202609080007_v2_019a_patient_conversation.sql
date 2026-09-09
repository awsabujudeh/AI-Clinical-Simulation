-- V2-019A: durable Patient Conversation claim, exact replay, transcript, and
-- authoritative Session event integration. The provider call occurs outside
-- database locks; only patient-safe context is persisted for crash recovery.

create table public.patient_conversation_turns (
  turn_id public.contract_identifier primary key,
  session_id public.contract_identifier not null,
  institution_id public.institution_identifier not null,
  principal_user_id uuid not null,
  membership_id public.contract_identifier not null,
  turn_sequence bigint not null check (turn_sequence > 0),
  idempotency_key public.contract_identifier not null,
  canonical_request_hash public.sha256_hex not null,
  turn_status text not null check (turn_status in ('PENDING', 'COMPLETED')),
  claim_token public.contract_identifier not null,
  claim_expires_at_utc timestamptz not null,
  question_event_id uuid not null,
  response_event_id uuid,
  grounded_state_version bigint not null check (grounded_state_version >= 0),
  clinical_time_seconds numeric(20, 9) not null check (clinical_time_seconds >= 0),
  locale text not null check (locale in ('ar-JO', 'en-US')),
  question_source text not null check (question_source in ('TEXT', 'STT')),
  utterance_id public.contract_identifier not null,
  learner_utterance text not null check (
    length(btrim(learner_utterance)) between 1 and 4000
  ),
  patient_context_payload jsonb not null
    check (jsonb_typeof(patient_context_payload) = 'object'),
  turn_payload jsonb check (
    turn_payload is null or jsonb_typeof(turn_payload) = 'object'
  ),
  claimed_at_utc timestamptz not null,
  completed_at_utc timestamptz,
  unique (session_id, turn_sequence),
  unique (session_id, idempotency_key),
  unique (session_id, question_event_id),
  check (
    (turn_status = 'PENDING' and response_event_id is null
      and turn_payload is null and completed_at_utc is null)
    or
    (turn_status = 'COMPLETED' and response_event_id is not null
      and turn_payload is not null and completed_at_utc is not null)
  ),
  check (patient_context_payload ->> 'context_schema_version' = '1.0'),
  check ((patient_context_payload ->> 'grounded_state_version')::bigint = grounded_state_version),
  check ((patient_context_payload ->> 'grounded_clinical_time')::numeric = clinical_time_seconds),
  check (patient_context_payload ->> 'locale' = locale),
  check (turn_payload is null or turn_payload ->> 'turn_id' = turn_id),
  check (turn_payload is null or turn_payload ->> 'session_id' = session_id),
  check (turn_payload is null or (turn_payload ->> 'turn_sequence')::bigint = turn_sequence),
  check (turn_payload is null or turn_payload ->> 'locale' = locale),
  check (turn_payload is null or turn_payload ->> 'question_event_id' = question_event_id::text),
  check (turn_payload is null or turn_payload ->> 'response_event_id' = response_event_id::text),
  foreign key (session_id, institution_id)
    references public.simulation_sessions(session_id, institution_id)
    on delete restrict,
  foreign key (membership_id, institution_id, principal_user_id)
    references public.institution_memberships(membership_id, institution_id, user_id)
    on delete restrict,
  foreign key (session_id, question_event_id)
    references public.session_events(session_id, event_id)
    on delete restrict,
  foreign key (session_id, response_event_id)
    references public.session_events(session_id, event_id)
    on delete restrict
);

create function public.reject_completed_patient_turn_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.turn_status = 'COMPLETED' then
    raise exception using
      errcode = '55000',
      message = 'completed Patient conversation turns are append-only';
  end if;
  return new;
end;
$$;

revoke execute on function public.reject_completed_patient_turn_mutation()
  from public;

create trigger patient_conversation_completed_turns_are_immutable
before update or delete on public.patient_conversation_turns
for each row execute function public.reject_completed_patient_turn_mutation();

create function public.reject_session_finalization_with_pending_patient_turn()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.session_status = 'ACTIVE' and new.session_status = 'ENDED'
    and exists (
      select 1 from public.patient_conversation_turns as turn
      where turn.session_id = old.session_id
        and turn.turn_status = 'PENDING'
    )
  then
    raise exception using
      errcode = '40001',
      message = 'pending Patient conversation must settle before Session finalization';
  end if;
  return new;
end;
$$;

revoke execute on function public.reject_session_finalization_with_pending_patient_turn()
  from public;

create trigger session_finalization_waits_for_patient_conversation
before update of session_status on public.simulation_sessions
for each row execute function public.reject_session_finalization_with_pending_patient_turn();

create function public.begin_patient_conversation_v2_019a(p_request jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_session public.simulation_sessions%rowtype;
  v_existing public.patient_conversation_turns%rowtype;
  v_commit jsonb;
  v_proposed jsonb := p_request -> 'proposed_session';
  v_event jsonb;
  v_turn_sequence bigint;
begin
  if jsonb_typeof(p_request) <> 'object'
    or jsonb_typeof(p_request -> 'context') <> 'object'
    or jsonb_typeof(v_proposed) <> 'object'
    or p_request ->> 'session_id' is null
    or p_request ->> 'principal_user_id' is null
  then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;

  select * into v_session
  from public.simulation_sessions
  where session_id = p_request ->> 'session_id'
  for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_session.learner_user_id <> (p_request ->> 'principal_user_id')::uuid
    or v_session.institution_id <> p_request ->> 'institution_id'
    or v_session.learner_membership_id <> p_request ->> 'membership_id'
    or not exists (
      select 1 from public.institution_memberships as membership
      where membership.membership_id = p_request ->> 'membership_id'
        and membership.institution_id = p_request ->> 'institution_id'
        and membership.user_id = (p_request ->> 'principal_user_id')::uuid
        and membership.membership_status = 'ACTIVE'
    )
  then
    return jsonb_build_object('status', 'NOT_AUTHORIZED');
  end if;

  select * into v_existing
  from public.patient_conversation_turns
  where session_id = p_request ->> 'session_id'
    and idempotency_key = p_request ->> 'idempotency_key'
  for update;
  if found then
    if v_existing.canonical_request_hash <> p_request ->> 'canonical_request_hash'
      or v_existing.principal_user_id <> (p_request ->> 'principal_user_id')::uuid
    then
      return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
    end if;
    if v_existing.turn_status = 'COMPLETED' then
      return jsonb_build_object('status', 'REPLAYED', 'turn', v_existing.turn_payload);
    end if;
    if v_existing.claim_expires_at_utc > (p_request ->> 'claimed_at_utc')::timestamptz then
      return jsonb_build_object('status', 'IN_PROGRESS');
    end if;
    update public.patient_conversation_turns
    set claim_token = p_request ->> 'claim_token',
        claimed_at_utc = (p_request ->> 'claimed_at_utc')::timestamptz,
        claim_expires_at_utc = (p_request ->> 'claim_expires_at_utc')::timestamptz
    where turn_id = v_existing.turn_id;
    return jsonb_build_object(
      'status', 'CLAIMED',
      'turn_id', v_existing.turn_id,
      'turn_sequence', v_existing.turn_sequence,
      'question_event_id', v_existing.question_event_id,
      'context', v_existing.patient_context_payload
    );
  end if;

  if v_session.session_status <> 'ACTIVE' then
    return jsonb_build_object('status', 'SESSION_ENDED');
  end if;
  if jsonb_array_length(v_proposed -> 'committed_events') = 0 then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;
  v_event := v_proposed -> 'committed_events'
    -> (jsonb_array_length(v_proposed -> 'committed_events') - 1);
  if v_event ->> 'event_type' <> 'QUESTION_ASKED'
    or v_event ->> 'event_id' <> p_request ->> 'question_event_id'
    or v_event #>> '{payload,turn_id}' <> p_request ->> 'turn_id'
    or v_event ->> 'idempotency_key' <> p_request ->> 'idempotency_key'
  then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;

  v_commit := public.commit_authoritative_session_v2_013(jsonb_build_object(
    'session_id', p_request -> 'session_id',
    'expected_token', p_request -> 'expected_token',
    'proposed_session', v_proposed
  ));
  if v_commit ->> 'status' <> 'COMMITTED' then
    return v_commit;
  end if;

  select coalesce(max(turn_sequence), 0) + 1 into v_turn_sequence
  from public.patient_conversation_turns
  where session_id = p_request ->> 'session_id';

  insert into public.patient_conversation_turns (
    turn_id, session_id, institution_id, principal_user_id, membership_id,
    turn_sequence, idempotency_key, canonical_request_hash, turn_status,
    claim_token, claim_expires_at_utc, question_event_id,
    grounded_state_version, clinical_time_seconds, locale, question_source,
    utterance_id, learner_utterance, patient_context_payload, claimed_at_utc
  ) values (
    p_request ->> 'turn_id', p_request ->> 'session_id',
    p_request ->> 'institution_id', (p_request ->> 'principal_user_id')::uuid,
    p_request ->> 'membership_id', v_turn_sequence,
    p_request ->> 'idempotency_key', p_request ->> 'canonical_request_hash',
    'PENDING', p_request ->> 'claim_token',
    (p_request ->> 'claim_expires_at_utc')::timestamptz,
    (p_request ->> 'question_event_id')::uuid,
    (p_request #>> '{context,grounded_state_version}')::bigint,
    (p_request #>> '{context,grounded_clinical_time}')::numeric,
    p_request #>> '{question,locale}', p_request #>> '{question,source}',
    p_request #>> '{question,utterance_id}', p_request #>> '{question,text}',
    p_request -> 'context', (p_request ->> 'claimed_at_utc')::timestamptz
  );

  return jsonb_build_object(
    'status', 'CLAIMED',
    'turn_id', p_request ->> 'turn_id',
    'turn_sequence', v_turn_sequence,
    'question_event_id', p_request ->> 'question_event_id',
    'context', p_request -> 'context'
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
  when foreign_key_violation or check_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('status', 'INVALID_REQUEST');
end;
$$;

create function public.complete_patient_conversation_v2_019a(p_request jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_session public.simulation_sessions%rowtype;
  v_turn public.patient_conversation_turns%rowtype;
  v_commit jsonb;
  v_proposed jsonb := p_request -> 'proposed_session';
  v_event jsonb;
begin
  select * into v_session
  from public.simulation_sessions
  where session_id = p_request ->> 'session_id'
  for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_session.learner_user_id <> (p_request ->> 'principal_user_id')::uuid then
    return jsonb_build_object('status', 'NOT_AUTHORIZED');
  end if;

  select * into v_turn
  from public.patient_conversation_turns
  where session_id = p_request ->> 'session_id'
    and idempotency_key = p_request ->> 'idempotency_key'
  for update;
  if not found then
    return jsonb_build_object('status', 'CLAIM_NOT_FOUND');
  end if;
  if v_turn.canonical_request_hash <> p_request ->> 'canonical_request_hash'
    or v_turn.principal_user_id <> (p_request ->> 'principal_user_id')::uuid
  then
    return jsonb_build_object('status', 'IDEMPOTENCY_CONFLICT');
  end if;
  if v_turn.turn_status = 'COMPLETED' then
    return jsonb_build_object('status', 'REPLAYED', 'turn', v_turn.turn_payload);
  end if;
  if v_turn.claim_token <> p_request ->> 'claim_token' then
    return jsonb_build_object('status', 'CLAIM_MISMATCH');
  end if;
  if not exists (
    select 1 from public.institution_memberships as membership
    where membership.membership_id = v_turn.membership_id
      and membership.institution_id = v_turn.institution_id
      and membership.user_id = (p_request ->> 'principal_user_id')::uuid
      and membership.membership_status = 'ACTIVE'
  ) then
    return jsonb_build_object('status', 'NOT_AUTHORIZED');
  end if;
  if v_session.session_status <> 'ACTIVE' then
    return jsonb_build_object('status', 'SESSION_ENDED');
  end if;

  if jsonb_typeof(p_request -> 'turn') <> 'object'
    or jsonb_array_length(v_proposed -> 'committed_events') = 0
  then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;
  v_event := v_proposed -> 'committed_events'
    -> (jsonb_array_length(v_proposed -> 'committed_events') - 1);
  if v_event ->> 'event_type' <> 'PATIENT_RESPONSE_RECORDED'
    or v_event ->> 'event_id' <> p_request #>> '{turn,response_event_id}'
    or v_event ->> 'causation_event_id' <> v_turn.question_event_id::text
    or v_event #>> '{payload,turn_id}' <> v_turn.turn_id
    or p_request #>> '{turn,question_event_id}' <> v_turn.question_event_id::text
    or (p_request #>> '{turn,turn_sequence}')::bigint <> v_turn.turn_sequence
  then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;

  v_commit := public.commit_authoritative_session_v2_013(jsonb_build_object(
    'session_id', p_request -> 'session_id',
    'expected_token', p_request -> 'expected_token',
    'proposed_session', v_proposed
  ));
  if v_commit ->> 'status' <> 'COMMITTED' then
    return v_commit;
  end if;

  update public.patient_conversation_turns
  set turn_status = 'COMPLETED',
      response_event_id = (p_request #>> '{turn,response_event_id}')::uuid,
      turn_payload = p_request -> 'turn',
      completed_at_utc = (p_request ->> 'completed_at_utc')::timestamptz
  where turn_id = v_turn.turn_id;

  return jsonb_build_object('status', 'COMMITTED', 'turn', p_request -> 'turn');
exception
  when foreign_key_violation or check_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('status', 'INVALID_REQUEST');
end;
$$;

create function public.list_patient_conversation_v2_019a(
  p_session_id public.contract_identifier,
  p_principal_user_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_session public.simulation_sessions%rowtype;
  v_turns jsonb;
  v_total integer;
  v_first_sequence bigint;
begin
  if p_limit < 1 or p_limit > 512 then
    return jsonb_build_object('status', 'INVALID_REQUEST');
  end if;
  select * into v_session from public.simulation_sessions
  where session_id = p_session_id;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_session.learner_user_id <> p_principal_user_id
    or not exists (
      select 1 from public.institution_memberships membership
      where membership.membership_id = v_session.learner_membership_id
        and membership.user_id = p_principal_user_id
        and membership.institution_id = v_session.institution_id
        and membership.membership_status = 'ACTIVE'
    )
  then
    return jsonb_build_object('status', 'NOT_AUTHORIZED');
  end if;
  select count(*)::integer into v_total
  from public.patient_conversation_turns
  where session_id = p_session_id and turn_status = 'COMPLETED';
  select coalesce(jsonb_agg(safe_turn order by turn_sequence), '[]'::jsonb), min(turn_sequence)
  into v_turns, v_first_sequence
  from (
    select turn_sequence, turn_payload - 'provider_metadata' as safe_turn
    from public.patient_conversation_turns
    where session_id = p_session_id and turn_status = 'COMPLETED'
    order by turn_sequence desc
    limit p_limit
  ) selected;
  return jsonb_build_object(
    'status', 'LOADED',
    'transcript', jsonb_strip_nulls(jsonb_build_object(
      'conversation_schema_version', '1.0',
      'session_id', p_session_id,
      'turns', v_turns,
      'truncated_before_turn_sequence', case when v_total > p_limit then v_first_sequence else null end
    ))
  );
end;
$$;

revoke all on table public.patient_conversation_turns from anon, authenticated;
grant all privileges on table public.patient_conversation_turns to service_role;
alter table public.patient_conversation_turns enable row level security;
alter table public.patient_conversation_turns force row level security;

revoke all on function public.begin_patient_conversation_v2_019a(jsonb)
  from public, anon, authenticated;
revoke all on function public.complete_patient_conversation_v2_019a(jsonb)
  from public, anon, authenticated;
revoke all on function public.list_patient_conversation_v2_019a(
  public.contract_identifier, uuid, integer
) from public, anon, authenticated;

grant execute on function public.begin_patient_conversation_v2_019a(jsonb)
  to service_role;
grant execute on function public.complete_patient_conversation_v2_019a(jsonb)
  to service_role;
grant execute on function public.list_patient_conversation_v2_019a(
  public.contract_identifier, uuid, integer
) to service_role;

comment on table public.patient_conversation_turns is
  'V2-019A patient-safe durable transcript and provider-independent idempotency authority.';
