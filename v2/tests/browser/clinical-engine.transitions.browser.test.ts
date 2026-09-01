import { describe, expect, it } from "vitest";

import { initializeClinicalScheduler } from "../../packages/clinical-engine/src/index.ts";
import {
  BASELINE_PATIENT_STATE,
  SYNTHETIC_OBSERVATION_DEFINITION
} from "../fixtures/clinical-engine/synthetic-state.ts";
import {
  ABSOLUTE_SCHEDULE_RULE,
  BASE_TRANSITION_INPUT,
  CANCEL_TRANSITION_RULE,
  DELAYED_TRANSITION_RULE,
  DERIVED_STATE_RULE,
  EMPTY_SCHEDULER_STATE,
  IMMEDIATE_TRANSITION_RULE,
  SYNTHETIC_COMMITTED_TRIGGER,
  createSyntheticRule,
  evaluateClinicalRules,
  processDueScheduledItems
} from "../fixtures/clinical-engine/synthetic-transitions.ts";

function requireSuccess(result: ReturnType<typeof evaluateClinicalRules>) {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result;
}

function dueInput(
  schedulerState: typeof EMPTY_SCHEDULER_STATE,
  targetClinicalTime: number
) {
  const { current_clinical_time: _omitted, trigger: _trigger, ...shared } = BASE_TRANSITION_INPUT;
  return {
    ...shared,
    rules: [],
    scheduler_state: schedulerState,
    target_clinical_time: targetClinicalTime
  };
}

describe("declarative immediate transitions", () => {
  it("constructs one immutable next state and downstream observations", () => {
    const sourceSnapshot = JSON.stringify(BASE_TRANSITION_INPUT);
    const result = requireSuccess(evaluateClinicalRules(BASE_TRANSITION_INPUT));

    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
    expect(result.state_version_before).toBe(4);
    expect(result.state_version_after).toBe(5);
    expect(result.clinical_time_after).toBe(45);
    expect(result.observations.heart_rate_bpm).toBe(88);
    expect(result.observations.rhythm.cardiac_rhythm).toBe("rhythm.synthetic-regular");
    expect(result.event_proposals).toHaveLength(1);
    expect(result.event_proposals[0]).not.toHaveProperty("event_id");
    expect(result.event_proposals[0]).not.toHaveProperty("sequence_no");
    expect(result.event_proposals[0]).not.toHaveProperty("real_time_utc");
    expect(JSON.stringify(BASE_TRANSITION_INPUT)).toBe(sourceSnapshot);
  });

  it("returns byte-identical result and trace for identical input", () => {
    const first = evaluateClinicalRules(BASE_TRANSITION_INPUT);
    const second = evaluateClinicalRules(BASE_TRANSITION_INPUT);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("uses ALL preconditions and ANY exclusions deterministically", () => {
    const eligible = createSyntheticRule({
      rule_id: "rule.synthetic.conditions",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      preconditions: [
        {
          condition_type: "STATE_EQUALS",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-baseline"
        },
        {
          condition_type: "CASE_FACT_PRESENT",
          fact_id: "fact.synthetic.concern"
        }
      ],
      exclusions: [
        {
          condition_type: "OUTCOME_FLAG_PRESENT",
          outcome_flag: "outcome.synthetic-blocked"
        }
      ],
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.condition-match",
        target: "consciousness",
        value: "consciousness.synthetic-changed"
      }]
    });
    const success = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [eligible]
    }));
    expect(success.next_state.consciousness).toBe("consciousness.synthetic-changed");

    const excludedState = {
      ...BASELINE_PATIENT_STATE,
      outcome_flags: ["outcome.synthetic-blocked"]
    };
    const excluded = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      state: excludedState,
      rules: [eligible]
    }));
    expect(excluded.next_state.consciousness).toBe("consciousness.synthetic-awake");
    expect(excluded.trace.entries.some((entry) => entry.kind === "RULE_EXCLUDED")).toBe(true);
  });

  it("keeps state version unchanged for a same-time no-op evaluation", () => {
    const result = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: []
    }));
    expect(result.state_changed).toBe(false);
    expect(result.state_version_after).toBe(4);
    expect(result.clinical_time_after).toBe(45);
  });

  it("advances clinical time and exactly one proposed version without hidden jumps", () => {
    const result = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [],
      trigger: { trigger_type: "CLINICAL_TIME", target_clinical_time: 50 },
      current_clinical_time: 50
    }));
    expect(result.state_changed).toBe(true);
    expect(result.state_version_after).toBe(5);
    expect(result.clinical_time_after).toBe(50);
  });

  it("fails explicitly on clinical-time regression", () => {
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      current_clinical_time: 44
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["CLINICAL_TIME_REGRESSION"]);
  });

  it("fails closed when a resulting state has no pinned observation mapping", () => {
    const unmapped = createSyntheticRule({
      rule_id: "rule.synthetic.unmapped",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.unmapped",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-unmapped"
      }]
    });
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [unmapped] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("OBSERVATION_PROJECTION_FAILED");
  });

  it("contains malformed rules and unsupported versions inside Result failure", () => {
    const malformed = JSON.parse(JSON.stringify(IMMEDIATE_TRANSITION_RULE));
    malformed.rule_schema_version = "2.0";
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [malformed] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.code).toBe("INVALID_TRANSITION_INPUT");
  });
});

