import { describe, expect, it } from "vitest";

import {
  advanceClinicalTime,
  drainDueWorkBeforeExternalCommand,
  pauseSessionClinicalClock,
  type ClinicalTimeAdvancementSuccess
} from "../../../packages/session-engine/src/index.ts";
import {
  BASELINE_PATIENT_STATE
} from "../../fixtures/clinical-engine/synthetic-state.ts";
import {
  createSyntheticRule
} from "../../fixtures/clinical-engine/synthetic-transitions.ts";
import {
  BASELINE_CLOCK,
  CREATE_NESTED_DUE_RULE,
  createAdvancementInput,
  createSyntheticScheduledItem,
  createSyntheticSessionPolicy
} from "../../fixtures/session-engine/synthetic-session.ts";

function requireSuccess(
  result: ReturnType<typeof advanceClinicalTime>
): ClinicalTimeAdvancementSuccess {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result;
}

describe("compressed and interruptible Clinical-Time advancement", () => {
  it("reaches target while processing interval work and retaining future work", () => {
    const result = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 60,
      schedulerItems: [
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.inside-first",
          due: 50,
          eventType: "PATIENT_STATE_CHANGED",
          effects: [{
            effect_type: "SET_STATE",
            effect_id: "effect.synthetic.inside-hemodynamics",
            target: "hemodynamic_state",
            value: "hemodynamics.synthetic-altered"
          }]
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.inside-second",
          due: 55,
          eventType: "INVESTIGATION_RESULT_AVAILABLE"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.after-target",
          due: 70,
          eventType: "OUTCOME_REACHED"
        })
      ]
    })));

    expect(result.status).toBe("REACHED_TARGET");
    expect(result.reached_clinical_time).toBe(60);
    expect(result.event_proposals.map((event) => event.proposed_clinical_time)).toEqual([50, 55]);
    expect(result.next_scheduler_state.pending_items.map((item) => item.scheduled_item_id)).toEqual([
      "scheduled-item.synthetic.after-target"
    ]);
  });

  it("processes newly-created due work inside the requested interval", () => {
    const result = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 55,
      policy: createSyntheticSessionPolicy({ rules: [CREATE_NESTED_DUE_RULE] }),
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.seed",
        due: 50,
        category: "schedule.synthetic-seed"
      })]
    })));

    expect(result.next_state.consciousness).toBe("consciousness.synthetic-changed");
    expect(result.event_proposals.map((event) => event.proposed_clinical_time)).toEqual([53]);
    expect(result.next_scheduler_state.pending_items).toEqual([]);
  });

  it("processes Clinical-Time threshold rules at their exact boundary only once", () => {
    const thresholdRule = createSyntheticRule({
      rule_id: "rule.synthetic.time-boundary",
      trigger: {
        trigger_type: "CLINICAL_TIME_THRESHOLD",
        threshold_clinical_time: 52
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.time-boundary-hemodynamics",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-altered"
      }],
      emitted_events: [{
        event_type: "PATIENT_STATE_CHANGED",
        parameters: { fixture_only: true },
        payload: { source: "synthetic-time-boundary" },
        clinical_effect_ids: []
      }]
    });
    const result = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 60,
      policy: createSyntheticSessionPolicy({ rules: [thresholdRule] }),
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.after-time-boundary",
        due: 55,
        eventType: "INVESTIGATION_RESULT_AVAILABLE"
      })]
    })));

    expect(result.event_proposals.map((event) => [
      event.event_type,
      event.proposed_clinical_time
    ])).toEqual([
      ["PATIENT_STATE_CHANGED", 52],
      ["INVESTIGATION_RESULT_AVAILABLE", 55]
    ]);
    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
  });

  it("interrupts exactly at a Case-owned event and leaves later work pending", () => {
    const policy = createSyntheticSessionPolicy({
      interruptingEventTypes: ["CRITICAL_EVENT_OCCURRED"]
    });
    const items = [
      createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.before-interrupt",
        due: 50,
        eventType: "PATIENT_STATE_CHANGED"
      }),
      createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.at-interrupt",
        due: 52,
        eventType: "CRITICAL_EVENT_OCCURRED"
      }),
      createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.after-interrupt",
        due: 55,
        eventType: "OUTCOME_REACHED"
      })
    ];
    const interrupted = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 60,
      policy,
      schedulerItems: items
    })));

    expect(interrupted.status).toBe("INTERRUPTED");
    expect(interrupted.requested_target_clinical_time).toBe(60);
    expect(interrupted.reached_clinical_time).toBe(52);
    expect(interrupted.next_scheduler_state.pending_items.map((item) => item.scheduled_item_id)).toEqual([
      "scheduled-item.synthetic.after-interrupt"
    ]);

    const resumed = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 60,
      policy,
      state: interrupted.next_state,
      clock: interrupted.next_clock,
      schedulerItems: interrupted.next_scheduler_state.pending_items
    })));
    expect(resumed.status).toBe("REACHED_TARGET");
    expect(resumed.event_proposals.map((event) => event.event_type)).toEqual(["OUTCOME_REACHED"]);
    expect(resumed.event_proposals).not.toContainEqual(
      expect.objectContaining({ event_type: "CRITICAL_EVENT_OCCURRED" })
    );
  });

  it("is deterministic and keeps independent parallel completion times independent", () => {
    const input = createAdvancementInput({
      target: 65,
      schedulerItems: [
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.parallel-c",
          due: 60,
          eventType: "OUTCOME_REACHED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.parallel-a",
          due: 50,
          eventType: "EXAM_FINDING_REVEALED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.parallel-b",
          due: 55,
          eventType: "INVESTIGATION_RESULT_AVAILABLE"
        })
      ]
    });
    const first = requireSuccess(advanceClinicalTime(input));
    const second = requireSuccess(advanceClinicalTime(input));

    expect(second).toEqual(first);
    expect(first.event_proposals.map((event) => event.proposed_clinical_time)).toEqual([50, 55, 60]);
    expect(first.reached_clinical_time).toBe(65);
  });

  it("propagates a V2-005 budget failure without exposing partial authoritative state", () => {
    const items = Array.from({ length: 257 }, (_, index) => createSyntheticScheduledItem({
      id: `scheduled-item.synthetic.budget-${String(index).padStart(3, "0")}`,
      due: 50
    }));
    const result = advanceClinicalTime(createAdvancementInput({ target: 50, schedulerItems: items }));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["CLINICAL_ENGINE_FAILURE"]);
    expect(result.clinical_engine_failure?.issues.map((issue) => issue.code)).toContain(
      "EVALUATION_BUDGET_EXCEEDED"
    );
    expect(result).not.toHaveProperty("next_state");
    expect(result).not.toHaveProperty("next_scheduler_state");
  });

  it("contains pause, regression, alignment, and runtime-sidecar failures", () => {
    const pausedClock = pauseSessionClinicalClock(BASELINE_CLOCK);
    expect(pausedClock.success).toBe(true);
    if (!pausedClock.success) return;
    const paused = advanceClinicalTime(createAdvancementInput({ clock: pausedClock.clock }));
    const regressed = advanceClinicalTime(createAdvancementInput({ target: 44 }));
    const mismatched = advanceClinicalTime(createAdvancementInput({
      clock: { ...BASELINE_CLOCK, clinical_time: 46 } as typeof BASELINE_CLOCK
    }));
    const sidecar = advanceClinicalTime({
      ...createAdvancementInput(),
      interrupting_event_types: ["CRITICAL_EVENT_OCCURRED"]
    });

    expect(paused.success && paused.status).toBe(false);
    expect(!paused.success && paused.issues.map((issue) => issue.code)).toContain("CLOCK_PAUSED");
    expect(!regressed.success && regressed.issues.map((issue) => issue.code)).toContain("CLINICAL_TIME_REGRESSION");
    expect(!mismatched.success && mismatched.issues.map((issue) => issue.code)).toContain("CLOCK_STATE_MISMATCH");
    expect(sidecar.success).toBe(false);
  });

  it("drains same-time due work before exposing context for a future command", () => {
    const result = drainDueWorkBeforeExternalCommand({
      clock: BASELINE_CLOCK,
      policy: createSyntheticSessionPolicy(),
      state: BASELINE_PATIENT_STATE,
      scheduler_state: {
        scheduler_schema_version: "1.0",
        pending_items: [createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.same-time",
          due: 45,
          effects: [{
            effect_type: "SET_STATE",
            effect_id: "effect.synthetic.same-time-state",
            target: "hemodynamic_state",
            value: "hemodynamics.synthetic-altered"
          }]
        })]
      },
      prior_event_facts: []
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.source).toBe("SAME_TIME_COMMAND_GATE");
    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
    expect(result.next_scheduler_state.pending_items).toEqual([]);
    expect(result.reached_clinical_time).toBe(45);
  });
});
