import {
  ActionProposalSchema,
  ActionRequestSchema,
  ApiErrorResponseSchema,
  AuthoredLocaleSchema,
  CanonicalEventEnvelopeSchema,
  IntentCandidateSchema,
  JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY,
  PatientLanguageSchema,
  PatientStateSchema,
  SessionModeSchema,
  TutorOutputLocaleSchema,
  UNIVERSITY_OF_JORDAN
} from "../../packages/contracts/src/index.ts";

export const VALID_INTENT_CANDIDATE = {
  intent_candidate_id: "intent_01JTEST000000000000000001",
  authority: "NON_AUTHORITATIVE",
  action_reference: {
    resolution: "MATCHED",
    authority: "INTERPRETATION_ONLY",
    action_id: "investigation.generic-test"
  },
  parameters: { priority: "routine" },
  confidence: 0.92,
  is_ambiguous: false,
  missing_fields: [],
  requires_confirmation: true
} as const;

export const VALID_ACTION_REQUEST = {
  action_request_id: "actreq_01JTEST00000000000000001",
  catalogue_membership: "UNVERIFIED",
  command_id: "cmd_01JTEST0000000000000000001",
  session_id: "660e8400-e29b-41d4-a716-446655440000",
  action_id: "investigation.generic-test",
  request_schema_version: "1.0",
  expected_state_version: 2,
  requested_at_clinical_time: 15,
  parameters: { priority: "routine" },
  source: "UI",
  idempotency_key: "retry-key-001"
} as const;

export const VALID_ACTION_PROPOSAL = {
  action_proposal_id: "proposal_01JTEST00000000000000001",
  proposal_version: 1,
  action_request_id: "actreq_01JTEST00000000000000001",
  session_id: "660e8400-e29b-41d4-a716-446655440000",
  action_id: "investigation.generic-test",
  parameters: { priority: "routine" },
  validation: {
    status: "VALID",
    issues: [],
    confirmation_required: true
  },
  confirmation_state: "PENDING",
  execution_status: "PENDING_CONFIRMATION",
  proposed_at_clinical_time: 15
} as const;

export const VALID_EVENT = {
  event_id: "550e8400-e29b-41d4-a716-446655440000",
  session_id: "660e8400-e29b-41d4-a716-446655440000",
  sequence_no: 3,
  event_schema_version: "1.0",
  clinical_time: 15,
  real_time_utc: "2026-08-30T16:00:00.000Z",
  actor_type: "LEARNER",
  actor_id: "learner-001",
  source: "UI",
  correlation_id: "corr_01JTEST0000000000000000001",
  action_request_id: "actreq_01JTEST00000000000000001",
  action_id: "investigation.generic-test",
  event_type: "INVESTIGATION_ORDERED",
  parameters: { priority: "routine" },
  status: "COMMITTED",
  payload: { result_status: "pending" },
  clinical_effect_ids: [],
  state_version_before: 2,
  state_version_after: 2,
  scoring_evidence_refs: ["scoring-evidence.demo.001"],
  case_version: "2.0.0",
  idempotency_key: "retry-key-001",
  request_id: "req_01JTEST00000000000000000001"
} as const;

export const VALID_PATIENT_STATE = {
  state_schema_version: "1.0",
  state_version: 2,
  session_id: "660e8400-e29b-41d4-a716-446655440000",
  case_version: "2.0.0",
  clinical_time: 15,
  clinical_phase: "phase.initial",
  hemodynamic_state: "hemodynamics.stable",
  cardiac_rhythm: "rhythm.regular",
  perfusion: "perfusion.adequate",
  respiratory_state: "respiratory.normal",
  oxygenation: "oxygenation.adequate",
  consciousness: "consciousness.alert",
  neurologic_state: "neurologic.no-focal-deficit",
  temperature_state: "temperature.normal",
  metabolic_state: "metabolic.normal",
  pain_state: {
    severity_0_10: 0,
    location_codes: ["location.unspecified"],
    quality_codes: ["quality.none"],
    trend: "trend.none"
  },
  active_interventions: [
    {
      intervention_id: "intervention.demo.monitoring",
      intervention_type: "monitoring.generic",
      started_at_clinical_time: 0,
      parameters: {}
    }
  ],
  active_complications: [],
  outcome_flags: []
} as const;

export const VALID_API_ERROR = {
  api_schema_version: "1.0",
  request_id: "req_01JTEST00000000000000000001",
  error: {
    code: "STATE_VERSION_CONFLICT",
    message_key: "errors.state-version-conflict",
    user_safe_message: {
      locale: "en-US",
      text: "The simulation changed. Please retry."
    },
    correlation_id: "corr_01JTEST0000000000000000001",
    http_status: 409,
    retryable: true,
    field_issues: [
      {
        field_path: "expected_state_version",
        code: "STALE_VALUE",
        message_key: "errors.stale-value"
      }
    ]
  }
} as const;

export function createContractPortabilitySnapshot() {
  return {
    patient_languages: [
      PatientLanguageSchema.parse("ar-JO"),
      PatientLanguageSchema.parse("en-US")
    ],
    tutor_locale: TutorOutputLocaleSchema.parse("en-US"),
    authored_locale: AuthoredLocaleSchema.parse("ar-JO"),
    institutions: [
      UNIVERSITY_OF_JORDAN,
      JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY
    ],
    session_mode: SessionModeSchema.parse("PRACTICE_DEMO"),
    intent: IntentCandidateSchema.parse(VALID_INTENT_CANDIDATE),
    action_request: ActionRequestSchema.parse(VALID_ACTION_REQUEST),
    action_proposal: ActionProposalSchema.parse(VALID_ACTION_PROPOSAL),
    event: CanonicalEventEnvelopeSchema.parse(VALID_EVENT),
    patient_state: PatientStateSchema.parse(VALID_PATIENT_STATE),
    api_error: ApiErrorResponseSchema.parse(VALID_API_ERROR)
  };
}

export const CONTRACT_PORTABILITY_EXPECTED = JSON.stringify({
  patient_languages: ["ar-JO", "en-US"],
  tutor_locale: "en-US",
  authored_locale: "ar-JO",
  institutions: [
    {
      institution_id: "ju",
      institution_code: "JU",
      institution_name: "University of Jordan"
    },
    {
      institution_id: "just",
      institution_code: "JUST",
      institution_name: "Jordan University of Science and Technology"
    }
  ],
  session_mode: "PRACTICE_DEMO",
  intent: VALID_INTENT_CANDIDATE,
  action_request: VALID_ACTION_REQUEST,
  action_proposal: VALID_ACTION_PROPOSAL,
  event: VALID_EVENT,
  patient_state: VALID_PATIENT_STATE,
  api_error: VALID_API_ERROR
});
