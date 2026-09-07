import {
  LastKnownSafeSessionProjectionSchema,
  SafeSessionProjectionSchema
} from "../../../packages/contracts/src/index.ts";

export const SYNTHETIC_SAFE_SESSION = SafeSessionProjectionSchema.parse({
  session_id: "session.ui-neutral",
  status: "ACTIVE",
  mode: "PRACTICE_DEMO",
  pinned_case: {
    execution_authority: "PUBLISHED_PRODUCTION",
    case_package_id: "case-package.synthetic-ui.001",
    case_version_id: "case-version.synthetic-ui.001",
    case_version: "1.0.0"
  },
  state_version: 3,
  clinical_time: 125,
  event_sequence_through: 7,
  clock_status: "RUNNING",
  observations: {
    observation_schema_version: "1.0",
    projection_definition_id: "observation.synthetic-ui",
    session_id: "session.ui-neutral",
    case_version: "1.0.0",
    state_version: 3,
    clinical_time: 125,
    heart_rate_bpm: 72,
    systolic_bp_mm_hg: 112,
    diastolic_bp_mm_hg: 68,
    respiratory_rate_per_minute: 16,
    spo2_percent: 98,
    temperature_celsius: 36.7,
    consciousness_display_code: "consciousness.synthetic-alert",
    rhythm: {
      cardiac_rhythm: "rhythm.synthetic-regular",
      display_code: "rhythm-display.synthetic-regular",
      waveform_descriptor: "waveform.synthetic-regular"
    }
  },
  assessment_disclosure: {
    projection_schema_version: "1.0",
    projection_type: "ACTIVE_PRACTICE_FEEDBACK",
    assessment_id: "assessment.ui-neutral",
    session_id: "session.ui-neutral",
    session_mode: "PRACTICE_DEMO",
    assessment_status: "ACTIVE",
    resolved_findings: []
  }
});

export const SYNTHETIC_ASSESSMENT_SESSION = SafeSessionProjectionSchema.parse({
  ...SYNTHETIC_SAFE_SESSION,
  mode: "ASSESSMENT",
  assessment_disclosure: {
    projection_schema_version: "1.0",
    projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
    assessment_id: "assessment.ui-assessment",
    session_id: "session.ui-neutral",
    session_mode: "ASSESSMENT",
    assessment_status: "ACTIVE"
  }
});

export const SYNTHETIC_STALE_SESSION = LastKnownSafeSessionProjectionSchema.parse({
  recovery_schema_version: "1.0",
  principal_user_id: "20000000-0000-4000-8000-000000000015",
  session_id: "session.ui-neutral",
  freshness: "STALE_LAST_KNOWN",
  mutation_authority: "NONE",
  captured_at_utc: "2026-08-30T10:00:00.000Z",
  projection: SYNTHETIC_SAFE_SESSION
});
