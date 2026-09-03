import {
  PINNED_CLINICAL_POLICY_SCHEMA_VERSION,
  PinnedClinicalPolicyEnvelopeSchema,
  SCHEDULER_SCHEMA_VERSION,
  SchedulerStateSchema,
  TransitionRuleSchema,
  type TransitionRule
} from "../../../packages/contracts/src/index.ts";
import {
  evaluatePinnedClinicalPolicy,
  type ClinicalTransitionResult
} from "../../../packages/clinical-engine/src/index.ts";

import {
  BASELINE_PATIENT_STATE,
  SYNTHETIC_OBSERVATION_DEFINITION
} from "./synthetic-state.ts";

export const EMPTY_SCHEDULER_STATE = SchedulerStateSchema.parse({
  scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
  pending_items: []
});

export function createSyntheticRule(
  overrides: { rule_id: string; trigger: unknown; [key: string]: unknown }
): TransitionRule {
  return TransitionRuleSchema.parse({
    rule_schema_version: "1.0",
    rule_version: "1.0.0",
    preconditions: [],
    exclusions: [],
    priority: 10,
    conflict_policy: "REPLACE",
    effects: [],
    emitted_events: [],
    referenced_action_ids: [],
    referenced_rule_ids: [],
    referenced_fact_ids: [],
    source_ids: ["source.synthetic.001"],
    timing_window_ids: [],
    scoring_evidence_refs: [],
    ...overrides
  });
}

export const SYNTHETIC_COMMITTED_TRIGGER = {
  trigger_type: "COMMITTED_EVENT" as const,
  event_type: "EXAM_PERFORMED" as const,
  action_id: "examination.synthetic-check"
};

export const IMMEDIATE_TRANSITION_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.immediate",
  trigger: SYNTHETIC_COMMITTED_TRIGGER,
  effects: [
    {
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.set-hemodynamics",
      target: "hemodynamic_state",
      value: "hemodynamics.synthetic-altered"
    }
  ],
  emitted_events: [
    {
      event_type: "PATIENT_STATE_CHANGED",
      parameters: { fixture_only: true },
      payload: { state_channel: "hemodynamic_state" },
      clinical_effect_ids: []
    }
  ],
  referenced_action_ids: ["examination.synthetic-check"]
});

export const DELAYED_TRANSITION_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.delayed",
  trigger: SYNTHETIC_COMMITTED_TRIGGER,
  priority: 20,
  effects: [
    {
      effect_type: "SCHEDULE_RELATIVE",
      effect_id: "effect.synthetic.schedule-alteration",
      scheduled_item_id: "scheduled-item.synthetic.alteration",
      category: "schedule.synthetic-progression",
      delay_clinical_seconds: 5,
      priority: 20,
      conflict_policy: "REPLACE",
      effects: [
        {
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.set-respiratory",
          target: "respiratory_state",
          value: "respiratory.synthetic-altered"
        },
        {
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.set-oxygenation",
          target: "oxygenation",
          value: "oxygenation.synthetic-altered"
        },
        {
          effect_type: "ADD_COMPLICATION",
          effect_id: "effect.synthetic.add-complication",
          complication_id: "complication.synthetic.marker",
          complication_type: "complication-type.synthetic-marker",
          attributes: { fixture_only: true }
        }
      ],
      emitted_events: [
        {
          event_type: "COMPLICATION_ACTIVATED",
          parameters: { fixture_only: true },
          payload: { complication_id: "complication.synthetic.marker" },
          clinical_effect_ids: []
        }
      ]
    }
  ],
  referenced_action_ids: ["examination.synthetic-check"]
});

export const CANCEL_TRANSITION_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.cancel",
  trigger: {
    trigger_type: "COMMITTED_EVENT",
    event_type: "PROCEDURE_CANCELLED",
    action_id: "procedure.synthetic-step"
  },
  effects: [
    {
      effect_type: "CANCEL_SCHEDULED",
      effect_id: "effect.synthetic.cancel-alteration",
      selector: {
        selector_type: "SCHEDULED_ITEM_ID",
        scheduled_item_id: "scheduled-item.synthetic.alteration"
      }
    }
  ],
  referenced_action_ids: ["procedure.synthetic-step"]
});

export const ABSOLUTE_SCHEDULE_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.absolute",
  trigger: {
    trigger_type: "CLINICAL_TIME_THRESHOLD",
    threshold_clinical_time: 45
  },
  effects: [
    {
      effect_type: "SCHEDULE_ABSOLUTE",
      effect_id: "effect.synthetic.schedule-absolute",
      scheduled_item_id: "scheduled-item.synthetic.absolute",
      category: "schedule.synthetic-absolute",
      due_clinical_time: 55,
      priority: 5,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: [
        {
          event_type: "INVESTIGATION_RESULT_AVAILABLE",
          parameters: { fixture_only: true },
          payload: { result: "synthetic" },
          clinical_effect_ids: []
        }
      ]
    }
  ]
});

