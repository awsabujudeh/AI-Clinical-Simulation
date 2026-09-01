import { describe, expect, it } from "vitest";

import {
  BASE_TRANSITION_INPUT,
  SYNTHETIC_COMMITTED_TRIGGER,
  createSyntheticRule,
  evaluateClinicalRules
} from "../fixtures/clinical-engine/synthetic-transitions.ts";

function stateRule(
  id: string,
  effectId: string,
  target: "hemodynamic_state" | "consciousness",
  value: string,
  priority: number,
  policy: "REPLACE" | "BLOCK" | "HIGHEST_PRIORITY"
) {
  return createSyntheticRule({
    rule_id: id,
    trigger: SYNTHETIC_COMMITTED_TRIGGER,
    priority,
    conflict_policy: policy,
    effects: [{
      effect_type: "SET_STATE",
      effect_id: effectId,
      target,
      value
    }]
  });
}

describe("explicit state-channel conflict policies", () => {
  it("applies two independent channels", () => {
    const result = evaluateClinicalRules({
      ...BASE_TRANSITION_INPUT,
      rules: [
        stateRule(
          "rule.synthetic.independent-a",
          "effect.synthetic.independent-a",
          "hemodynamic_state",
          "hemodynamics.synthetic-altered",
          10,
          "REPLACE"
        ),
        stateRule(
          "rule.synthetic.independent-b",
          "effect.synthetic.independent-b",
          "consciousness",
          "consciousness.synthetic-changed",
          10,
          "REPLACE"
        )
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
    expect(result.next_state.consciousness).toBe("consciousness.synthetic-changed");
  });

  it.each(["REPLACE", "HIGHEST_PRIORITY"] as const)(
    "%s selects the unique higher-priority write",
    (policy) => {
      const policyId = policy.toLowerCase().replaceAll("_", "-");
      const higher = stateRule(
        `rule.synthetic.${policyId}-higher`,
        `effect.synthetic.${policyId}-higher`,
        "hemodynamic_state",
        "hemodynamics.synthetic-altered",
        20,
        policy
      );
      const lower = stateRule(
        `rule.synthetic.${policyId}-lower`,
        `effect.synthetic.${policyId}-lower`,
        "hemodynamic_state",
        "hemodynamics.synthetic-baseline",
        10,
        policy
      );
      const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [lower, higher] });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-altered");
      expect(result.trace.entries.some((entry) => entry.kind === "CONFLICT_RESOLVED")).toBe(true);
    }
  );

  it("BLOCK retains the current channel value", () => {
    const blocker = stateRule(
      "rule.synthetic.block-higher",
      "effect.synthetic.block-higher",
      "hemodynamic_state",
      "hemodynamics.synthetic-altered",
      20,
      "BLOCK"
    );
    const lower = stateRule(
      "rule.synthetic.block-lower",
      "effect.synthetic.block-lower",
      "hemodynamic_state",
      "hemodynamics.synthetic-baseline",
      10,
      "BLOCK"
    );
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [lower, blocker] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.next_state.hemodynamic_state).toBe("hemodynamics.synthetic-baseline");
  });

  it("fails closed when contradictory writes mix conflict policies", () => {
    const replace = stateRule(
      "rule.synthetic.mixed-replace",
      "effect.synthetic.mixed-replace",
      "hemodynamic_state",
      "hemodynamics.synthetic-altered",
      20,
      "REPLACE"
    );
    const block = stateRule(
      "rule.synthetic.mixed-block",
      "effect.synthetic.mixed-block",
      "hemodynamic_state",
      "hemodynamics.synthetic-baseline",
      10,
      "BLOCK"
    );
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [block, replace] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("MIXED_CONFLICT_POLICIES");
    expect(result.trace?.entries.some((entry) => entry.kind === "EFFECT_REJECTED")).toBe(true);
  });

  it("fails closed on equal-priority contradictory writes", () => {
    const left = stateRule(
      "rule.synthetic.equal-a",
      "effect.synthetic.equal-a",
      "hemodynamic_state",
      "hemodynamics.synthetic-altered",
      10,
      "REPLACE"
    );
    const right = stateRule(
      "rule.synthetic.equal-b",
      "effect.synthetic.equal-b",
      "hemodynamic_state",
      "hemodynamics.synthetic-baseline",
      10,
      "REPLACE"
    );
    const result = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [left, right] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["UNRESOLVED_EFFECT_CONFLICT"]);
    expect(result.trace?.entries.some(
      (entry) => entry.kind === "CONFLICT_DETECTED"
        && entry.detail_code === "conflict.equal-priority"
    )).toBe(true);
  });

  it("is stable when authored rule array insertion order is reversed", () => {
    const higher = stateRule(
      "rule.synthetic.order-higher",
      "effect.synthetic.order-higher",
      "hemodynamic_state",
      "hemodynamics.synthetic-altered",
      20,
      "HIGHEST_PRIORITY"
    );
    const lower = stateRule(
      "rule.synthetic.order-lower",
      "effect.synthetic.order-lower",
      "hemodynamic_state",
      "hemodynamics.synthetic-baseline",
      10,
      "HIGHEST_PRIORITY"
    );
    const first = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [higher, lower] });
    const second = evaluateClinicalRules({ ...BASE_TRANSITION_INPUT, rules: [lower, higher] });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
