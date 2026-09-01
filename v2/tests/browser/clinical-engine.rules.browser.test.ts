import { describe, expect, it } from "vitest";

import {
  ClinicalEvaluationTriggerSchema,
  PriorCommittedEventFactSchema,
  evaluateAllConditions,
  evaluateAnyCondition,
  initializeClinicalScheduler,
  validateSchedulerState
} from "../../packages/clinical-engine/src/index.ts";
import { FactIdSchema, PatientStateSchema } from "../../packages/contracts/src/index.ts";
import {
  BASELINE_PATIENT_STATE
} from "../fixtures/clinical-engine/synthetic-state.ts";
import {
  BASE_TRANSITION_INPUT,
  EMPTY_SCHEDULER_STATE,
  SYNTHETIC_COMMITTED_TRIGGER,
  createSyntheticRule,
  evaluateClinicalRules
} from "../fixtures/clinical-engine/synthetic-transitions.ts";

describe("bounded condition language", () => {
  const context = {
    state: BASELINE_PATIENT_STATE,
    trigger: ClinicalEvaluationTriggerSchema.parse(SYNTHETIC_COMMITTED_TRIGGER),
    clinicalTime: BASELINE_PATIENT_STATE.clinical_time,
    priorEvents: [PriorCommittedEventFactSchema.parse({
      event_type: "INVESTIGATION_ORDERED" as const,
      action_id: "investigation.synthetic-test",
      clinical_time: BASELINE_PATIENT_STATE.clinical_time
    })],
    caseFactIds: new Set([FactIdSchema.parse("fact.synthetic.concern")])
  };

  it("evaluates scalar, time, trigger, prior-event, fact, and absence predicates", () => {
    const conditions = [
      { condition_type: "STATE_NOT_EQUALS", target: "hemodynamic_state", value: "hemodynamics.other" },
      { condition_type: "INTERVENTION_ABSENT", intervention_id: "intervention.synthetic.marker" },
      { condition_type: "COMPLICATION_ABSENT", complication_id: "complication.synthetic.marker" },
      { condition_type: "OUTCOME_FLAG_ABSENT", outcome_flag: "outcome.synthetic-marker" },
      { condition_type: "CLINICAL_TIME_COMPARE", operator: "GTE", clinical_time: 45 },
      { condition_type: "TRIGGER_EVENT_TYPE", event_type: "EXAM_PERFORMED" },
      { condition_type: "TRIGGER_ACTION_ID", action_id: "examination.synthetic-check" },
      {
        condition_type: "PRIOR_EVENT_OCCURRED",
        event_type: "INVESTIGATION_ORDERED",
        action_id: "investigation.synthetic-test"
      },
      { condition_type: "CASE_FACT_PRESENT", fact_id: "fact.synthetic.concern" }
    ] as const;
    const parsed = createSyntheticRule({
      rule_id: "rule.synthetic.condition-parser",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      preconditions: conditions
    }).preconditions;
    expect(evaluateAllConditions(parsed, context).matched).toBe(true);
  });

  it("reports sorted failed ALL conditions and matched ANY exclusions", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.condition-failures",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      preconditions: [
        { condition_type: "OUTCOME_FLAG_PRESENT", outcome_flag: "outcome.synthetic-missing" },
        { condition_type: "CLINICAL_TIME_COMPARE", operator: "LT", clinical_time: 1 }
      ],
      exclusions: [
        { condition_type: "STATE_EQUALS", target: "cardiac_rhythm", value: "rhythm.synthetic-regular" }
      ]
    });
    expect(evaluateAllConditions(rule.preconditions, context).failedDetailCodes).toEqual([
      "condition.clinical-time-lt",
      "condition.outcome-flag-present"
    ]);
    expect(evaluateAnyCondition(rule.exclusions, context).matched).toBe(true);
  });

  it("covers present predicates and LTE/EQ/GT Clinical Time comparisons", () => {
    const populatedState = PatientStateSchema.parse({
      ...BASELINE_PATIENT_STATE,
      active_interventions: [{
        intervention_id: "intervention.synthetic.present",
        intervention_type: "intervention-type.synthetic",
        started_at_clinical_time: 40,
        parameters: {}
      }],
      active_complications: [{
        complication_id: "complication.synthetic.present",
        complication_type: "complication-type.synthetic",
        activated_at_clinical_time: 40,
        attributes: {}
      }]
    });
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.present-and-time",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      preconditions: [
        { condition_type: "INTERVENTION_PRESENT", intervention_id: "intervention.synthetic.present" },
        { condition_type: "COMPLICATION_PRESENT", complication_id: "complication.synthetic.present" },
        { condition_type: "CLINICAL_TIME_COMPARE", operator: "LTE", clinical_time: 45 },
        { condition_type: "CLINICAL_TIME_COMPARE", operator: "EQ", clinical_time: 45 },
        { condition_type: "CLINICAL_TIME_COMPARE", operator: "GT", clinical_time: 44 }
      ],
      exclusions: [
        { condition_type: "INTERVENTION_ABSENT", intervention_id: "intervention.synthetic.present" },
        { condition_type: "COMPLICATION_ABSENT", complication_id: "complication.synthetic.present" }
      ]
    });
    const populatedContext = { ...context, state: populatedState };
    expect(evaluateAllConditions(rule.preconditions, populatedContext).matched).toBe(true);
    expect(evaluateAnyCondition(rule.exclusions, populatedContext).matched).toBe(false);
  });
});

