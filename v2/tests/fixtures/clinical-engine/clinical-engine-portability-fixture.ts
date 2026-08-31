import {
  initializePatientState,
  projectObservations
} from "../../../packages/clinical-engine/src/index.ts";
import { MINIMAL_DRAFT_CASE } from "../cases/synthetic-case.ts";
import {
  ALTERED_HEMODYNAMIC_STATE,
  BASELINE_PATIENT_STATE,
  EXPLICIT_ALTERNATIVE_RHYTHM_STATE,
  SYNTHETIC_OBSERVATION_DEFINITION,
  SYNTHETIC_SESSION_ID
} from "./synthetic-state.ts";

function requireProjection(
  state: unknown
) {
  const result = projectObservations(state, SYNTHETIC_OBSERVATION_DEFINITION);

  if (!result.success) {
    throw new Error(`Synthetic projection failed: ${JSON.stringify(result.issues)}`);
  }

  return result.observations;
}

export function createClinicalEnginePortabilitySnapshot() {
  const initialized = initializePatientState(
    MINIMAL_DRAFT_CASE.initial_state.patient_state,
    SYNTHETIC_SESSION_ID
  );

  if (!initialized.success) {
    throw new Error(`Synthetic initialization failed: ${JSON.stringify(initialized.issues)}`);
  }

  const caseOwnedDefinition = MINIMAL_DRAFT_CASE.initial_state.observation_projection;

  if (caseOwnedDefinition === undefined) {
    throw new Error("Synthetic Case Package is missing its inline observation policy.");
  }

  return {
    case_owned_initial: requireProjectionFromDefinition(
      initialized.state,
      caseOwnedDefinition
    ),
    baseline: requireProjection(BASELINE_PATIENT_STATE),
    altered_hemodynamics: requireProjection(ALTERED_HEMODYNAMIC_STATE),
    explicit_alternative_rhythm: requireProjection(EXPLICIT_ALTERNATIVE_RHYTHM_STATE)
  };
}

function requireProjectionFromDefinition(
  state: unknown,
  definition: unknown
) {
  const result = projectObservations(state, definition);

  if (!result.success) {
    throw new Error(`Synthetic Case-owned projection failed: ${JSON.stringify(result.issues)}`);
  }

  return result.observations;
}

export const CLINICAL_ENGINE_PORTABILITY_EXPECTED = JSON.stringify({
  case_owned_initial: {
    observation_schema_version: "1.0",
    projection_definition_id: "projection.synthetic-case-v1",
    session_id: "session.synthetic.001",
    case_version: "2.0.0",
    state_version: 0,
    clinical_time: 0,
    heart_rate_bpm: 70,
    systolic_bp_mm_hg: 110,
    diastolic_bp_mm_hg: 70,
    respiratory_rate_per_minute: 15,
    spo2_percent: 97,
    temperature_celsius: 36.5,
    consciousness_display_code: "display.consciousness-alert",
    rhythm: {
      cardiac_rhythm: "rhythm.neutral",
      display_code: "display.rhythm-neutral",
      waveform_descriptor: "waveform.synthetic-neutral"
    }
  },
  baseline: {
    observation_schema_version: "1.0",
    projection_definition_id: "projection.synthetic-observations-v1",
    session_id: "session.synthetic.001",
    case_version: "2.0.0",
    state_version: 4,
    clinical_time: 45,
    heart_rate_bpm: 72,
    systolic_bp_mm_hg: 118,
    diastolic_bp_mm_hg: 74,
    respiratory_rate_per_minute: 14,
    spo2_percent: 98,
    temperature_celsius: 36.8,
    consciousness_display_code: "display.consciousness-awake",
    rhythm: {
      cardiac_rhythm: "rhythm.synthetic-regular",
      display_code: "display.rhythm-regular",
      waveform_descriptor: "waveform.synthetic-regular"
    }
  },
  altered_hemodynamics: {
    observation_schema_version: "1.0",
    projection_definition_id: "projection.synthetic-observations-v1",
    session_id: "session.synthetic.001",
    case_version: "2.0.0",
    state_version: 4,
    clinical_time: 45,
    heart_rate_bpm: 88,
    systolic_bp_mm_hg: 104,
    diastolic_bp_mm_hg: 66,
    respiratory_rate_per_minute: 14,
    spo2_percent: 98,
    temperature_celsius: 36.8,
    consciousness_display_code: "display.consciousness-awake",
    rhythm: {
      cardiac_rhythm: "rhythm.synthetic-regular",
      display_code: "display.rhythm-regular",
      waveform_descriptor: "waveform.synthetic-regular"
    }
  },
  explicit_alternative_rhythm: {
    observation_schema_version: "1.0",
    projection_definition_id: "projection.synthetic-observations-v1",
    session_id: "session.synthetic.001",
    case_version: "2.0.0",
    state_version: 4,
    clinical_time: 45,
    heart_rate_bpm: 72,
    systolic_bp_mm_hg: 118,
    diastolic_bp_mm_hg: 74,
    respiratory_rate_per_minute: 14,
    spo2_percent: 98,
    temperature_celsius: 36.8,
    consciousness_display_code: "display.consciousness-awake",
    rhythm: {
      cardiac_rhythm: "rhythm.synthetic-alternative",
      display_code: "display.rhythm-alternative",
      waveform_descriptor: "waveform.synthetic-alternative"
    }
  }
});
