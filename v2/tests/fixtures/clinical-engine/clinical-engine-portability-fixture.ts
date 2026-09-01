import {
  evaluatePinnedClinicalPolicy,
  initializeClinicalScheduler,
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
import {
  BASE_TRANSITION_INPUT,
  CANCEL_TRANSITION_RULE,
  DELAYED_TRANSITION_RULE,
  createSyntheticPinnedPolicy,
  createSyntheticRule
} from "./synthetic-transitions.ts";
import { TEST_HASH_ADAPTER } from "../cases/synthetic-case.ts";

function requireTransition(result: ReturnType<typeof evaluatePinnedClinicalPolicy>) {
  if (!result.success) {
    throw new Error(`Synthetic transition failed: ${JSON.stringify(result.issues)}`);
  }
  return result;
}

export function createV2005TransitionPortabilitySnapshot() {
  const immediate = requireTransition(evaluatePinnedClinicalPolicy(BASE_TRANSITION_INPUT));
  const delayed = requireTransition(evaluatePinnedClinicalPolicy({
    ...BASE_TRANSITION_INPUT,
    policy: createSyntheticPinnedPolicy([DELAYED_TRANSITION_RULE])
  }));
  const { current_clinical_time: _time, trigger: _trigger, operation: _operation, ...dueBase } = BASE_TRANSITION_INPUT;
  const due = requireTransition(evaluatePinnedClinicalPolicy({
    operation: "PROCESS_DUE",
    ...dueBase,
    policy: createSyntheticPinnedPolicy([]),
    scheduler_state: delayed.next_scheduler_state,
    target_clinical_time: 50
  }));
  const cancelled = requireTransition(evaluatePinnedClinicalPolicy({
    ...BASE_TRANSITION_INPUT,
    policy: createSyntheticPinnedPolicy([CANCEL_TRANSITION_RULE]),
    scheduler_state: delayed.next_scheduler_state,
    trigger: {
      trigger_type: "COMMITTED_EVENT",
      event_type: "PROCEDURE_CANCELLED",
      action_id: "procedure.synthetic-step"
    }
  }));
  const higher = createSyntheticRule({
    rule_id: "rule.synthetic.portability-higher",
    trigger: BASE_TRANSITION_INPUT.trigger,
    priority: 20,
    conflict_policy: "HIGHEST_PRIORITY",
    effects: [{
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.portability-higher",
      target: "hemodynamic_state",
      value: "hemodynamics.synthetic-altered"
    }]
  });
  const lower = createSyntheticRule({
    rule_id: "rule.synthetic.portability-lower",
    trigger: BASE_TRANSITION_INPUT.trigger,
    priority: 10,
    conflict_policy: "HIGHEST_PRIORITY",
    effects: [{
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.portability-lower",
      target: "hemodynamic_state",
      value: "hemodynamics.synthetic-baseline"
    }]
  });
  const conflict = requireTransition(evaluatePinnedClinicalPolicy({
    ...BASE_TRANSITION_INPUT,
    policy: createSyntheticPinnedPolicy([lower, higher])
  }));
  const chainFirst = createSyntheticRule({
    rule_id: "rule.synthetic.portability-chain-first",
    trigger: {
      trigger_type: "SCHEDULED_ITEM",
      scheduled_item_id: "scheduled-item.synthetic.portability-chain-a"
    },
    effects: [{
      effect_type: "SCHEDULE_RELATIVE",
      effect_id: "effect.synthetic.portability-chain-b",
      scheduled_item_id: "scheduled-item.synthetic.portability-chain-b",
      category: "schedule.synthetic-portability-chain",
      delay_clinical_seconds: 1,
      priority: 10,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    }]
  });
  const chainSecond = createSyntheticRule({
    rule_id: "rule.synthetic.portability-chain-second",
    trigger: {
      trigger_type: "SCHEDULED_ITEM",
      scheduled_item_id: "scheduled-item.synthetic.portability-chain-b"
    },
    effects: [{
      effect_type: "SCHEDULE_RELATIVE",
      effect_id: "effect.synthetic.portability-chain-c",
      scheduled_item_id: "scheduled-item.synthetic.portability-chain-c",
      category: "schedule.synthetic-portability-chain",
      delay_clinical_seconds: 1,
      priority: 10,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    }]
  });
  const chainScheduler = initializeClinicalScheduler([{
    scheduler_schema_version: "1.0",
    scheduled_item_id: "scheduled-item.synthetic.portability-chain-a",
    originating_rule_id: "rule.synthetic.portability-chain-first",
    category: "schedule.synthetic-portability-chain",
    due_clinical_time: 46,
    priority: 10,
    conflict_policy: "REPLACE",
    effects: [],
    emitted_events: []
  }]);
  if (!chainScheduler.success) {
    throw new Error(`Synthetic chain scheduler failed: ${JSON.stringify(chainScheduler.issues)}`);
  }
  const dueChain = requireTransition(evaluatePinnedClinicalPolicy({
    operation: "PROCESS_DUE",
    policy: createSyntheticPinnedPolicy([chainFirst, chainSecond]),
    state: BASE_TRANSITION_INPUT.state,
    scheduler_state: chainScheduler.schedulerState,
    prior_event_facts: [],
    target_clinical_time: 50
  }));

  return {
    immediate: {
      next_state: immediate.next_state,
      observations: immediate.observations,
      event_proposals: immediate.event_proposals,
      trace: immediate.trace
    },
    delayed: {
      next_scheduler_state: delayed.next_scheduler_state,
      trace: delayed.trace
    },
    due: {
      next_state: due.next_state,
      next_scheduler_state: due.next_scheduler_state,
      observations: due.observations,
      event_proposals: due.event_proposals,
      trace: due.trace
    },
    cancellation: {
      next_scheduler_state: cancelled.next_scheduler_state,
      trace: cancelled.trace
    },
    conflict: {
      next_state: conflict.next_state,
      observations: conflict.observations,
      trace: conflict.trace
    },
    due_chain: {
      next_scheduler_state: dueChain.next_scheduler_state,
      trace: dueChain.trace
    }
  };
}

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

export async function createV2005TransitionPortabilityFingerprint() {
  const serialized = JSON.stringify(createV2005TransitionPortabilitySnapshot());
  return {
    serialized,
    byte_length: new TextEncoder().encode(serialized).byteLength,
    fingerprint: await TEST_HASH_ADAPTER.sha256(serialized)
  };
}

export const V2_005_TRANSITION_PORTABILITY_EXPECTED = {
  byte_length: 20339,
  fingerprint: "1370bfc9ae51b657a00f414504c88b67cb3bf59175af5737a70bee9574313ac7"
} as const;

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