describe("delayed scheduling and due-time processing", () => {
  it("creates a relative scheduled item without changing Patient State", () => {
    const result = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    expect(result.next_scheduler_state.pending_items[0]?.due_clinical_time).toBe(50);
    expect(result.state_version_after).toBe(4);
  });

  it("treats due before target and exactly at target as due, but after target as pending", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    })).next_scheduler_state;

    const before = requireSuccess(processDueScheduledItems(dueInput(scheduled, 49.999)));
    expect(before.next_scheduler_state.pending_items).toHaveLength(1);
    expect(before.next_state.respiratory_state).toBe("respiratory.synthetic-baseline");

    const exact = requireSuccess(processDueScheduledItems(dueInput(scheduled, 50)));
    expect(exact.next_scheduler_state.pending_items).toHaveLength(0);
    expect(exact.next_state.respiratory_state).toBe("respiratory.synthetic-altered");
    expect(exact.next_state.active_complications[0]?.activated_at_clinical_time).toBe(50);

    const after = requireSuccess(processDueScheduledItems(dueInput(scheduled, 50.001)));
    expect(after.next_scheduler_state.pending_items).toHaveLength(0);
    expect(after.next_state.oxygenation).toBe("oxygenation.synthetic-altered");
  });

  it("creates an absolute schedule and later emits a proposal without committed identity", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [ABSOLUTE_SCHEDULE_RULE],
      trigger: { trigger_type: "CLINICAL_TIME", target_clinical_time: 45 },
      current_clinical_time: 45
    }));
    expect(scheduled.next_scheduler_state.pending_items[0]?.due_clinical_time).toBe(55);

    const due = requireSuccess(processDueScheduledItems(
      dueInput(scheduled.next_scheduler_state, 55)
    ));
    expect(due.event_proposals[0]?.event_type).toBe("INVESTIGATION_RESULT_AVAILABLE");
    expect(due.event_proposals[0]).not.toHaveProperty("event_id");
    expect(due.state_version_after).toBe(5);
  });

  it("rejects an absolute schedule earlier than evaluation time", () => {
    const pastRule = createSyntheticRule({
      rule_id: "rule.synthetic.past-schedule",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "SCHEDULE_ABSOLUTE",
        effect_id: "effect.synthetic.past-schedule",
        scheduled_item_id: "scheduled-item.synthetic.past",
        category: "schedule.synthetic-past",
        due_clinical_time: 44,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [pastRule] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("SCHEDULER_NON_PROGRESS");
  });

  it("rejects nonfinite due-time overflow instead of clamping", () => {
    const overflowRule = createSyntheticRule({
      rule_id: "rule.synthetic.overflow-schedule",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.overflow-schedule",
        scheduled_item_id: "scheduled-item.synthetic.overflow",
        category: "schedule.synthetic-overflow",
        delay_clinical_seconds: Number.MAX_VALUE,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [overflowRule],
      current_clinical_time: Number.MAX_VALUE
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["SCHEDULED_TIME_NONFINITE"]);
  });

  it("orders simultaneous due work by time, priority, and stable identity", () => {
    const template = {
      scheduler_schema_version: "1.0",
      originating_rule_id: "rule.synthetic.delayed",
      category: "schedule.synthetic-order",
      due_clinical_time: 50,
      conflict_policy: "REPLACE",
      effects: [],
      emitted_events: []
    } as const;
    const initialized = initializeClinicalScheduler([
      { ...template, scheduled_item_id: "scheduled-item.synthetic.low", priority: 1 },
      { ...template, scheduled_item_id: "scheduled-item.synthetic.zeta", priority: 10 },
      { ...template, scheduled_item_id: "scheduled-item.synthetic.alpha", priority: 10 }
    ]);
    expect(initialized.success).toBe(true);
    if (!initialized.success) return;
    const result = requireSuccess(processDueScheduledItems(
      dueInput(initialized.schedulerState, 50)
    ));
    expect(result.trace.entries
      .filter((entry) => entry.kind === "DUE_ITEM_PROCESSED")
      .map((entry) => entry.scheduled_item_id)).toEqual([
        "scheduled-item.synthetic.alpha",
        "scheduled-item.synthetic.zeta",
        "scheduled-item.synthetic.low"
      ]);
  });

  it("applies staged target states as two explicit reviewed schedules", () => {
    const staged = createSyntheticRule({
      rule_id: "rule.synthetic.staged-targets",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "SCHEDULE_RELATIVE",
          effect_id: "effect.synthetic.stage-one-schedule",
          scheduled_item_id: "scheduled-item.synthetic.stage-one",
          category: "schedule.synthetic-staged",
          delay_clinical_seconds: 5,
          priority: 10,
          conflict_policy: "REPLACE",
          effects: [{
            effect_type: "SET_STATE",
            effect_id: "effect.synthetic.stage-one-state",
            target: "hemodynamic_state",
            value: "hemodynamics.synthetic-altered"
          }],
          emitted_events: []
        },
        {
          effect_type: "SCHEDULE_RELATIVE",
          effect_id: "effect.synthetic.stage-two-schedule",
          scheduled_item_id: "scheduled-item.synthetic.stage-two",
          category: "schedule.synthetic-staged",
          delay_clinical_seconds: 10,
          priority: 10,
          conflict_policy: "REPLACE",
          effects: [{
            effect_type: "SET_STATE",
            effect_id: "effect.synthetic.stage-two-state",
            target: "hemodynamic_state",
            value: "hemodynamics.synthetic-baseline"
          }],
          emitted_events: []
        }
      ]
    });
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [staged]
    }));
    const first = requireSuccess(processDueScheduledItems(
      dueInput(scheduled.next_scheduler_state, 50)
    ));
    expect(first.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
    expect(first.next_scheduler_state.pending_items).toHaveLength(1);

    const secondInput = dueInput(first.next_scheduler_state, 55);
    const second = requireSuccess(processDueScheduledItems({
      ...secondInput,
      state: first.next_state
    }));
    expect(second.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-baseline");
    expect(second.next_scheduler_state.pending_items).toHaveLength(0);
  });

  it("evaluates rules triggered by a due scheduled-item identity", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    const scheduledTrigger = createSyntheticRule({
      rule_id: "rule.synthetic.scheduled-trigger",
      trigger: {
        trigger_type: "SCHEDULED_ITEM",
        scheduled_item_id: "scheduled-item.synthetic.alteration"
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.scheduled-trigger",
        target: "consciousness",
        value: "consciousness.synthetic-changed"
      }]
    });
    const input = dueInput(scheduled.next_scheduler_state, 50);
    const result = requireSuccess(processDueScheduledItems({
      ...input,
      rules: [scheduledTrigger]
    }));
    expect(result.next_state.consciousness).toBe("consciousness.synthetic-changed");
  });

  it("evaluates the Clinical-Time threshold even when scheduled work is also due", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    const timeRule = createSyntheticRule({
      rule_id: "rule.synthetic.due-time-threshold",
      trigger: {
        trigger_type: "CLINICAL_TIME_THRESHOLD",
        threshold_clinical_time: 50
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.due-time-threshold",
        target: "consciousness",
        value: "consciousness.synthetic-changed"
      }]
    });
    const input = dueInput(scheduled.next_scheduler_state, 50);
    const result = requireSuccess(processDueScheduledItems({
      ...input,
      rules: [timeRule]
    }));
    expect(result.next_state.respiratory_state).toBe("respiratory.synthetic-altered");
    expect(result.next_state.consciousness).toBe("consciousness.synthetic-changed");
  });
});

