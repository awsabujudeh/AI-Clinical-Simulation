import { describe, expect, it } from "vitest";

import {
  ClinicalEventProposalSchema,
  ClinicalTransitionSuccessSchema,
  PinnedClinicalPolicyEnvelopeSchema,
  RuleEffectSchema,
  SchedulerStateSchema,
  TransitionRuleSchema,
  TransitionTraceSchema
} from "../../packages/contracts/src/index.ts";
import {
  BASE_TRANSITION_INPUT,
  EMPTY_SCHEDULER_STATE,
  IMMEDIATE_TRANSITION_RULE,
  evaluateClinicalRules
} from "../fixtures/clinical-engine/synthetic-transitions.ts";

describe("shared declarative rule authority", () => {
  it("parses and JSON-serializes the supported 1.0 rule contract", () => {
    const parsed = TransitionRuleSchema.parse(IMMEDIATE_TRANSITION_RULE);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });

  it.each(["2.0", "999.0", "malformed"])(
    "rejects unsupported rule schema version %s",
    (version) => {
      expect(TransitionRuleSchema.safeParse({
        ...IMMEDIATE_TRANSITION_RULE,
        rule_schema_version: version
      }).success).toBe(false);
    }
  );

  it("rejects unknown fields, executable fields, unsupported targets, and direct vital writes", () => {
    expect(TransitionRuleSchema.safeParse({
      ...IMMEDIATE_TRANSITION_RULE,
      execute: "return true"
    }).success).toBe(false);
    expect(RuleEffectSchema.safeParse({
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.unsupported-target",
      target: "heart_rate_bpm",
      value: "synthetic.value"
    }).success).toBe(false);
    expect(RuleEffectSchema.safeParse({
      effect_type: "SET_VITAL",
      effect_id: "effect.synthetic.direct-vital",
      heart_rate_bpm: 90
    }).success).toBe(false);
    expect(RuleEffectSchema.safeParse({
      effect_type: "RUN_SCRIPT",
      effect_id: "effect.synthetic.script",
      source: "fixture"
    }).success).toBe(false);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid relative delay %s",
    (delay) => {
      expect(RuleEffectSchema.safeParse({
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: "effect.synthetic.bad-delay",
        scheduled_item_id: "scheduled-item.synthetic.bad-delay",
        category: "schedule.synthetic-bad-delay",
        delay_clinical_seconds: delay,
        priority: 1,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: []
      }).success).toBe(false);
    }
  );

  it("keeps one strict JSON-serializable pinned policy authority", () => {
    const parsed = PinnedClinicalPolicyEnvelopeSchema.parse(
      BASE_TRANSITION_INPUT.policy
    );
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
    expect(PinnedClinicalPolicyEnvelopeSchema.safeParse({
      ...parsed,
      rules_sidecar: []
    }).success).toBe(false);
    expect(PinnedClinicalPolicyEnvelopeSchema.safeParse({
      ...parsed,
      policy_schema_version: "2.0"
    }).success).toBe(false);
  });

  it("rejects malformed cancellation and unbounded priority", () => {
    expect(RuleEffectSchema.safeParse({
      effect_type: "CANCEL_SCHEDULED",
      effect_id: "effect.synthetic.bad-cancel",
      selector: { selector_type: "CATEGORY" }
    }).success).toBe(false);
    expect(TransitionRuleSchema.safeParse({
      ...IMMEDIATE_TRANSITION_RULE,
      priority: 1001
    }).success).toBe(false);
  });
});

describe("shared scheduler, proposal, and trace contracts", () => {
  it("supports only scheduler schema 1.0 and remains strict", () => {
    expect(SchedulerStateSchema.safeParse(EMPTY_SCHEDULER_STATE).success).toBe(true);
    expect(SchedulerStateSchema.safeParse({
      ...EMPTY_SCHEDULER_STATE,
      scheduler_schema_version: "2.0"
    }).success).toBe(false);
    expect(SchedulerStateSchema.safeParse({
      ...EMPTY_SCHEDULER_STATE,
      runtime_timer: true
    }).success).toBe(false);
  });

  it("keeps event output proposal-only", () => {
    const proposal = ClinicalEventProposalSchema.parse({
      proposal_schema_version: "1.0",
      event_type: "PATIENT_STATE_CHANGED",
      originating_rule_id: "rule.synthetic.proposal",
      clinical_effect_ids: [],
      parameters: {},
      payload: {},
      proposed_clinical_time: 10
    });
    expect(proposal).not.toHaveProperty("event_id");
    expect(proposal).not.toHaveProperty("sequence_no");
    expect(proposal).not.toHaveProperty("real_time_utc");
    expect(ClinicalEventProposalSchema.safeParse({
      ...proposal,
      event_id: "event.synthetic.forbidden"
    }).success).toBe(false);
  });

  it("runtime output round-trips through the strict shared success and trace schemas", () => {
    const result = evaluateClinicalRules(BASE_TRANSITION_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(ClinicalTransitionSuccessSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
    expect(TransitionTraceSchema.parse(JSON.parse(JSON.stringify(result.trace)))).toEqual(result.trace);
  });
});