describe("typed collection and pain effects", () => {
  it("adds then removes typed interventions, complications, outcomes, and pain immutably", () => {
    const addRule = createSyntheticRule({
      rule_id: "rule.synthetic.add-records",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "SET_PAIN_STATE",
          effect_id: "effect.synthetic.set-pain",
          value: {
            severity_0_10: 2,
            location_codes: ["location.synthetic-marker"],
            quality_codes: ["quality.synthetic-marker"],
            trend: "trend.synthetic-changed"
          }
        },
        {
          effect_type: "ADD_INTERVENTION",
          effect_id: "effect.synthetic.add-intervention",
          intervention_id: "intervention.synthetic.marker",
          intervention_type: "intervention-type.synthetic-marker",
          parameters: { fixture_only: true }
        },
        {
          effect_type: "ADD_COMPLICATION",
          effect_id: "effect.synthetic.add-complication-now",
          complication_id: "complication.synthetic.marker",
          complication_type: "complication-type.synthetic-marker",
          attributes: { fixture_only: true }
        },
        {
          effect_type: "ADD_OUTCOME_FLAG",
          effect_id: "effect.synthetic.add-outcome",
          outcome_flag: "outcome.synthetic-marker"
        }
      ]
    });
    const added = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [addRule] });
    expect(added.success).toBe(true);
    if (!added.success) return;
    expect(added.next_state.pain_state.severity_0_10).toBe(2);
    expect(added.next_state.active_interventions[0]?.started_at_clinical_time).toBe(45);
    expect(added.next_state.active_complications[0]?.activated_at_clinical_time).toBe(45);
    expect(added.next_state.outcome_flags).toEqual(["outcome.synthetic-marker"]);
    expect(BASELINE_PATIENT_STATE.active_interventions).toEqual([]);

    const removeRule = createSyntheticRule({
      rule_id: "rule.synthetic.remove-records",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "REMOVE_INTERVENTION",
          effect_id: "effect.synthetic.remove-intervention",
          intervention_id: "intervention.synthetic.marker"
        },
        {
          effect_type: "REMOVE_COMPLICATION",
          effect_id: "effect.synthetic.remove-complication",
          complication_id: "complication.synthetic.marker"
        },
        {
          effect_type: "REMOVE_OUTCOME_FLAG",
          effect_id: "effect.synthetic.remove-outcome",
          outcome_flag: "outcome.synthetic-marker"
        }
      ]
    });
    const removed = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      state: added.next_state,
      rules: [removeRule]
    });
    expect(removed.success).toBe(true);
    if (!removed.success) return;
    expect(removed.next_state.active_interventions).toEqual([]);
    expect(removed.next_state.active_complications).toEqual([]);
    expect(removed.next_state.outcome_flags).toEqual([]);
  });
});

describe("scheduler validation boundary", () => {
  it("rejects duplicate scheduled-item identities deterministically", () => {
    const item = {
      scheduler_schema_version: "1.0",
      scheduled_item_id: "scheduled-item.synthetic.duplicate",
      originating_rule_id: "rule.synthetic.source",
      category: "schedule.synthetic-duplicate",
      due_clinical_time: 50,
      priority: 1,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    };
    const result = validateSchedulerState({
      scheduler_schema_version: "1.0",
      pending_items: [item, item]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "DUPLICATE_SCHEDULED_ITEM_ID"
    ]);
  });

  it("initializes a sorted scheduler without mutating authored items", () => {
    const later = {
      scheduler_schema_version: "1.0",
      scheduled_item_id: "scheduled-item.synthetic.later",
      originating_rule_id: "rule.synthetic.source",
      category: "schedule.synthetic-order",
      due_clinical_time: 60,
      priority: 1,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    };
    const sooner = { ...later, scheduled_item_id: "scheduled-item.synthetic.sooner", due_clinical_time: 50 };
    const source = [later, sooner];
    const snapshot = JSON.stringify(source);
    const result = initializeClinicalScheduler(source);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.schedulerState.pending_items.map((item) => item.scheduled_item_id)).toEqual([
      "scheduled-item.synthetic.sooner",
      "scheduled-item.synthetic.later"
    ]);
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it("contains simultaneous malformed state/rules/scheduler/definition as explicit issues", () => {
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      state: { invalid: true },
      rules: [{ rule_schema_version: "999.0" }],
      scheduler_state: { invalid: true },
      observation_projection: { invalid: true }
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.length).toBeGreaterThan(3);
    expect(result).not.toHaveProperty("next_state");
  });

  it("keeps the empty scheduler contract strict", () => {
    expect(EMPTY_SCHEDULER_STATE).toEqual({
      scheduler_schema_version: "1.0",
      pending_items: []
    });
  });
});
