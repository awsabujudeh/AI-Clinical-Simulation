import { describe, expect, it } from "vitest";

import * as ClinicalEnginePublic from "../../packages/clinical-engine/src/index.ts";
import {
  ENGINE_WORK_LIMITS,
  evaluatePinnedClinicalPolicy,
  initializeClinicalScheduler
} from "../../packages/clinical-engine/src/index.ts";
import { SchedulerStateSchema } from "../../packages/contracts/src/index.ts";
import { BASELINE_PATIENT_STATE } from "../fixtures/clinical-engine/synthetic-state.ts";
import {
  BASE_TRANSITION_INPUT,
  EMPTY_SCHEDULER_STATE,
  SYNTHETIC_COMMITTED_TRIGGER,
  createSyntheticPinnedPolicy,
  createSyntheticRule
} from "../fixtures/clinical-engine/synthetic-transitions.ts";

function runRules(rules: ReturnType<typeof createSyntheticRule>[], overrides = {}) {
  return evaluatePinnedClinicalPolicy({
    ...BASE_TRANSITION_INPUT,
    ...overrides,
    policy: createSyntheticPinnedPolicy(rules)
  });
}

function runDue(
  rules: ReturnType<typeof createSyntheticRule>[],
  schedulerState: typeof EMPTY_SCHEDULER_STATE,
  targetClinicalTime: number,
  state = BASELINE_PATIENT_STATE
) {
  return evaluatePinnedClinicalPolicy({
    operation: "PROCESS_DUE",
    policy: createSyntheticPinnedPolicy(rules),
    state,
    scheduler_state: schedulerState,
    prior_event_facts: [],
    target_clinical_time: targetClinicalTime
  });
}

function requireSuccess(result: ReturnType<typeof evaluatePinnedClinicalPolicy>) {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result.issues));
  return result;
}

function scheduledItem(
  id: string,
  priority: number,
  due = 50,
  category = "schedule.synthetic-adversarial"
) {
  return {
    scheduler_schema_version: "1.0" as const,
    scheduled_item_id: id,
    originating_rule_id: "rule.synthetic.scheduler-source",
    category,
    due_clinical_time: due,
    priority,
    conflict_policy: "REPLACE" as const,
    effects: [],
    emitted_events: []
  };
}

describe("pinned clinical policy public boundary", () => {
  it("exports one pinned execution entry and rejects raw sidecars", () => {
    expect("evaluateClinicalRules" in ClinicalEnginePublic).toBe(false);
    expect("processDueScheduledItems" in ClinicalEnginePublic).toBe(false);
    const result = evaluatePinnedClinicalPolicy({
      ...BASE_TRANSITION_INPUT,
      rules: BASE_TRANSITION_INPUT.policy.rules,
      observation_projection: BASE_TRANSITION_INPUT.policy.observation_projection
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.code).toBe("INVALID_TRANSITION_INPUT");
  });

  it("rejects a Patient State whose semantic version differs from pinned policy", () => {
    const result = evaluatePinnedClinicalPolicy({
      ...BASE_TRANSITION_INPUT,
      state: { ...BASELINE_PATIENT_STATE, case_version: "2.0.1" }
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["PINNED_POLICY_MISMATCH"]);
  });

  it("treats prototype-style controlled values as ordinary own data", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.prototype-safe",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      preconditions: [{ condition_type: "CASE_FACT_PRESENT", fact_id: "fact.constructor" }],
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.prototype-safe",
        target: "clinical_phase",
        value: "constructor"
      }]
    });
    const policy = createSyntheticPinnedPolicy([rule]);
    const result = requireSuccess(evaluatePinnedClinicalPolicy({
      ...BASE_TRANSITION_INPUT,
      policy: { ...policy, approved_case_fact_ids: ["fact.constructor"] }
    }));
    expect(result.next_state.clinical_phase).toBe("constructor");
  });
});

