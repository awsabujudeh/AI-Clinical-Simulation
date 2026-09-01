import {
  ClinicalTimeSchema,
  PatientStateSchema,
  type ConflictPolicy,
  type ImmediateStateEffect,
  type PatientState,
  type RuleId
} from "../../../contracts/src/index.ts";

import {
  createTransitionIssue,
  type ClinicalTransitionIssue
} from "../validation/transition-issues.ts";
import { stableJsonKey } from "../validation/stable-key.ts";

export type ImmediateEffectIntent = {
  effect: ImmediateStateEffect;
  originatingRuleId: RuleId;
  priority: number;
  conflictPolicy: ConflictPolicy;
  effectOrder: number;
  clinicalTime: number;
};

export type EffectApplicationFact = {
  kind:
    | "EFFECT_APPLIED"
    | "EFFECT_REJECTED"
    | "STATE_CHANNEL_CHANGED"
    | "CONFLICT_RESOLVED"
    | "CONFLICT_DETECTED";
  ruleId: RuleId;
  effectId: ImmediateStateEffect["effect_id"];
  channel: string;
  detailCode: string;
  data: Record<string, boolean | number | string | null>;
  clinicalTime: number;
};

export type ImmediateEffectApplicationResult =
  | { success: false; issues: ClinicalTransitionIssue[]; facts: EffectApplicationFact[] }
  | { success: true; issues: []; state: PatientState; facts: EffectApplicationFact[] };

function effectChannel(effect: ImmediateStateEffect): string {
  switch (effect.effect_type) {
    case "SET_STATE":
      return effect.target;
    case "SET_PAIN_STATE":
      return "pain_state";
    case "ADD_INTERVENTION":
    case "REMOVE_INTERVENTION":
      return `active_interventions.${effect.intervention_id}`;
    case "ADD_COMPLICATION":
    case "REMOVE_COMPLICATION":
      return `active_complications.${effect.complication_id}`;
    case "ADD_OUTCOME_FLAG":
    case "REMOVE_OUTCOME_FLAG":
      return `outcome_flags.${effect.outcome_flag}`;
  }
}

function effectValueKey(effect: ImmediateStateEffect): string {
  const { effect_id: _effectId, ...semanticEffect } = effect;
  return stableJsonKey(semanticEffect);
}

function compareIntents(left: ImmediateEffectIntent, right: ImmediateEffectIntent): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }
  if (left.originatingRuleId !== right.originatingRuleId) {
    return left.originatingRuleId < right.originatingRuleId ? -1 : 1;
  }
  if (left.effectOrder !== right.effectOrder) {
    return left.effectOrder - right.effectOrder;
  }
  return left.effect.effect_id < right.effect.effect_id
    ? -1
    : left.effect.effect_id > right.effect.effect_id
      ? 1
      : 0;
}

function applySingleEffect(
  inputState: PatientState,
  effect: ImmediateStateEffect,
  clinicalTime: number
): PatientState {
  switch (effect.effect_type) {
    case "SET_STATE":
      return PatientStateSchema.parse({
        ...inputState,
        [effect.target]: effect.value
      });
    case "SET_PAIN_STATE":
      return PatientStateSchema.parse({
        ...inputState,
        pain_state: effect.value
      });
    case "ADD_INTERVENTION": {
      if (inputState.active_interventions.some(
        (item) => item.intervention_id === effect.intervention_id
      )) {
        return inputState;
      }
      const activeInterventions = [...inputState.active_interventions];
      activeInterventions.push({
        intervention_id: effect.intervention_id,
        intervention_type: effect.intervention_type,
        started_at_clinical_time: ClinicalTimeSchema.parse(clinicalTime),
        parameters: effect.parameters
      });
      activeInterventions.sort((left, right) =>
        left.intervention_id < right.intervention_id
          ? -1
          : left.intervention_id > right.intervention_id
            ? 1
            : 0
      );
      return PatientStateSchema.parse({ ...inputState, active_interventions: activeInterventions });
    }
    case "REMOVE_INTERVENTION":
      return PatientStateSchema.parse({
        ...inputState,
        active_interventions: inputState.active_interventions.filter(
          (item) => item.intervention_id !== effect.intervention_id
        )
      });
    case "ADD_COMPLICATION": {
      if (inputState.active_complications.some(
        (item) => item.complication_id === effect.complication_id
      )) {
        return inputState;
      }
      const activeComplications = [...inputState.active_complications];
      activeComplications.push({
        complication_id: effect.complication_id,
        complication_type: effect.complication_type,
        activated_at_clinical_time: ClinicalTimeSchema.parse(clinicalTime),
        attributes: effect.attributes
      });
      activeComplications.sort((left, right) =>
        left.complication_id < right.complication_id
          ? -1
          : left.complication_id > right.complication_id
            ? 1
            : 0
      );
      return PatientStateSchema.parse({ ...inputState, active_complications: activeComplications });
    }
    case "REMOVE_COMPLICATION":
      return PatientStateSchema.parse({
        ...inputState,
        active_complications: inputState.active_complications.filter(
          (item) => item.complication_id !== effect.complication_id
        )
      });
    case "ADD_OUTCOME_FLAG":
      return PatientStateSchema.parse({
        ...inputState,
        outcome_flags: [...new Set([...inputState.outcome_flags, effect.outcome_flag])].sort()
      });
    case "REMOVE_OUTCOME_FLAG":
      return PatientStateSchema.parse({
        ...inputState,
        outcome_flags: inputState.outcome_flags.filter((flag) => flag !== effect.outcome_flag)
      });
  }
}

