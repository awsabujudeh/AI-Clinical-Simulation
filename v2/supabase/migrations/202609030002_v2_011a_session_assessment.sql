-- V2-011A: storage shape for the existing deterministic Session and Assessment
-- aggregates. Persistent transaction orchestration remains V2-012 scope.

create table public.simulation_sessions (
  session_id public.contract_identifier primary key,
  institution_id public.institution_identifier not null,
  learner_user_id uuid not null,
  learner_membership_id public.contract_identifier not null,
  aggregate_schema_version public.schema_version not null,
  session_status text not null check (session_status = 'ACTIVE'),
  simulation_mode text not null
    check (simulation_mode in ('PRACTICE_DEMO', 'ASSESSMENT')),
  execution_authority text not null
    check (execution_authority in ('REVIEW_ONLY', 'PUBLISHED_PRODUCTION')),
  case_package_id public.namespaced_identifier not null,
  case_version_id public.namespaced_identifier not null,
  case_version public.semantic_version not null,
  published_package_hash public.sha256_hex,
  review_execution_hash public.sha256_hex,
  review_subject_hash public.sha256_hex,
  patient_state_version bigint not null check (patient_state_version >= 0),
  clinical_time_seconds numeric(20, 9) not null check (clinical_time_seconds >= 0),
  clock_status text not null check (clock_status in ('RUNNING', 'PAUSED')),
  next_event_sequence bigint not null check (next_event_sequence > 0),
  trusted_real_time_anchor_utc timestamptz,
  patient_state_payload jsonb not null
    check (jsonb_typeof(patient_state_payload) = 'object'),
  scheduler_state_payload jsonb not null
    check (jsonb_typeof(scheduler_state_payload) = 'object'),
  clinical_clock_payload jsonb not null
    check (jsonb_typeof(clinical_clock_payload) = 'object'),
  aggregate_payload jsonb not null
    check (jsonb_typeof(aggregate_payload) = 'object'),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (session_id, institution_id),
  unique (
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    published_package_hash
  ),
  unique (
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    review_execution_hash,
    review_subject_hash
  ),
  check (aggregate_payload ->> 'session_id' = session_id),
  check (aggregate_payload ->> 'aggregate_schema_version' = aggregate_schema_version),
  check (aggregate_payload ->> 'status' = session_status),
  check (aggregate_payload ->> 'mode' = simulation_mode),
  check (aggregate_payload #>> '{pinned_case,execution_authority}' = execution_authority),
  check (aggregate_payload #>> '{pinned_case,case_package_id}' = case_package_id),
  check (aggregate_payload #>> '{pinned_case,case_version_id}' = case_version_id),
  check (aggregate_payload #>> '{pinned_case,case_version}' = case_version),
  check ((aggregate_payload #>> '{patient_state,state_version}')::bigint = patient_state_version),
  check ((aggregate_payload #>> '{patient_state,clinical_time}')::numeric = clinical_time_seconds),
  check (aggregate_payload #>> '{clinical_clock,status}' = clock_status),
  check ((aggregate_payload ->> 'next_sequence_no')::bigint = next_event_sequence),
  check (aggregate_payload -> 'patient_state' = patient_state_payload),
  check (aggregate_payload -> 'scheduler_state' = scheduler_state_payload),
  check (aggregate_payload -> 'clinical_clock' = clinical_clock_payload),
  check (
    (aggregate_payload ->> 'trusted_real_time_anchor_utc')::timestamptz
      is not distinct from trusted_real_time_anchor_utc
  ),
  check (
    (execution_authority = 'PUBLISHED_PRODUCTION'
      and aggregate_payload #>> '{pinned_case,package_hash}' = published_package_hash)
    or (execution_authority = 'REVIEW_ONLY'
      and aggregate_payload #>> '{pinned_case,review_execution_hash}' = review_execution_hash
      and aggregate_payload #>> '{pinned_case,review_subject_hash}' = review_subject_hash)
  ),
  check (
    (
      execution_authority = 'REVIEW_ONLY'
      and review_execution_hash is not null
      and review_subject_hash is not null
      and published_package_hash is null
    )
    or (
      execution_authority = 'PUBLISHED_PRODUCTION'
      and published_package_hash is not null
      and review_execution_hash is null
      and review_subject_hash is null
    )
  ),
  foreign key (learner_membership_id, institution_id, learner_user_id)
    references public.institution_memberships(
      membership_id,
      institution_id,
      user_id
    ) on delete restrict,
  foreign key (
    review_execution_hash,
    case_package_id,
    case_version_id,
    case_version,
    review_subject_hash,
    institution_id
  ) references public.review_execution_artifacts(
    review_execution_hash,
    case_package_id,
    case_version_id,
    case_version,
    review_subject_hash,
    institution_id
  ) on delete restrict,
  foreign key (
    case_package_id,
    case_version_id,
    case_version,
    institution_id,
    published_package_hash
  ) references public.case_packages(
    case_package_id,
    case_version_id,
    case_version,
    institution_id,
    package_hash
  ) on delete restrict
);

create table public.session_events (
  event_id uuid primary key,
  session_id public.contract_identifier not null,
  event_sequence bigint not null check (event_sequence > 0),
  event_schema_version public.schema_version not null,
  clinical_time_seconds numeric(20, 9) not null check (clinical_time_seconds >= 0),
  real_time_utc timestamptz not null,
  actor_type text not null check (actor_type in (
    'LEARNER', 'PATIENT', 'FACULTY', 'SYSTEM', 'AI_WORKFLOW'
  )),
  actor_id public.contract_identifier,
  event_source text not null check (event_source in (
    'UI', 'NATURAL_LANGUAGE', 'ENGINE', 'AI_RESPONSE', 'FACULTY'
  )),
  correlation_id public.contract_identifier not null,
  causation_event_id uuid,
  action_request_id public.contract_identifier,
  action_id public.namespaced_identifier,
  rule_id public.namespaced_identifier,
  event_type text not null check (event_type in (
    'SESSION_STARTED',
    'SESSION_PAUSED',
    'SESSION_RESUMED',
    'SIMULATION_ENDED',
    'QUESTION_ASKED',
    'PATIENT_RESPONSE_RECORDED',
    'EXAM_PERFORMED',
    'EXAM_FINDING_REVEALED',
    'INVESTIGATION_ORDERED',
    'INVESTIGATION_PERFORMED',
    'INVESTIGATION_RESULT_AVAILABLE',
    'INVESTIGATION_IMAGE_AVAILABLE',
    'INVESTIGATION_FORMAL_REPORT_AVAILABLE',
    'INVESTIGATION_CANCELLED',
    'MEDICATION_ORDERED',
    'MEDICATION_ADMINISTERED',
    'MEDICATION_REJECTED',
    'MEDICATION_EFFECT_APPLIED',
    'PROCEDURE_ORDERED',
    'PROCEDURE_PERFORMED',
    'PROCEDURE_CANCELLED',
    'CONSULT_REQUESTED',
    'DIAGNOSIS_SUBMITTED',
    'DISPOSITION_SELECTED',
    'PATIENT_STATE_CHANGED',
    'CRITICAL_EVENT_OCCURRED',
    'COMPLICATION_ACTIVATED',
    'OUTCOME_REACHED'
  )),
  event_status text not null check (event_status = 'COMMITTED'),
  state_version_before bigint check (state_version_before is null or state_version_before >= 0),
  state_version_after bigint check (state_version_after is null or state_version_after >= 0),
  idempotency_key public.contract_identifier not null,
  supersedes_event_id uuid,
  envelope_payload jsonb not null check (jsonb_typeof(envelope_payload) = 'object'),
  committed_at timestamptz not null default now(),
  unique (session_id, event_sequence),
  unique (session_id, event_id),
  check ((envelope_payload ->> 'event_id')::uuid = event_id),
  check (envelope_payload ->> 'session_id' = session_id),
  check ((envelope_payload ->> 'sequence_no')::bigint = event_sequence),
  check (envelope_payload ->> 'event_schema_version' = event_schema_version),
  check ((envelope_payload ->> 'clinical_time')::numeric = clinical_time_seconds),
  check (envelope_payload ->> 'event_type' = event_type),
  check (envelope_payload ->> 'status' = event_status),
  check (envelope_payload ->> 'actor_type' = actor_type),
  check (envelope_payload ->> 'source' = event_source),
  check (envelope_payload ->> 'correlation_id' = correlation_id),
  check (envelope_payload ->> 'idempotency_key' = idempotency_key),
  foreign key (session_id)
    references public.simulation_sessions(session_id) on delete restrict,
  foreign key (causation_event_id)
    references public.session_events(event_id) on delete restrict,
  foreign key (supersedes_event_id)
    references public.session_events(event_id) on delete restrict
);

-- Only successfully committed commands are durable replay records. Failed or
-- interrupted pre-command attempts therefore cannot poison an idempotency key.
create table public.session_commands (
  command_id public.contract_identifier primary key,
  session_id public.contract_identifier not null,
  idempotency_key public.contract_identifier not null,
  canonical_request_hash public.sha256_hex not null,
  expected_patient_state_version bigint not null
    check (expected_patient_state_version >= 0),
  command_status text not null check (command_status = 'COMMITTED'),
  first_event_sequence bigint not null check (first_event_sequence > 0),
  last_event_sequence bigint not null check (last_event_sequence >= first_event_sequence),
  committed_event_ids jsonb not null
    check (jsonb_typeof(committed_event_ids) = 'array'),
  command_event_id uuid not null,
  resulting_patient_state_version bigint not null
    check (resulting_patient_state_version >= 0),
  resulting_clinical_time_seconds numeric(20, 9) not null
    check (resulting_clinical_time_seconds >= 0),
  committed_result_payload jsonb not null
    check (jsonb_typeof(committed_result_payload) = 'object'),
  committed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (session_id, idempotency_key),
  check (committed_result_payload ->> 'idempotency_key' = idempotency_key),
  check (committed_result_payload ->> 'command_id' = command_id),
  check (committed_result_payload ->> 'command_fingerprint' = canonical_request_hash),
  check ((committed_result_payload #>> '{result_event_range,first_sequence_no}')::bigint = first_event_sequence),
  check ((committed_result_payload #>> '{result_event_range,last_sequence_no}')::bigint = last_event_sequence),
  check ((committed_result_payload ->> 'command_event_id')::uuid = command_event_id),
  check (committed_result_payload -> 'committed_event_ids' = committed_event_ids),
  check ((committed_result_payload ->> 'resulting_state_version')::bigint = resulting_patient_state_version),
  check ((committed_result_payload ->> 'resulting_clinical_time')::numeric = resulting_clinical_time_seconds),
  foreign key (session_id)
    references public.simulation_sessions(session_id) on delete restrict,
  foreign key (session_id, command_event_id)
    references public.session_events(session_id, event_id) on delete restrict
);

create table public.patient_state_checkpoints (
  checkpoint_id bigint generated always as identity primary key,
  session_id public.contract_identifier not null,
  state_schema_version public.schema_version not null,
  patient_state_version bigint not null check (patient_state_version >= 0),
  last_event_sequence bigint not null check (last_event_sequence >= 0),
  clinical_time_seconds numeric(20, 9) not null check (clinical_time_seconds >= 0),
  clock_status text not null check (clock_status in ('RUNNING', 'PAUSED')),
  trusted_real_time_anchor_utc timestamptz,
  patient_state_payload jsonb not null
    check (jsonb_typeof(patient_state_payload) = 'object'),
  scheduler_state_payload jsonb not null
    check (jsonb_typeof(scheduler_state_payload) = 'object'),
  clinical_clock_payload jsonb not null
    check (jsonb_typeof(clinical_clock_payload) = 'object'),
  aggregate_payload jsonb not null
    check (jsonb_typeof(aggregate_payload) = 'object'),
  checkpoint_hash public.sha256_hex,
  created_at timestamptz not null default now(),
  unique (session_id, patient_state_version, last_event_sequence, clinical_time_seconds, clock_status),
  check (aggregate_payload ->> 'session_id' = session_id),
  check ((patient_state_payload ->> 'state_version')::bigint = patient_state_version),
  check ((patient_state_payload ->> 'clinical_time')::numeric = clinical_time_seconds),
  check (clinical_clock_payload ->> 'status' = clock_status),
  check ((clinical_clock_payload ->> 'clinical_time')::numeric = clinical_time_seconds),
  check (aggregate_payload -> 'patient_state' = patient_state_payload),
  check (aggregate_payload -> 'scheduler_state' = scheduler_state_payload),
  check (aggregate_payload -> 'clinical_clock' = clinical_clock_payload),
  check ((aggregate_payload ->> 'next_sequence_no')::bigint = last_event_sequence + 1),
  foreign key (session_id)
    references public.simulation_sessions(session_id) on delete restrict
);

create table public.assessments (
  assessment_id public.contract_identifier primary key,
  session_id public.contract_identifier not null,
  institution_id public.institution_identifier not null,
  result_schema_version public.schema_version not null,
  trace_version public.schema_version not null,
  execution_authority text not null
    check (execution_authority in ('REVIEW_ONLY', 'PUBLISHED_PRODUCTION')),
  case_package_id public.namespaced_identifier not null,
  case_version_id public.namespaced_identifier not null,
  case_version public.semantic_version not null,
  package_hash public.sha256_hex,
  review_execution_hash public.sha256_hex,
  review_subject_hash public.sha256_hex,
  rubric_id public.namespaced_identifier not null
    check (rubric_id like 'rubric.%'),
  rubric_version public.semantic_version not null,
  rubric_module_schema_version public.schema_version not null,
  rubric_module_hash public.sha256_hex not null,
  evaluation_phase text not null check (evaluation_phase in ('LIVE', 'FINAL')),
  assessed_through_clinical_time numeric(20, 9) not null
    check (assessed_through_clinical_time >= 0),
  event_sequence_through bigint not null check (event_sequence_through >= 0),
  overall_score_basis_points integer not null
    check (overall_score_basis_points between 0 and 10000),
  maximum_score_basis_points integer not null
    check (maximum_score_basis_points = 10000),
  unsafe boolean not null,
  finalization_boundary_payload jsonb
    check (
      finalization_boundary_payload is null
      or jsonb_typeof(finalization_boundary_payload) = 'object'
    ),
  assessment_result_payload jsonb not null
    check (jsonb_typeof(assessment_result_payload) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (evaluation_phase = 'LIVE' and finalization_boundary_payload is null)
    or (evaluation_phase = 'FINAL' and finalization_boundary_payload is not null)
  ),
  check (
    (
      execution_authority = 'REVIEW_ONLY'
      and review_execution_hash is not null
      and review_subject_hash is not null
      and package_hash is null
      and finalization_boundary_payload is null
    )
    or (
      execution_authority = 'PUBLISHED_PRODUCTION'
      and package_hash is not null
      and review_execution_hash is null
      and review_subject_hash is null
    )
  ),
  check (assessment_result_payload ->> 'assessment_id' = assessment_id),
  check (assessment_result_payload ->> 'session_id' = session_id),
  check (assessment_result_payload ->> 'execution_authority' = execution_authority),
  check (assessment_result_payload ->> 'case_package_id' = case_package_id),
  check (assessment_result_payload ->> 'case_version_id' = case_version_id),
  check (assessment_result_payload ->> 'case_version' = case_version),
  check (assessment_result_payload ->> 'rubric_id' = rubric_id),
  check (assessment_result_payload ->> 'rubric_module_hash' = rubric_module_hash),
  check ((assessment_result_payload ->> 'overall_score_basis_points')::integer = overall_score_basis_points),
  check (
    (execution_authority = 'PUBLISHED_PRODUCTION'
      and assessment_result_payload ->> 'package_hash' = package_hash)
    or (execution_authority = 'REVIEW_ONLY'
      and assessment_result_payload ->> 'review_execution_hash' = review_execution_hash
      and assessment_result_payload ->> 'review_subject_hash' = review_subject_hash)
  ),
  foreign key (session_id, institution_id)
    references public.simulation_sessions(session_id, institution_id)
    on delete restrict,
  foreign key (
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    package_hash
  ) references public.simulation_sessions(
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    published_package_hash
  ) on delete restrict,
  foreign key (
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    review_execution_hash,
    review_subject_hash
  ) references public.simulation_sessions(
    session_id,
    institution_id,
    case_package_id,
    case_version_id,
    case_version,
    review_execution_hash,
    review_subject_hash
  ) on delete restrict,
  foreign key (
    review_execution_hash,
    case_package_id,
    case_version_id,
    case_version,
    review_subject_hash,
    institution_id
  ) references public.review_execution_artifacts(
    review_execution_hash,
    case_package_id,
    case_version_id,
    case_version,
    review_subject_hash,
    institution_id
  ) on delete restrict,
  foreign key (
    case_package_id,
    case_version_id,
    case_version,
    institution_id,
    package_hash
  ) references public.case_packages(
    case_package_id,
    case_version_id,
    case_version,
    institution_id,
    package_hash
  ) on delete restrict
);

create table public.assessment_domain_scores (
  assessment_id public.contract_identifier not null,
  domain_id public.namespaced_identifier not null
    check (domain_id like 'domain.%'),
  earned_points integer not null check (earned_points >= 0),
  maximum_points integer not null check (maximum_points > 0),
  score_basis_points integer not null check (score_basis_points between 0 and 10000),
  weight_basis_points integer not null check (weight_basis_points between 1 and 10000),
  weighted_contribution_basis_points integer not null
    check (weighted_contribution_basis_points between 0 and 10000),
  evidence_payload jsonb not null check (jsonb_typeof(evidence_payload) = 'object'),
  primary key (assessment_id, domain_id),
  foreign key (assessment_id)
    references public.assessments(assessment_id) on delete restrict
);

create table public.assessment_findings (
  finding_id public.contract_identifier primary key,
  assessment_id public.contract_identifier not null,
  finding_category text not null check (finding_category in (
    'CORRECT_ACTION',
    'UNSAFE_ACTION',
    'IMPORTANT_DELAY',
    'MISSED_OPPORTUNITY'
  )),
  rubric_item_id public.namespaced_identifier not null
    check (rubric_item_id like 'rubric-item.%'),
  rule_id public.namespaced_identifier,
  finding_status text not null
    check (finding_status in ('CONTINUOUS', 'FINAL')),
  reveal_policy text not null
    check (reveal_policy in ('PRACTICE_WHEN_RESOLVED', 'FINAL_DEBRIEF_ONLY')),
  evidence_payload jsonb not null check (jsonb_typeof(evidence_payload) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (assessment_id)
    references public.assessments(assessment_id) on delete restrict
);

create table public.assessment_debriefs (
  assessment_id public.contract_identifier primary key,
  debrief_schema_version public.schema_version not null,
  authority text not null check (authority = 'DETERMINISTIC_ASSESSMENT_EVIDENCE'),
  evidence_package_payload jsonb not null
    check (jsonb_typeof(evidence_package_payload) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (assessment_id)
    references public.assessments(assessment_id) on delete restrict
);