export const DERIVED_STATE_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.derived",
  trigger: {
    trigger_type: "STATE_CONDITION",
    conditions: [
      {
        condition_type: "STATE_EQUALS",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-altered"
      }
    ]
  },
  effects: [
    {
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.set-consciousness",
      target: "consciousness",
      value: "consciousness.synthetic-changed"
    }
  ]
});

export function createSyntheticPinnedPolicy(
  rules: readonly TransitionRule[] = [IMMEDIATE_TRANSITION_RULE]
) {
  return PinnedClinicalPolicyEnvelopeSchema.parse({
    policy_schema_version: PINNED_CLINICAL_POLICY_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    case_package_id: "case-package.synthetic.001",
    case_version_id: "case-version.synthetic.001",
    case_version: "2.0.0",
    package_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    review_subject_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    rule_schema_version: "1.0",
    rules,
    timeline_policy: {
      scheduler_schema_version: "1.0",
      time_ratio: 1,
      pause_policy: "PAUSE_CLINICAL_TIME",
      max_derived_evaluations: 16,
      interrupting_event_types: [],
      initial_scheduled_items: []
    },
    observation_projection: SYNTHETIC_OBSERVATION_DEFINITION,
    approved_case_fact_ids: ["fact.synthetic.concern"],
    module_hashes: {
      rules: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      timeline_policy: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      initial_state: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      clinical_facts: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    }
  });
}

export function syntheticPolicyWithRules(rules: readonly TransitionRule[]) {
  return createSyntheticPinnedPolicy(rules);
}

export const BASE_TRANSITION_INPUT = {
  operation: "EVALUATE_TRIGGER" as const,
  policy: createSyntheticPinnedPolicy(),
  state: BASELINE_PATIENT_STATE,
  scheduler_state: EMPTY_SCHEDULER_STATE,
  trigger: SYNTHETIC_COMMITTED_TRIGGER,
  current_clinical_time: 45,
  prior_event_facts: []
};

// Test-only adapters let pre-correction behavioral cases stay focused while
// production package exports expose only the pinned-policy entry point.
export function evaluateClinicalRules(
  input: Record<string, unknown>
): ClinicalTransitionResult {
  const {
    rules,
    case_fact_ids: caseFactIds,
    observation_projection: observationProjection,
    max_derived_evaluations: maxDerivedEvaluations,
    operation: _operation,
    ...runtime
  } = input;
  const basePolicy = PinnedClinicalPolicyEnvelopeSchema.parse(runtime.policy);
  const policy = PinnedClinicalPolicyEnvelopeSchema.safeParse({
    ...basePolicy,
    ...(rules === undefined ? {} : { rules }),
    ...(caseFactIds === undefined ? {} : { approved_case_fact_ids: caseFactIds }),
    ...(observationProjection === undefined
      ? {}
      : { observation_projection: observationProjection }),
    timeline_policy: {
      ...basePolicy.timeline_policy,
      ...(maxDerivedEvaluations === undefined
        ? {}
        : { max_derived_evaluations: maxDerivedEvaluations })
    }
  });

  return evaluatePinnedClinicalPolicy({
    operation: "EVALUATE_TRIGGER",
    ...runtime,
    policy: policy.success ? policy.data : {
      ...basePolicy,
      ...(rules === undefined ? {} : { rules }),
      ...(observationProjection === undefined
        ? {}
        : { observation_projection: observationProjection })
    }
  });
}

export function processDueScheduledItems(
  input: Record<string, unknown>
): ClinicalTransitionResult {
  const {
    rules,
    case_fact_ids: caseFactIds,
    observation_projection: observationProjection,
    max_derived_evaluations: maxDerivedEvaluations,
    current_clinical_time: _current,
    trigger: _trigger,
    operation: _operation,
    ...runtime
  } = input;
  const basePolicy = PinnedClinicalPolicyEnvelopeSchema.parse(runtime.policy);

  return evaluatePinnedClinicalPolicy({
    operation: "PROCESS_DUE",
    ...runtime,
    policy: {
      ...basePolicy,
      ...(rules === undefined ? {} : { rules }),
      ...(caseFactIds === undefined ? {} : { approved_case_fact_ids: caseFactIds }),
      ...(observationProjection === undefined
        ? {}
        : { observation_projection: observationProjection }),
      timeline_policy: {
        ...basePolicy.timeline_policy,
        ...(maxDerivedEvaluations === undefined
          ? {}
          : { max_derived_evaluations: maxDerivedEvaluations })
      }
    }
  });
}