export function applyImmediateEffectIntents(
  inputState: PatientState,
  intentsInput: readonly ImmediateEffectIntent[]
): ImmediateEffectApplicationResult {
  const intents = [...intentsInput].sort(compareIntents);
  const byChannel = new Map<string, ImmediateEffectIntent[]>();

  for (const intent of intents) {
    const channel = effectChannel(intent.effect);
    const group = byChannel.get(channel) ?? [];
    group.push(intent);
    byChannel.set(channel, group);
  }

  const selected: ImmediateEffectIntent[] = [];
  const facts: EffectApplicationFact[] = [];
  const issues: ClinicalTransitionIssue[] = [];

  for (const channel of [...byChannel.keys()].sort()) {
    const group = byChannel.get(channel)!;
    const distinctValues = new Set(group.map((intent) => effectValueKey(intent.effect)));

    if (distinctValues.size === 1) {
      selected.push(group[0]!);
      continue;
    }

    const highestPriority = group[0]!.priority;
    const highest = group.filter((intent) => intent.priority === highestPriority);
    const highestDistinctValues = new Set(
      highest.map((intent) => effectValueKey(intent.effect))
    );

    const conflictPolicies = new Set(group.map((intent) => intent.conflictPolicy));
    if (conflictPolicies.size > 1) {
      const first = group[0]!;
      issues.push(createTransitionIssue({
        code: "MIXED_CONFLICT_POLICIES",
        path: "$.policy.rules.effects",
        rule_id: first.originatingRuleId,
        effect_id: first.effect.effect_id,
        state_channel: channel,
        detail_code: "conflict.mixed-policies",
        message: "Contradictory writes to one Patient State channel must use one conflict policy."
      }));
      facts.push({
        kind: "EFFECT_REJECTED",
        ruleId: first.originatingRuleId,
        effectId: first.effect.effect_id,
        channel,
        detailCode: "effect.rejected-mixed-policies",
        data: { contender_count: group.length },
        clinicalTime: first.clinicalTime
      });
      continue;
    }

    if (highestDistinctValues.size > 1) {
      const first = highest[0]!;
      issues.push(createTransitionIssue({
        code: "UNRESOLVED_EFFECT_CONFLICT",
        path: "$.rules.effects",
        rule_id: first.originatingRuleId,
        effect_id: first.effect.effect_id,
        state_channel: channel,
        detail_code: "conflict.equal-priority",
        message: "Equal-priority contradictory writes to one Patient State channel are ambiguous."
      }));
      facts.push({
        kind: "CONFLICT_DETECTED",
        ruleId: first.originatingRuleId,
        effectId: first.effect.effect_id,
        channel,
        detailCode: "conflict.equal-priority",
        data: { contender_count: highest.length, priority: highestPriority },
        clinicalTime: first.clinicalTime
      });
      continue;
    }

    const winner = highest[0]!;

    if (winner.conflictPolicy === "BLOCK") {
      facts.push({
        kind: "CONFLICT_RESOLVED",
        ruleId: winner.originatingRuleId,
        effectId: winner.effect.effect_id,
        channel,
        detailCode: "conflict.blocked",
        data: { contender_count: group.length },
        clinicalTime: winner.clinicalTime
      });
      continue;
    }

    selected.push(winner);
    facts.push({
      kind: "CONFLICT_RESOLVED",
      ruleId: winner.originatingRuleId,
      effectId: winner.effect.effect_id,
      channel,
      detailCode: winner.conflictPolicy === "REPLACE"
        ? "conflict.replaced"
        : "conflict.highest-priority",
      data: { contender_count: group.length, winning_priority: winner.priority },
      clinicalTime: winner.clinicalTime
    });
  }

  if (issues.length > 0) {
    return { success: false, issues, facts };
  }

  for (const intent of selected) {
    if (intent.effect.effect_type === "ADD_INTERVENTION") {
      const effect = intent.effect;
      const existing = inputState.active_interventions.find(
        (item) => item.intervention_id === effect.intervention_id
      );
      const proposed = {
        intervention_id: effect.intervention_id,
        intervention_type: effect.intervention_type,
        started_at_clinical_time: ClinicalTimeSchema.parse(intent.clinicalTime),
        parameters: effect.parameters
      };
      if (existing !== undefined && stableJsonKey(existing) !== stableJsonKey(proposed)) {
        issues.push(createTransitionIssue({
          code: "IDENTITY_CONFLICT",
          path: "$.policy.rules.effects",
          rule_id: intent.originatingRuleId,
          effect_id: intent.effect.effect_id,
          state_channel: effectChannel(intent.effect),
          detail_code: "identity.intervention-conflict",
          message: "ADD_INTERVENTION cannot replace an existing intervention identity."
        }));
        facts.push({
          kind: "EFFECT_REJECTED",
          ruleId: intent.originatingRuleId,
          effectId: intent.effect.effect_id,
          channel: effectChannel(intent.effect),
          detailCode: "effect.rejected-identity-conflict",
          data: {},
          clinicalTime: intent.clinicalTime
        });
      }
    } else if (intent.effect.effect_type === "ADD_COMPLICATION") {
      const effect = intent.effect;
      const existing = inputState.active_complications.find(
        (item) => item.complication_id === effect.complication_id
      );
      const proposed = {
        complication_id: effect.complication_id,
        complication_type: effect.complication_type,
        activated_at_clinical_time: ClinicalTimeSchema.parse(intent.clinicalTime),
        attributes: effect.attributes
      };
      if (existing !== undefined && stableJsonKey(existing) !== stableJsonKey(proposed)) {
        issues.push(createTransitionIssue({
          code: "IDENTITY_CONFLICT",
          path: "$.policy.rules.effects",
          rule_id: intent.originatingRuleId,
          effect_id: intent.effect.effect_id,
          state_channel: effectChannel(intent.effect),
          detail_code: "identity.complication-conflict",
          message: "ADD_COMPLICATION cannot replace an existing complication identity."
        }));
        facts.push({
          kind: "EFFECT_REJECTED",
          ruleId: intent.originatingRuleId,
          effectId: intent.effect.effect_id,
          channel: effectChannel(intent.effect),
          detailCode: "effect.rejected-identity-conflict",
          data: {},
          clinicalTime: intent.clinicalTime
        });
      }
    }
  }

  if (issues.length > 0) {
    return { success: false, issues, facts };
  }

  let state = PatientStateSchema.parse(inputState);

  for (const intent of selected.sort(compareIntents)) {
    const channel = effectChannel(intent.effect);
    const before = stableJsonKey(state);
    state = applySingleEffect(state, intent.effect, intent.clinicalTime);
    const changed = stableJsonKey(state) !== before;

    facts.push({
      kind: "EFFECT_APPLIED",
      ruleId: intent.originatingRuleId,
      effectId: intent.effect.effect_id,
      channel,
      detailCode: changed ? "effect.applied" : "effect.no-op",
      data: { changed },
      clinicalTime: intent.clinicalTime
    });

    if (changed) {
      facts.push({
        kind: "STATE_CHANNEL_CHANGED",
        ruleId: intent.originatingRuleId,
        effectId: intent.effect.effect_id,
        channel,
        detailCode: "state.channel-changed",
        data: {},
        clinicalTime: intent.clinicalTime
      });
    }
  }

  return { success: true, issues: [], state, facts };
}