describe("cancellation and derived-state evaluation", () => {
  it("cancels exact pending work and prevents its due effect", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    const cancelled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [CANCEL_TRANSITION_RULE],
      scheduler_state: scheduled.next_scheduler_state,
      trigger: {
        trigger_type: "COMMITTED_EVENT",
        event_type: "PROCEDURE_CANCELLED",
        action_id: "procedure.synthetic-step"
      }
    }));
    expect(cancelled.next_scheduler_state.pending_items).toHaveLength(0);
    expect(cancelled.trace.entries.some((entry) => entry.kind === "SCHEDULED_ITEM_CANCELLED")).toBe(true);

    const afterDue = requireSuccess(processDueScheduledItems(
      dueInput(cancelled.next_scheduler_state, 50)
    ));
    expect(afterDue.next_state.respiratory_state).toBe("respiratory.synthetic-baseline");
  });

  it("reports deterministic no-match cancellation and preserves unrelated work", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    const categoryCancel = createSyntheticRule({
      rule_id: "rule.synthetic.category-cancel",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "CANCEL_SCHEDULED",
        effect_id: "effect.synthetic.category-cancel",
        selector: { selector_type: "CATEGORY", category: "schedule.synthetic-other" }
      }]
    });
    const result = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [categoryCancel],
      scheduler_state: scheduled.next_scheduler_state
    }));
    expect(result.next_scheduler_state.pending_items).toHaveLength(1);
    expect(result.trace.entries.some(
      (entry) => entry.kind === "SCHEDULED_ITEM_CANCELLATION_NO_MATCH"
    )).toBe(true);
  });

  it("supports category cancellation and cannot retroactively cancel processed work", () => {
    const scheduled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [DELAYED_TRANSITION_RULE]
    }));
    const categoryCancel = createSyntheticRule({
      rule_id: "rule.synthetic.category-cancel-match",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "CANCEL_SCHEDULED",
        effect_id: "effect.synthetic.category-cancel-match",
        selector: {
          selector_type: "CATEGORY",
          category: "schedule.synthetic-progression"
        }
      }]
    });
    const cancelled = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [categoryCancel],
      scheduler_state: scheduled.next_scheduler_state
    }));
    expect(cancelled.next_scheduler_state.pending_items).toEqual([]);

    const processed = requireSuccess(processDueScheduledItems(
      dueInput(scheduled.next_scheduler_state, 50)
    ));
    const afterProcessing = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      state: processed.next_state,
      current_clinical_time: 50,
      rules: [categoryCancel],
      scheduler_state: processed.next_scheduler_state
    }));
    expect(afterProcessing.trace.entries.some(
      (entry) => entry.kind === "SCHEDULED_ITEM_CANCELLATION_NO_MATCH"
    )).toBe(true);
    expect(afterProcessing.next_state.active_complications).toHaveLength(1);
  });

  it("evaluates derived state-condition rules until stable", () => {
    const result = requireSuccess(evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [IMMEDIATE_TRANSITION_RULE, DERIVED_STATE_RULE]
    }));
    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
    expect(result.next_state.consciousness).toBe("consciousness.synthetic-changed");
    expect(result.trace.cycle_guard.status).toBe("STABLE");
  });

  it("detects an A-to-B-to-A cycle without hanging", () => {
    const toAltered = createSyntheticRule({
      rule_id: "rule.synthetic.cycle-a",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-baseline"
        }]
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.cycle-a",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-altered"
      }]
    });
    const toBaseline = createSyntheticRule({
      rule_id: "rule.synthetic.cycle-b",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        }]
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.cycle-b",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-baseline"
      }]
    });
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [toAltered, toBaseline]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("CYCLE_DETECTED");
    expect(result.trace?.cycle_guard.status).toBe("FAILED");
  });

  it("fails explicitly when a non-repeating derived chain exceeds its configured bound", () => {
    const first = createSyntheticRule({
      rule_id: "rule.synthetic.bound-first",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        }]
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.bound-first",
        target: "consciousness",
        value: "consciousness.synthetic-changed"
      }]
    });
    const second = createSyntheticRule({
      rule_id: "rule.synthetic.bound-second",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "consciousness",
          value: "consciousness.synthetic-changed"
        }]
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.bound-second",
        target: "clinical_phase",
        value: "phase.synthetic-changed"
      }]
    });
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [IMMEDIATE_TRANSITION_RULE, first, second],
      max_derived_evaluations: 1
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "CYCLE_GUARD_EXCEEDED"
    ]);
    expect(result.trace?.cycle_guard.status).toBe("FAILED");
  });
});
