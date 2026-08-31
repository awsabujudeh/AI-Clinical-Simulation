import {
  ObservationProjectionDefinitionSchema,
  PatientStateSchema
} from "../../../packages/contracts/src/index.ts";

export const SYNTHETIC_SESSION_ID = "session.synthetic.001";

export const BASELINE_PATIENT_STATE = PatientStateSchema.parse({
  state_schema_version: "1.0",
  state_version: 4,
  session_id: SYNTHETIC_SESSION_ID,
  case_version: "2.0.0",
  clinical_time: 45,
  clinical_phase: "phase.synthetic-baseline",
  hemodynamic_state: "hemodynamics.synthetic-baseline",
  cardiac_rhythm: "rhythm.synthetic-regular",
  perfusion: "perfusion.synthetic-baseline",
  respiratory_state: "respiratory.synthetic-baseline",
  oxygenation: "oxygenation.synthetic-baseline",
  consciousness: "consciousness.synthetic-awake",
  neurologic_state: "neurologic.synthetic-baseline",
  temperature_state: "temperature.synthetic-baseline",
  metabolic_state: "metabolic.synthetic-baseline",
  pain_state: {
    severity_0_10: 0,
    location_codes: ["location.synthetic-unspecified"],
    quality_codes: ["quality.synthetic-none"],
    trend: "trend.synthetic-unchanged"
  },
  active_interventions: [],
  active_complications: [],
  outcome_flags: []
});

export const EXPLICIT_ALTERNATIVE_RHYTHM_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  cardiac_rhythm: "rhythm.synthetic-alternative"
});

export const ALTERED_HEMODYNAMIC_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  hemodynamic_state: "hemodynamics.synthetic-altered"
});

export const HIGH_RATE_PATIENT_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  hemodynamic_state: "hemodynamics.synthetic-high-rate"
});

export const LOW_PRESSURE_PATIENT_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  hemodynamic_state: "hemodynamics.synthetic-low-pressure"
});

export const ALTERED_RESPIRATORY_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  respiratory_state: "respiratory.synthetic-altered",
  oxygenation: "oxygenation.synthetic-altered"
});

export const CHANGED_CONSCIOUSNESS_STATE = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  consciousness: "consciousness.synthetic-changed"
});

export const STATE_WITH_ACTIVE_ITEMS = PatientStateSchema.parse({
  ...BASELINE_PATIENT_STATE,
  active_interventions: [
    {
      intervention_id: "intervention.synthetic.monitoring",
      intervention_type: "intervention-type.synthetic-monitoring",
      started_at_clinical_time: 10,
      parameters: { fixture_only: true }
    }
  ],
  active_complications: [
    {
      complication_id: "complication.synthetic.marker",
      complication_type: "complication-type.synthetic-marker",
      activated_at_clinical_time: 20,
      attributes: { fixture_only: true }
    }
  ],
  outcome_flags: ["outcome.synthetic-marker"]
});

export const SYNTHETIC_OBSERVATION_DEFINITION = ObservationProjectionDefinitionSchema.parse({
  projection_schema_version: "1.0",
  projection_definition_id: "projection.synthetic-observations-v1",
  hemodynamic_mappings: {
    "hemodynamics.synthetic-baseline": {
      heart_rate_bpm: 72,
      systolic_bp_mm_hg: 118,
      diastolic_bp_mm_hg: 74
    },
    "hemodynamics.synthetic-altered": {
      heart_rate_bpm: 88,
      systolic_bp_mm_hg: 104,
      diastolic_bp_mm_hg: 66
    },
    "hemodynamics.synthetic-high-rate": {
      heart_rate_bpm: 190,
      systolic_bp_mm_hg: 118,
      diastolic_bp_mm_hg: 74
    },
    "hemodynamics.synthetic-low-pressure": {
      heart_rate_bpm: 72,
      systolic_bp_mm_hg: 76,
      diastolic_bp_mm_hg: 44
    }
  },
  respiratory_mappings: {
    "respiratory.synthetic-baseline": {
      respiratory_rate_per_minute: 14
    },
    "respiratory.synthetic-altered": {
      respiratory_rate_per_minute: 24
    }
  },
  oxygenation_mappings: {
    "oxygenation.synthetic-baseline": { spo2_percent: 98 },
    "oxygenation.synthetic-altered": { spo2_percent: 91 }
  },
  temperature_mappings: {
    "temperature.synthetic-baseline": { temperature_celsius: 36.8 }
  },
  consciousness_mappings: {
    "consciousness.synthetic-awake": {
      display_code: "display.consciousness-awake"
    },
    "consciousness.synthetic-changed": {
      display_code: "display.consciousness-changed"
    }
  },
  rhythm_mappings: {
    "rhythm.synthetic-regular": {
      display_code: "display.rhythm-regular",
      waveform_descriptor: "waveform.synthetic-regular"
    },
    "rhythm.synthetic-alternative": {
      display_code: "display.rhythm-alternative",
      waveform_descriptor: "waveform.synthetic-alternative"
    }
  }
});