describe("scheduler progress and bounded due-chain processing", () => {
  it("rejects zero-delay runtime scheduling at the contract boundary", () => {
    const policy = JSON.parse(JSON.stringify(createSyntheticPinnedPolicy([])));
    policy.rules = [{
      ...createSyntheticRule({
        rule_id: "rule.synthetic.zero-delay",
        trigger: SYNTHETIC_COMMITTED_TRIGGER,
        effects: []
      }),
      effects: [{
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.zero-delay",
        scheduled_item_id: "scheduled-item.synthetic.zero-delay",
        category: "schedule.synthetic-zero-delay",
        delay_clinical_seconds: 0,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    }];
    const result = evaluatePinnedClinicalPolicy({ ...BASE_TRANSITION_INPUT, policy });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.code).toBe("INVALID_TRANSITION_INPUT");
  });

  it.each([45, 44])("rejects absolute runtime scheduling at/before current time %s", (due) => {
    const rule = createSyntheticRule({
      rule_id: `rule.synthetic.absolute-nonprogress-${String(due)}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{
        effect_type: "SCHEDULE_ABSOLUTE",
        effect_id: `effect.synthetic.absolute-nonprogress-${String(due)}`,
        scheduled_item_id: `scheduled-item.synthetic.absolute-nonprogress-${String(due)}`,
        category: "schedule.synthetic-nonprogress",
        due_clinical_time: due,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const result = runRules([rule]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("SCHEDULER_NON_PROGRESS");
    expect(result.trace?.entries.some(
      (entry) => entry.kind === "SCHEDULER_LIVENESS_FAILURE"
    )).toBe(true);
  });

  it("processes newly-created due work through the same requested target", () => {
    const firstRule = createSyntheticRule({
      rule_id: "rule.synthetic.chain-first",
      trigger: { trigger_type: "SCHEDULED_ITEM", scheduled_item_id: "scheduled-item.synthetic.chain-a" },
      effects: [{
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.chain-b",
        scheduled_item_id: "scheduled-item.synthetic.chain-b",
        category: "schedule.synthetic-chain",
        delay_clinical_seconds: 1,
        priority: 10,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const secondRule = createSyntheticRule({
      rule_id: "rule.synthetic.chain-second",
      trigger: { trigger_type: "SCHEDULED_ITEM", scheduled_item_id: "scheduled-item.synthetic.chain-b" },
      effects: [{
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.chain-c",
        scheduled_item_id: "scheduled-item.synthetic.chain-c",
        category: "schedule.synthetic-chain",
        delay_clinical_seconds: 1,
        priority: 10,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const scheduler = initializeClinicalScheduler([
      scheduledItem("scheduled-item.synthetic.chain-a", 10, 46, "schedule.synthetic-chain")
    ]);
    expect(scheduler.success).toBe(true);
    if (!scheduler.success) return;
    const result = requireSuccess(runDue(
      [firstRule, secondRule],
      scheduler.schedulerState,
      50
    ));
    expect(result.next_scheduler_state.pending_items).toEqual([]);
    expect(result.trace.entries
      .filter((entry) => entry.kind === "DUE_ITEM_PROCESSED")
      .map((entry) => entry.scheduled_item_id)).toEqual([
        "scheduled-item.synthetic.chain-a",
        "scheduled-item.synthetic.chain-b",
        "scheduled-item.synthetic.chain-c"
      ]);
    expect(result.state_version_after).toBe(5);
  });

  it("returns a typed causal-depth failure instead of expanding without bound", () => {
    const items = Array.from(
      { length: ENGINE_WORK_LIMITS.scheduler_causal_depth + 1 },
      (_, index) => scheduledItem(
        `scheduled-item.synthetic.depth-${String(index).padStart(3, "0")}`,
        1,
        46 + index / 1000
      )
    );
    const scheduler = SchedulerStateSchema.parse({
      scheduler_schema_version: "1.0",
      pending_items: items
    });
    const result = runDue([], scheduler, 50);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toMatchObject([{
      code: "EVALUATION_BUDGET_EXCEEDED",
      detail_code: "budget.scheduler-causal-depth"
    }]);
    expect(result.trace?.entries.at(-1)?.kind).toBe("BUDGET_EXCEEDED");
  });
});

describe("one-at-a-time same-time scheduler cancellation", () => {
  const cancelLaterRule = createSyntheticRule({
    rule_id: "rule.synthetic.cancel-later-due",
    trigger: { trigger_type: "SCHEDULED_ITEM", scheduled_item_id: "scheduled-item.synthetic.cancel-a" },
    effects: [{
      effect_type: "CANCEL_SCHEDULED",
      effect_id: "effect.synthetic.cancel-later-due",
      selector: {
        selector_type: "SCHEDULED_ITEM_ID",
        scheduled_item_id: "scheduled-item.synthetic.cancel-b"
      }
    }]
  });

  it("lets the earlier high-priority item cancel later same-time work", () => {
    const scheduler = initializeClinicalScheduler([
      scheduledItem("scheduled-item.synthetic.cancel-b", 1),
      scheduledItem("scheduled-item.synthetic.cancel-a", 20),
      scheduledItem("scheduled-item.synthetic.cancel-unrelated", 5)
    ]);
    expect(scheduler.success).toBe(true);
    if (!scheduler.success) return;
    const result = requireSuccess(runDue([cancelLaterRule], scheduler.schedulerState, 50));
    expect(result.trace.entries
      .filter((entry) => entry.kind === "DUE_ITEM_PROCESSED")
      .map((entry) => entry.scheduled_item_id)).toEqual([
        "scheduled-item.synthetic.cancel-a",
        "scheduled-item.synthetic.cancel-unrelated"
      ]);
  });

  it("cannot retroactively cancel an item that already executed", () => {
    const scheduler = initializeClinicalScheduler([
      scheduledItem("scheduled-item.synthetic.cancel-b", 20),
      scheduledItem("scheduled-item.synthetic.cancel-a", 1)
    ]);
    expect(scheduler.success).toBe(true);
    if (!scheduler.success) return;
    const result = requireSuccess(runDue([cancelLaterRule], scheduler.schedulerState, 50));
    expect(result.trace.entries
      .filter((entry) => entry.kind === "DUE_ITEM_PROCESSED")
      .map((entry) => entry.scheduled_item_id)).toEqual([
        "scheduled-item.synthetic.cancel-b",
        "scheduled-item.synthetic.cancel-a"
      ]);
    expect(result.trace.entries.some(
      (entry) => entry.kind === "SCHEDULED_ITEM_CANCELLATION_NO_MATCH"
    )).toBe(true);
  });
});

describe("holistic work and output budgets", () => {
  it("contains 33×16 event-proposal overflow inside typed failure", () => {
    const definitions = Array.from({ length: 16 }, () => ({
      event_type: "PATIENT_STATE_CHANGED" as const,
      parameters: {},
      payload: null,
      clinical_effect_ids: []
    }));
    const rules = Array.from({ length: 33 }, (_, index) => createSyntheticRule({
      rule_id: `rule.synthetic.proposal-budget-${String(index).padStart(2, "0")}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      emitted_events: definitions
    }));
    const result = runRules(rules);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.code).toBe("EVALUATION_BUDGET_EXCEEDED");
    expect(result.issues[0]?.detail_code).toBe("budget.event-proposals-created");
    expect(result.trace?.entries.at(-1)?.kind).toBe("BUDGET_EXCEEDED");
  });

  it("contains 33×32 scheduler growth inside typed failure", () => {
    const rules = Array.from({ length: 33 }, (_, ruleIndex) => createSyntheticRule({
      rule_id: `rule.synthetic.schedule-budget-${String(ruleIndex).padStart(2, "0")}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: Array.from({ length: 32 }, (_, effectIndex) => ({
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: `effect.synthetic.schedule-budget-${String(ruleIndex).padStart(2, "0")}-${String(effectIndex).padStart(2, "0")}`,
        scheduled_item_id: `scheduled-item.synthetic.budget-${String(ruleIndex).padStart(2, "0")}-${String(effectIndex).padStart(2, "0")}`,
        category: "schedule.synthetic-budget",
        delay_clinical_seconds: 5,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }))
    }));
    const result = runRules(rules);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.code).toBe("EVALUATION_BUDGET_EXCEEDED");
    expect(result.issues[0]?.detail_code).toBe("budget.scheduled-items-created");
  });

  it("reserves auditable terminal capacity when trace work is exhausted", () => {
    const rules = Array.from({ length: 512 }, (_, ruleIndex) => createSyntheticRule({
      rule_id: `rule.synthetic.trace-budget-${String(ruleIndex).padStart(3, "0")}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: Array.from({ length: 8 }, (_, effectIndex) => ({
        effect_type: "ADD_OUTCOME_FLAG",
        effect_id: `effect.synthetic.trace-budget-${String(ruleIndex).padStart(3, "0")}-${String(effectIndex)}`,
        outcome_flag: `outcome.trace-budget-${String(ruleIndex).padStart(3, "0")}-${String(effectIndex)}`
      }))
    }));
    const result = runRules(rules);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0]?.detail_code).toBe("budget.trace-entries");
    expect(result.trace?.entries.length).toBeLessThanOrEqual(ENGINE_WORK_LIMITS.trace_entries);
    expect(result.trace?.entries.at(-1)?.kind).toBe("BUDGET_EXCEEDED");
  });
});

describe("derived activation and collection identity safety", () => {
  it("emits a persistent proposal-only activation once", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.persistent-proposal",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "clinical_phase",
          value: "phase.synthetic-baseline"
        }]
      },
      emitted_events: [{
        event_type: "PATIENT_STATE_CHANGED",
        parameters: {},
        payload: null,
        clinical_effect_ids: []
      }]
    });
    const result = requireSuccess(runRules([rule]));
    expect(result.event_proposals).toHaveLength(1);
    expect(result.trace.entries.filter((entry) => entry.kind === "RULE_FIRED")).toHaveLength(1);
  });

  it("schedules once for a persistent schedule-only activation", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.persistent-schedule",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "clinical_phase",
          value: "phase.synthetic-baseline"
        }]
      },
      effects: [{
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.persistent-schedule",
        scheduled_item_id: "scheduled-item.synthetic.persistent-schedule",
        category: "schedule.synthetic-persistent",
        delay_clinical_seconds: 5,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }]
    });
    const result = requireSuccess(runRules([rule]));
    expect(result.next_scheduler_state.pending_items).toHaveLength(1);
    expect(result.trace.entries.filter(
      (entry) => entry.kind === "SCHEDULED_ITEM_CREATED"
    )).toHaveLength(1);
  });

  it("emits one proposal for a persistent no-op write activation", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.persistent-noop",
      trigger: {
        trigger_type: "STATE_CONDITION",
        conditions: [{
          condition_type: "STATE_EQUALS",
          target: "clinical_phase",
          value: "phase.synthetic-baseline"
        }]
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.persistent-noop",
        target: "clinical_phase",
        value: "phase.synthetic-baseline"
      }],
      emitted_events: [{
        event_type: "PATIENT_STATE_CHANGED",
        parameters: {},
        payload: null,
        clinical_effect_ids: []
      }]
    });
    const result = requireSuccess(runRules([rule]));
    expect(result.event_proposals).toHaveLength(1);
  });

  it.each([
    ["intervention", "ADD_INTERVENTION"],
    ["complication", "ADD_COMPLICATION"]
  ] as const)("makes identical %s add idempotent and differing content fail", (_label, kind) => {
    const state = kind === "ADD_INTERVENTION"
      ? {
          ...BASELINE_PATIENT_STATE,
          active_interventions: [{
            intervention_id: "intervention.synthetic.existing",
            intervention_type: "intervention-type.synthetic",
            started_at_clinical_time: 45,
            parameters: { value: 1 }
          }]
        }
      : {
          ...BASELINE_PATIENT_STATE,
          active_complications: [{
            complication_id: "complication.synthetic.existing",
            complication_type: "complication-type.synthetic",
            activated_at_clinical_time: 45,
            attributes: { value: 1 }
          }]
        };
    const identicalEffect = kind === "ADD_INTERVENTION"
      ? {
          effect_type: kind,
          effect_id: "effect.synthetic.identical-intervention",
          intervention_id: "intervention.synthetic.existing",
          intervention_type: "intervention-type.synthetic",
          parameters: { value: 1 }
        }
      : {
          effect_type: kind,
          effect_id: "effect.synthetic.identical-complication",
          complication_id: "complication.synthetic.existing",
          complication_type: "complication-type.synthetic",
          attributes: { value: 1 }
        };
    const identicalRule = createSyntheticRule({
      rule_id: `rule.synthetic.identical-${_label}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [identicalEffect]
    });
    const identical = requireSuccess(runRules([identicalRule], { state }));
    expect(identical.state_changed).toBe(false);

    const changedEffect = JSON.parse(JSON.stringify(identicalEffect));
    if (kind === "ADD_INTERVENTION") changedEffect.parameters = { value: 2 };
    else changedEffect.attributes = { value: 2 };
    const changedRule = createSyntheticRule({
      rule_id: `rule.synthetic.changed-${_label}`,
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [{ ...changedEffect, effect_id: `effect.synthetic.changed-${_label}` }]
    });
    const changed = runRules([changedRule], { state });
    expect(changed.success).toBe(false);
    if (changed.success) return;
    expect(changed.issues.map((issue) => issue.code)).toContain("IDENTITY_CONFLICT");
    expect(changed.trace?.entries.some((entry) => entry.kind === "EFFECT_REJECTED")).toBe(true);
  });

  it("keeps missing removals and repeated outcome operations idempotent with canonical order", () => {
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.idempotent-collections",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "REMOVE_INTERVENTION",
          effect_id: "effect.synthetic.remove-missing-intervention",
          intervention_id: "intervention.synthetic.missing"
        },
        {
          effect_type: "REMOVE_COMPLICATION",
          effect_id: "effect.synthetic.remove-missing-complication",
          complication_id: "complication.synthetic.missing"
        },
        {
          effect_type: "ADD_OUTCOME_FLAG",
          effect_id: "effect.synthetic.add-existing-outcome",
          outcome_flag: "outcome.synthetic-existing"
        },
        {
          effect_type: "REMOVE_OUTCOME_FLAG",
          effect_id: "effect.synthetic.remove-missing-outcome",
          outcome_flag: "outcome.synthetic-missing"
        },
        {
          effect_type: "ADD_OUTCOME_FLAG",
          effect_id: "effect.synthetic.add-earlier-outcome",
          outcome_flag: "outcome.synthetic-a"
        }
      ]
    });
    const state = {
      ...BASELINE_PATIENT_STATE,
      outcome_flags: ["outcome.synthetic-existing", "outcome.synthetic-z"]
    };
    const result = requireSuccess(runRules([rule], { state }));
    expect(result.next_state.active_interventions).toEqual([]);
    expect(result.next_state.active_complications).toEqual([]);
    expect(result.next_state.outcome_flags).toEqual([
      "outcome.synthetic-a",
      "outcome.synthetic-existing",
      "outcome.synthetic-z"
    ]);
    expect(result.trace.entries.filter(
      (entry) => entry.kind === "EFFECT_APPLIED" && entry.detail_code === "effect.no-op"
    )).toHaveLength(4);
  });

  it("keeps an earlier valid state effect non-committable after a later identity conflict", () => {
    const state = {
      ...BASELINE_PATIENT_STATE,
      active_interventions: [{
        intervention_id: "intervention.synthetic.existing",
        intervention_type: "intervention-type.synthetic-original",
        started_at_clinical_time: 45,
        parameters: { value: 1 }
      }]
    };
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.atomic-identity-conflict",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.atomic-valid-state",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        },
        {
          effect_type: "ADD_INTERVENTION",
          effect_id: "effect.synthetic.atomic-invalid-intervention",
          intervention_id: "intervention.synthetic.existing",
          intervention_type: "intervention-type.synthetic-replacement",
          parameters: { value: 2 }
        }
      ]
    });
    const result = runRules([rule], { state });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("IDENTITY_CONFLICT");
    expect(result).not.toHaveProperty("next_state");
    expect(result).not.toHaveProperty("next_scheduler_state");
    expect(result).not.toHaveProperty("event_proposals");
  });

  it("keeps a valid earlier state effect non-committable when later scheduling exceeds capacity", () => {
    const scheduler = SchedulerStateSchema.parse({
      scheduler_schema_version: "1.0",
      pending_items: Array.from({ length: 1024 }, (_, index) => scheduledItem(
        `scheduled-item.synthetic.full-${String(index).padStart(4, "0")}`,
        1,
        100
      ))
    });
    const rule = createSyntheticRule({
      rule_id: "rule.synthetic.atomic-budget",
      trigger: SYNTHETIC_COMMITTED_TRIGGER,
      effects: [
        {
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.atomic-state",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        },
        {
          effect_type: "SCHEDULE_RELATIVE",
          effect_id: "effect.synthetic.atomic-schedule",
          scheduled_item_id: "scheduled-item.synthetic.full-extra",
          category: "schedule.synthetic-full",
          delay_clinical_seconds: 5,
          priority: 1,
          conflict_policy: "REPLACE",
          effects: [],
          emitted_events: []
        }
      ]
    });
    const result = runRules([rule], { scheduler_state: scheduler });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result).not.toHaveProperty("next_state");
    expect(result).not.toHaveProperty("next_scheduler_state");
    expect(result).not.toHaveProperty("event_proposals");
  });
});
