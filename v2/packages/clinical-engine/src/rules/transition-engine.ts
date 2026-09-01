import { z } from "zod";

import {
  CLINICAL_EVENT_PROPOSAL_SCHEMA_VERSION,
  ClinicalEvaluationTriggerSchema,
  ClinicalEventProposalSchema,
  ClinicalTimeSchema,
  ClinicalTransitionSuccessSchema,
  PatientStateSchema,
  PinnedClinicalPolicyEnvelopeSchema,
  PriorCommittedEventFactSchema,
  SCHEDULER_SCHEMA_VERSION,
  ScheduledItemSchema,
  SchedulerStateSchema,
  TRANSITION_TRACE_SCHEMA_VERSION,
  TransitionTraceSchema,
  type ClinicalEvaluationTrigger,
  type ClinicalEventProposal,
  type ClinicalTransitionSuccess,
  type PatientState,
  type PinnedClinicalPolicyEnvelope,
  type RuleEffect,
  type ScheduledItem,
  type SchedulerState,
  type TransitionRule,
  type TransitionTrace,
  type TransitionTraceEntry
} from "../../../contracts/src/index.ts";

import {
  applyImmediateEffectIntents,
  type EffectApplicationFact,
  type ImmediateEffectIntent
} from "../effects/apply-effects.ts";
import { projectObservations } from "../observations/project-observations.ts";
import {
  scheduledItemMatchesCancellation,
  sortScheduledItems,
  validateSchedulerState
} from "../scheduler/clinical-scheduler.ts";
import { validateAuthoritativePatientState } from "../state/patient-state.ts";
import { stableJsonKey } from "../validation/stable-key.ts";
import {
  createTransitionIssue,
  sortTransitionIssues,
  transitionIssuesFromZodError,
  type ClinicalTransitionIssue
} from "../validation/transition-issues.ts";
import {
  ENGINE_WORK_LIMITS,
  consumeEngineWork,
  createEngineWorkBudget,
  markEngineWorkExceeded,
  type EngineWorkBudget
} from "../validation/work-budget.ts";
import {
  evaluateAllConditions,
  evaluateAnyCondition,
  type ConditionEvaluationContext
} from "./conditions.ts";

const RuntimeCommonShape = {
  policy: PinnedClinicalPolicyEnvelopeSchema,
  state: PatientStateSchema,
  scheduler_state: SchedulerStateSchema,
  prior_event_facts: z.array(PriorCommittedEventFactSchema).max(4096)
};

const ExternalTriggerSchema = ClinicalEvaluationTriggerSchema.refine(
  (trigger) => trigger.trigger_type !== "SCHEDULED_ITEM",
  "Scheduled-item triggers are created only by authoritative due-work processing"
);

export const PinnedClinicalEvaluationRequestSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("EVALUATE_TRIGGER"),
    ...RuntimeCommonShape,
    trigger: ExternalTriggerSchema,
    current_clinical_time: ClinicalTimeSchema
  }),
  z.strictObject({
    operation: z.literal("PROCESS_DUE"),
    ...RuntimeCommonShape,
    target_clinical_time: ClinicalTimeSchema
  })
]);
export type PinnedClinicalEvaluationRequest = z.infer<
  typeof PinnedClinicalEvaluationRequestSchema
>;

export type ClinicalTransitionFailure = {
  success: false;
  issues: ClinicalTransitionIssue[];
  trace?: TransitionTrace;
};
export type ClinicalTransitionResult = ClinicalTransitionFailure | ClinicalTransitionSuccess;

type TraceCollector = {
  add(input: Omit<TransitionTraceEntry, "trace_index">): boolean;
  addTerminal(input: Omit<TransitionTraceEntry, "trace_index">): void;
  entries(): TransitionTraceEntry[];
};

type FiredRule = { rule: TransitionRule; clinicalTime: number };
type ScheduleOperation = {
  effect: Extract<RuleEffect, { effect_type: "SCHEDULE_RELATIVE" | "SCHEDULE_ABSOLUTE" }>;
  rule: TransitionRule;
  clinicalTime: number;
  effectOrder: number;
};
type CancellationOperation = {
  effect: Extract<RuleEffect, { effect_type: "CANCEL_SCHEDULED" }>;
  rule: TransitionRule;
  clinicalTime: number;
  effectOrder: number;
};
type StepSuccess = {
  success: true;
  state: PatientState;
  schedulerState: SchedulerState;
  proposals: ClinicalEventProposal[];
  cycleEvaluations: number;
};
type StepFailure = { success: false; issues: ClinicalTransitionIssue[] };
type StepResult = StepSuccess | StepFailure;

function createTraceCollector(budget: EngineWorkBudget): TraceCollector {
  const entries: TransitionTraceEntry[] = [];
  const normalLimit = ENGINE_WORK_LIMITS.trace_entries - 2;
  const append = (
    input: Omit<TransitionTraceEntry, "trace_index">,
    terminal: boolean
  ): boolean => {
    if (!terminal && entries.length >= normalLimit) {
      markEngineWorkExceeded(budget, "trace_entries");
      return false;
    }
    if (entries.length >= ENGINE_WORK_LIMITS.trace_entries) {
      markEngineWorkExceeded(budget, "trace_entries");
      return false;
    }
    entries.push({ ...input, trace_index: entries.length });
    return true;
  };
  return {
    add(input) {
      return append(input, false);
    },
    addTerminal(input) {
      append(input, true);
    },
    entries() {
      return [...entries];
    }
  };
}

function compareRules(left: TransitionRule, right: TransitionRule): number {
  return left.priority !== right.priority
    ? right.priority - left.priority
    : left.rule_id < right.rule_id
      ? -1
      : left.rule_id > right.rule_id
        ? 1
        : 0;
}

function triggerMatches(
  rule: TransitionRule,
  trigger: ClinicalEvaluationTrigger,
  clinicalTime: number,
  context: ConditionEvaluationContext,
  clinicalTimeWindowStartExclusive?: number
): boolean {
  switch (rule.trigger.trigger_type) {
    case "COMMITTED_EVENT":
      return trigger.trigger_type === "COMMITTED_EVENT"
        && trigger.event_type === rule.trigger.event_type
        && (rule.trigger.action_id === undefined || trigger.action_id === rule.trigger.action_id);
    case "CLINICAL_TIME_THRESHOLD":
      // PROCESS_DUE treats the input state's Clinical Time as already settled.
      // The exclusive lower bound prevents old thresholds from firing again
      // when Session orchestration visits multiple chronological boundaries.
      return trigger.trigger_type === "CLINICAL_TIME"
        && clinicalTime >= rule.trigger.threshold_clinical_time
        && (clinicalTimeWindowStartExclusive === undefined
          || rule.trigger.threshold_clinical_time > clinicalTimeWindowStartExclusive);
    case "SCHEDULED_ITEM":
      return trigger.trigger_type === "SCHEDULED_ITEM"
        && (rule.trigger.scheduled_item_id === undefined
          || trigger.scheduled_item_id === rule.trigger.scheduled_item_id)
        && (rule.trigger.category === undefined || trigger.category === rule.trigger.category);
    case "STATE_CONDITION":
      return trigger.trigger_type === "STATE_CONDITION"
        && evaluateAllConditions(rule.trigger.conditions, context).matched;
  }
}

function evaluateRulesForTrigger(
  rules: readonly TransitionRule[],
  state: PatientState,
  trigger: ClinicalEvaluationTrigger,
  clinicalTime: number,
  priorEvents: ConditionEvaluationContext["priorEvents"],
  caseFactIds: ReadonlySet<string>,
  trace: TraceCollector,
  budget: EngineWorkBudget,
  activationKeys: Set<string>,
  clinicalTimeWindowStartExclusive?: number
): FiredRule[] {
  const fired: FiredRule[] = [];
  const context: ConditionEvaluationContext = {
    state,
    trigger,
    clinicalTime: ClinicalTimeSchema.parse(clinicalTime),
    priorEvents,
    caseFactIds
  };
  const stateFingerprint = patientStateFingerprint(state);

  for (const rule of [...rules].sort(compareRules)) {
    if (!consumeEngineWork(budget, "rules_considered")) break;
    trace.add({
      kind: "RULE_CONSIDERED",
      clinical_time: context.clinicalTime,
      rule_id: rule.rule_id,
      detail_code: "rule.considered",
      data: { trigger_type: trigger.trigger_type }
    });
    if (budget.exceeded !== undefined) break;
    if (!triggerMatches(
      rule,
      trigger,
      clinicalTime,
      context,
      clinicalTimeWindowStartExclusive
    )) {
      trace.add({
        kind: "RULE_INELIGIBLE",
        clinical_time: context.clinicalTime,
        rule_id: rule.rule_id,
        detail_code: "rule.trigger-not-matched",
        data: {}
      });
      continue;
    }
    const preconditions = evaluateAllConditions(rule.preconditions, context);
    if (!preconditions.matched) {
      trace.add({
        kind: "RULE_INELIGIBLE",
        clinical_time: context.clinicalTime,
        rule_id: rule.rule_id,
        detail_code: "rule.precondition-failed",
        data: { failed_conditions: preconditions.failedDetailCodes.join("|") }
      });
      continue;
    }
    const exclusions = evaluateAnyCondition(rule.exclusions, context);
    if (exclusions.matched) {
      trace.add({
        kind: "RULE_EXCLUDED",
        clinical_time: context.clinicalTime,
        rule_id: rule.rule_id,
        detail_code: "rule.exclusion-matched",
        data: { matched_exclusions: exclusions.matchedDetailCodes.join("|") }
      });
      continue;
    }
    if (trigger.trigger_type === "STATE_CONDITION") {
      const activationKey = `${rule.rule_id}\u0000${stateFingerprint}`;
      if (activationKeys.has(activationKey)) {
        trace.add({
          kind: "RULE_INELIGIBLE",
          clinical_time: context.clinicalTime,
          rule_id: rule.rule_id,
          detail_code: "rule.activation-already-consumed",
          data: {}
        });
        continue;
      }
      activationKeys.add(activationKey);
    }
    if (!consumeEngineWork(budget, "rule_activations")) break;
    trace.add({
      kind: "RULE_FIRED",
      clinical_time: context.clinicalTime,
      rule_id: rule.rule_id,
      detail_code: "rule.fired",
      data: { priority: rule.priority }
    });
    fired.push({ rule, clinicalTime });
  }
  return fired;
}

function collectRuleOperations(firedRules: readonly FiredRule[]) {
  const immediate: ImmediateEffectIntent[] = [];
  const schedules: ScheduleOperation[] = [];
  const cancellations: CancellationOperation[] = [];
  for (const { rule, clinicalTime } of firedRules) {
    rule.effects.forEach((effect, effectOrder) => {
      if (effect.effect_type === "SCHEDULE_RELATIVE" || effect.effect_type === "SCHEDULE_ABSOLUTE") {
        schedules.push({ effect, rule, clinicalTime, effectOrder });
      } else if (effect.effect_type === "CANCEL_SCHEDULED") {
        cancellations.push({ effect, rule, clinicalTime, effectOrder });
      } else {
        immediate.push({
          effect,
          originatingRuleId: rule.rule_id,
          priority: rule.priority,
          conflictPolicy: rule.conflict_policy,
          effectOrder,
          clinicalTime
        });
      }
    });
  }
  return { immediate, schedules, cancellations };
}

function operationOrder(
  left: ScheduleOperation | CancellationOperation,
  right: ScheduleOperation | CancellationOperation
): number {
  const ruleOrder = compareRules(left.rule, right.rule);
  return ruleOrder === 0 ? left.effectOrder - right.effectOrder : ruleOrder;
}

function addOrResolveScheduledItem(
  pendingItems: ScheduledItem[],
  item: ScheduledItem,
  clinicalTime: number,
  trace: TraceCollector,
  issues: ClinicalTransitionIssue[]
): ScheduledItem[] {
  const index = pendingItems.findIndex(
    (pending) => pending.scheduled_item_id === item.scheduled_item_id
  );
  if (index < 0) {
    trace.add({
      kind: "SCHEDULED_ITEM_CREATED",
      clinical_time: ClinicalTimeSchema.parse(clinicalTime),
      rule_id: item.originating_rule_id,
      scheduled_item_id: item.scheduled_item_id,
      detail_code: "schedule.created",
      data: { category: item.category, due_clinical_time: item.due_clinical_time }
    });
    return sortScheduledItems([...pendingItems, item]);
  }
  const existing = pendingItems[index]!;
  if (stableJsonKey(existing) === stableJsonKey(item)) return pendingItems;
  if (item.conflict_policy === "BLOCK") {
    trace.add({
      kind: "CONFLICT_RESOLVED",
      clinical_time: ClinicalTimeSchema.parse(clinicalTime),
      rule_id: item.originating_rule_id,
      scheduled_item_id: item.scheduled_item_id,
      detail_code: "schedule.conflict-blocked",
      data: {}
    });
    return pendingItems;
  }
  if (item.conflict_policy === "HIGHEST_PRIORITY" && item.priority === existing.priority) {
    issues.push(createTransitionIssue({
      code: "UNRESOLVED_EFFECT_CONFLICT",
      path: "$.policy.timeline_policy",
      rule_id: item.originating_rule_id,
      scheduled_item_id: item.scheduled_item_id,
      detail_code: "schedule.equal-priority-conflict",
      message: "Equal-priority contradictory scheduled items cannot be resolved."
    }));
    trace.add({
      kind: "CONFLICT_DETECTED",
      clinical_time: ClinicalTimeSchema.parse(clinicalTime),
      rule_id: item.originating_rule_id,
      scheduled_item_id: item.scheduled_item_id,
      detail_code: "schedule.equal-priority-conflict",
      data: { priority: item.priority }
    });
    return pendingItems;
  }
  if (item.conflict_policy === "HIGHEST_PRIORITY" && item.priority < existing.priority) {
    return pendingItems;
  }
  const next = [...pendingItems];
  next[index] = item;
  trace.add({
    kind: "CONFLICT_RESOLVED",
    clinical_time: ClinicalTimeSchema.parse(clinicalTime),
    rule_id: item.originating_rule_id,
    scheduled_item_id: item.scheduled_item_id,
    detail_code: item.conflict_policy === "REPLACE"
      ? "schedule.replaced"
      : "schedule.highest-priority",
    data: { prior_priority: existing.priority, winning_priority: item.priority }
  });
  return sortScheduledItems(next);
}

function applySchedulerOperations(
  schedulerState: SchedulerState,
  schedules: readonly ScheduleOperation[],
  cancellations: readonly CancellationOperation[],
  trace: TraceCollector,
  budget: EngineWorkBudget
): { schedulerState: SchedulerState; issues: ClinicalTransitionIssue[] } {
  let pendingItems = [...schedulerState.pending_items];
  const issues: ClinicalTransitionIssue[] = [];

  for (const operation of [...schedules].sort(operationOrder)) {
    if (!consumeEngineWork(budget, "scheduled_items_created")) break;
    const { effect, rule, clinicalTime } = operation;
    const dueClinicalTime = effect.effect_type === "SCHEDULE_RELATIVE"
      ? clinicalTime + effect.delay_clinical_seconds
      : effect.due_clinical_time;
    if (!Number.isFinite(dueClinicalTime)) {
      issues.push(createTransitionIssue({
        code: "SCHEDULED_TIME_NONFINITE",
        path: "$.policy.rules.effects",
        rule_id: rule.rule_id,
        effect_id: effect.effect_id,
        scheduled_item_id: effect.scheduled_item_id,
        message: "Scheduled due clinical time must remain finite."
      }));
      trace.add({
        kind: "EFFECT_REJECTED",
        clinical_time: ClinicalTimeSchema.parse(clinicalTime),
        rule_id: rule.rule_id,
        effect_id: effect.effect_id,
        scheduled_item_id: effect.scheduled_item_id,
        detail_code: "effect.rejected-nonfinite-time",
        data: {}
      });
      continue;
    }
    if (dueClinicalTime <= clinicalTime) {
      issues.push(createTransitionIssue({
        code: "SCHEDULER_NON_PROGRESS",
        path: "$.policy.rules.effects",
        rule_id: rule.rule_id,
        effect_id: effect.effect_id,
        scheduled_item_id: effect.scheduled_item_id,
        detail_code: "schedule.non-progress",
        message: "Runtime-created scheduled work must advance Clinical Time strictly."
      }));
      trace.add({
        kind: "SCHEDULER_LIVENESS_FAILURE",
        clinical_time: ClinicalTimeSchema.parse(clinicalTime),
        rule_id: rule.rule_id,
        effect_id: effect.effect_id,
        scheduled_item_id: effect.scheduled_item_id,
        detail_code: "schedule.non-progress",
        data: { due_clinical_time: dueClinicalTime }
      });
      continue;
    }
    const itemResult = ScheduledItemSchema.safeParse({
      scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
      scheduled_item_id: effect.scheduled_item_id,
      originating_rule_id: rule.rule_id,
      category: effect.category,
      due_clinical_time: dueClinicalTime,
      priority: effect.priority,
      conflict_policy: effect.conflict_policy,
      effects: effect.effects,
      emitted_events: effect.emitted_events
    });
    if (!itemResult.success) {
      issues.push(...transitionIssuesFromZodError(
        "INVALID_RULE_DEFINITION",
        "$.policy.rules.effects",
        itemResult.error
      ));
      continue;
    }
    const alreadyExists = pendingItems.some(
      (item) => item.scheduled_item_id === itemResult.data.scheduled_item_id
    );
    if (!alreadyExists && pendingItems.length >= 1024) {
      markEngineWorkExceeded(budget, "scheduled_items_created");
      break;
    }
    pendingItems = addOrResolveScheduledItem(
      pendingItems,
      itemResult.data,
      clinicalTime,
      trace,
      issues
    );
  }

  for (const operation of [...cancellations].sort(operationOrder)) {
    if (!consumeEngineWork(budget, "cancellations_processed")) break;
    const matches = pendingItems
      .filter((item) => scheduledItemMatchesCancellation(item, operation.effect.selector))
      .sort((left, right) => left.scheduled_item_id < right.scheduled_item_id ? -1 : 1);
    if (matches.length === 0) {
      trace.add({
        kind: "SCHEDULED_ITEM_CANCELLATION_NO_MATCH",
        clinical_time: ClinicalTimeSchema.parse(operation.clinicalTime),
        rule_id: operation.rule.rule_id,
        effect_id: operation.effect.effect_id,
        detail_code: "schedule.cancellation-no-match",
        data: { selector_type: operation.effect.selector.selector_type }
      });
      continue;
    }
    const cancelled = new Set(matches.map((item) => item.scheduled_item_id));
    pendingItems = pendingItems.filter((item) => !cancelled.has(item.scheduled_item_id));
    for (const item of matches) {
      trace.add({
        kind: "SCHEDULED_ITEM_CANCELLED",
        clinical_time: ClinicalTimeSchema.parse(operation.clinicalTime),
        rule_id: operation.rule.rule_id,
        effect_id: operation.effect.effect_id,
        scheduled_item_id: item.scheduled_item_id,
        detail_code: "schedule.cancelled",
        data: { category: item.category }
      });
    }
  }

  const parsed = SchedulerStateSchema.safeParse({
    scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
    pending_items: sortScheduledItems(pendingItems)
  });
  if (!parsed.success) {
    return {
      schedulerState,
      issues: [...issues, ...transitionIssuesFromZodError(
        "INVALID_SCHEDULER_STATE",
        "$.scheduler_state",
        parsed.error
      )]
    };
  }
  return { schedulerState: parsed.data, issues };
}

type ProposalDefinition = TransitionRule["emitted_events"][number];

function appendProposals(
  definitions: readonly ProposalDefinition[],
  originatingRuleId: TransitionRule["rule_id"],
  clinicalTime: number,
  trace: TraceCollector,
  budget: EngineWorkBudget,
  proposals: ClinicalEventProposal[],
  scheduledItemId?: ScheduledItem["scheduled_item_id"]
): ClinicalTransitionIssue[] {
  const issues: ClinicalTransitionIssue[] = [];
  for (const definition of definitions) {
    if (!consumeEngineWork(budget, "event_proposals_created")) break;
    const parsed = ClinicalEventProposalSchema.safeParse({
      proposal_schema_version: CLINICAL_EVENT_PROPOSAL_SCHEMA_VERSION,
      event_type: definition.event_type,
      originating_rule_id: originatingRuleId,
      ...(definition.action_id === undefined ? {} : { action_id: definition.action_id }),
      clinical_effect_ids: definition.clinical_effect_ids,
      parameters: definition.parameters,
      payload: definition.payload,
      proposed_clinical_time: clinicalTime
    });
    if (!parsed.success) {
      issues.push(...transitionIssuesFromZodError(
        "INVALID_RULE_DEFINITION",
        "$.policy.rules.emitted_events",
        parsed.error
      ));
      continue;
    }
    proposals.push(parsed.data);
    trace.add({
      kind: "EVENT_PROPOSED",
      clinical_time: parsed.data.proposed_clinical_time,
      rule_id: parsed.data.originating_rule_id,
      ...(scheduledItemId === undefined ? {} : { scheduled_item_id: scheduledItemId }),
      detail_code: scheduledItemId === undefined ? "event.proposed" : "event.scheduled-proposal",
      data: { event_type: parsed.data.event_type }
    });
  }
  return issues;
}

function appendEffectFacts(trace: TraceCollector, facts: readonly EffectApplicationFact[]): void {
  for (const fact of facts) {
    trace.add({
      kind: fact.kind,
      clinical_time: ClinicalTimeSchema.parse(fact.clinicalTime),
      rule_id: fact.ruleId,
      effect_id: fact.effectId,
      state_channel: fact.channel,
      detail_code: fact.detailCode,
      data: fact.data
    });
  }
}

/** Excludes runtime version/time; includes every current rule-observable clinical field. */
export function patientStateFingerprint(state: PatientState): string {
  const { state_version: _version, clinical_time: _time, ...content } = state;
  return stableJsonKey(content);
}

function executeStep(input: {
  state: PatientState;
  schedulerState: SchedulerState;
  policy: PinnedClinicalPolicyEnvelope;
  trigger: ClinicalEvaluationTrigger;
  clinicalTime: number;
  priorEvents: ConditionEvaluationContext["priorEvents"];
  caseFactIds: ReadonlySet<string>;
  dueItem?: ScheduledItem;
  trace: TraceCollector;
  budget: EngineWorkBudget;
  activationKeys: Set<string>;
  clinicalTimeWindowStartExclusive?: number;
}): StepResult {
  let state = input.state;
  let schedulerState = input.schedulerState;
  const proposals: ClinicalEventProposal[] = [];
  const dueIntents: ImmediateEffectIntent[] = [];

  if (input.dueItem !== undefined) {
    input.dueItem.effects.forEach((effect, effectOrder) => {
      dueIntents.push({
        effect,
        originatingRuleId: input.dueItem!.originating_rule_id,
        priority: input.dueItem!.priority,
        conflictPolicy: input.dueItem!.conflict_policy,
        effectOrder,
        clinicalTime: input.dueItem!.due_clinical_time
      });
    });
    const issues = appendProposals(
      input.dueItem.emitted_events,
      input.dueItem.originating_rule_id,
      input.dueItem.due_clinical_time,
      input.trace,
      input.budget,
      proposals,
      input.dueItem.scheduled_item_id
    );
    if (issues.length > 0) return { success: false, issues };
  }

  const fired = evaluateRulesForTrigger(
    input.policy.rules,
    state,
    input.trigger,
    input.clinicalTime,
    input.priorEvents,
    input.caseFactIds,
    input.trace,
    input.budget,
    input.activationKeys,
    input.clinicalTimeWindowStartExclusive
  );
  if (input.budget.exceeded !== undefined) return { success: false, issues: [] };
  const operations = collectRuleOperations(fired);
  const attempted = dueIntents.length + operations.immediate.length
    + operations.schedules.length + operations.cancellations.length;
  if (!consumeEngineWork(input.budget, "effects_attempted", attempted)) {
    return { success: false, issues: [] };
  }
  const immediate = applyImmediateEffectIntents(state, [...dueIntents, ...operations.immediate]);
  appendEffectFacts(input.trace, immediate.facts);
  if (!immediate.success) return { success: false, issues: immediate.issues };
  state = immediate.state;

  const scheduler = applySchedulerOperations(
    schedulerState,
    operations.schedules,
    operations.cancellations,
    input.trace,
    input.budget
  );
  if (scheduler.issues.length > 0) return { success: false, issues: scheduler.issues };
  if (input.budget.exceeded !== undefined) return { success: false, issues: [] };
  schedulerState = scheduler.schedulerState;

  for (const firedRule of fired) {
    const issues = appendProposals(
      firedRule.rule.emitted_events,
      firedRule.rule.rule_id,
      firedRule.clinicalTime,
      input.trace,
      input.budget,
      proposals
    );
    if (issues.length > 0) return { success: false, issues };
  }
  if (input.budget.exceeded !== undefined) return { success: false, issues: [] };

  const stateRules = input.policy.rules.filter(
    (rule) => rule.trigger.trigger_type === "STATE_CONDITION"
  );
  const seen = new Set<string>([patientStateFingerprint(state)]);
  let cycleEvaluations = 0;
  while (stateRules.length > 0) {
    if (
      input.budget.counts.derived_passes
      >= input.policy.timeline_policy.max_derived_evaluations
    ) {
      input.trace.addTerminal({
        kind: "CYCLE_GUARD_FAILED",
        clinical_time: ClinicalTimeSchema.parse(input.clinicalTime),
        detail_code: "cycle.maximum-evaluations",
        data: {
          maximum_evaluations: input.policy.timeline_policy.max_derived_evaluations
        }
      });
      return {
        success: false,
        issues: [createTransitionIssue({
          code: "CYCLE_GUARD_EXCEEDED",
          path: "$.policy.timeline_policy.max_derived_evaluations",
          message: "Derived state-condition evaluation exceeded its pinned lower bound."
        })]
      };
    }
    if (!consumeEngineWork(
      input.budget,
      "derived_passes",
      1,
      input.policy.timeline_policy.max_derived_evaluations
    )) {
      return { success: false, issues: [] };
    }
    cycleEvaluations += 1;
    input.trace.add({
      kind: "DERIVED_EVALUATION",
      clinical_time: ClinicalTimeSchema.parse(input.clinicalTime),
      detail_code: "derived.evaluation",
      data: { evaluation_index: cycleEvaluations - 1 }
    });
    const derivedTrigger = ClinicalEvaluationTriggerSchema.parse({ trigger_type: "STATE_CONDITION" });
    const derivedFired = evaluateRulesForTrigger(
      stateRules,
      state,
      derivedTrigger,
      input.clinicalTime,
      input.priorEvents,
      input.caseFactIds,
      input.trace,
      input.budget,
      input.activationKeys
    );
    if (input.budget.exceeded !== undefined) return { success: false, issues: [] };
    if (derivedFired.length === 0) break;

    const derivedOperations = collectRuleOperations(derivedFired);
    const derivedAttempted = derivedOperations.immediate.length
      + derivedOperations.schedules.length + derivedOperations.cancellations.length;
    if (!consumeEngineWork(input.budget, "effects_attempted", derivedAttempted)) {
      return { success: false, issues: [] };
    }
    const beforeKey = patientStateFingerprint(state);
    const derivedImmediate = applyImmediateEffectIntents(state, derivedOperations.immediate);
    appendEffectFacts(input.trace, derivedImmediate.facts);
    if (!derivedImmediate.success) return { success: false, issues: derivedImmediate.issues };
    state = derivedImmediate.state;

    const derivedScheduler = applySchedulerOperations(
      schedulerState,
      derivedOperations.schedules,
      derivedOperations.cancellations,
      input.trace,
      input.budget
    );
    if (derivedScheduler.issues.length > 0) {
      return { success: false, issues: derivedScheduler.issues };
    }
    if (input.budget.exceeded !== undefined) return { success: false, issues: [] };
    schedulerState = derivedScheduler.schedulerState;

    for (const firedRule of derivedFired) {
      const issues = appendProposals(
        firedRule.rule.emitted_events,
        firedRule.rule.rule_id,
        firedRule.clinicalTime,
        input.trace,
        input.budget,
        proposals
      );
      if (issues.length > 0) return { success: false, issues };
    }
    if (input.budget.exceeded !== undefined) return { success: false, issues: [] };
    const nextKey = patientStateFingerprint(state);
    if (nextKey === beforeKey) break;
    if (seen.has(nextKey)) {
      input.trace.addTerminal({
        kind: "CYCLE_GUARD_FAILED",
        clinical_time: ClinicalTimeSchema.parse(input.clinicalTime),
        detail_code: "cycle.repeated-state",
        data: { evaluation_index: cycleEvaluations }
      });
      return {
        success: false,
        issues: [createTransitionIssue({
          code: "CYCLE_DETECTED",
          path: "$.policy.rules",
          message: "Derived state-condition rules repeated a prior Patient State."
        })]
      };
    }
    seen.add(nextKey);
  }
  return { success: true, state, schedulerState, proposals, cycleEvaluations };
}

function buildTrace(
  state: PatientState,
  trigger: ClinicalEvaluationTrigger,
  trace: TraceCollector,
  cycleStatus: "STABLE" | "NOT_REQUIRED" | "FAILED",
  cycleEvaluations: number,
  maximumEvaluations: number,
  outputVersion: number,
  outputTime: number
): TransitionTrace | undefined {
  const parsed = TransitionTraceSchema.safeParse({
    trace_schema_version: TRANSITION_TRACE_SCHEMA_VERSION,
    input_state_version: state.state_version,
    input_clinical_time: state.clinical_time,
    trigger,
    entries: trace.entries(),
    cycle_guard: {
      status: cycleStatus,
      evaluations: cycleEvaluations,
      maximum_evaluations: maximumEvaluations
    },
    output_state_version: outputVersion,
    output_clinical_time: outputTime
  });
  return parsed.success ? parsed.data : undefined;
}

function budgetFailure(
  state: PatientState,
  trigger: ClinicalEvaluationTrigger,
  policy: PinnedClinicalPolicyEnvelope,
  trace: TraceCollector,
  budget: EngineWorkBudget,
  cycleEvaluations: number
): ClinicalTransitionFailure {
  const category = budget.exceeded ?? "trace_entries";
  trace.addTerminal({
    kind: "BUDGET_EXCEEDED",
    clinical_time: state.clinical_time,
    detail_code: `budget.${category.replaceAll("_", "-")}`,
    data: { category }
  });
  return {
    success: false,
    issues: [createTransitionIssue({
      code: "EVALUATION_BUDGET_EXCEEDED",
      path: "$.policy",
      detail_code: `budget.${category.replaceAll("_", "-")}`,
      message: `Clinical evaluation exceeded the hard ${category} work limit.`
    })],
    trace: buildTrace(
      state,
      trigger,
      trace,
      "FAILED",
      cycleEvaluations,
      policy.timeline_policy.max_derived_evaluations,
      state.state_version,
      state.clinical_time
    )
  };
}

function failureResult(
  state: PatientState,
  trigger: ClinicalEvaluationTrigger,
  policy: PinnedClinicalPolicyEnvelope,
  trace: TraceCollector,
  issues: ClinicalTransitionIssue[],
  cycleEvaluations: number
): ClinicalTransitionFailure {
  return {
    success: false,
    issues: sortTransitionIssues(issues),
    trace: buildTrace(
      state,
      trigger,
      trace,
      "FAILED",
      cycleEvaluations,
      policy.timeline_policy.max_derived_evaluations,
      state.state_version,
      state.clinical_time
    )
  };
}

function executeParsedRequest(request: PinnedClinicalEvaluationRequest): ClinicalTransitionResult {
  const policy = request.policy;
  if (request.state.case_version !== policy.case_version) {
    return {
      success: false,
      issues: [createTransitionIssue({
        code: "PINNED_POLICY_MISMATCH",
        path: "$.state.case_version",
        detail_code: "policy.case-version-mismatch",
        message: "Patient State semantic Case Version does not match pinned clinical policy."
      })]
    };
  }
  const stateValidation = validateAuthoritativePatientState(request.state);
  const schedulerValidation = validateSchedulerState(request.scheduler_state);
  if (!stateValidation.valid || !schedulerValidation.success) {
    return {
      success: false,
      issues: sortTransitionIssues([
        ...(!stateValidation.valid
          ? stateValidation.issues.map((item) => createTransitionIssue({
              code: "INVALID_TRANSITION_INPUT",
              path: item.path,
              message: item.message
            }))
          : []),
        ...(!schedulerValidation.success ? schedulerValidation.issues : [])
      ])
    };
  }

  const state = stateValidation.state;
  const scheduler = schedulerValidation.schedulerState;
  const targetTime = request.operation === "PROCESS_DUE"
    ? request.target_clinical_time
    : request.current_clinical_time;
  const publicTrigger = request.operation === "PROCESS_DUE"
    ? ClinicalEvaluationTriggerSchema.parse({
        trigger_type: "CLINICAL_TIME",
        target_clinical_time: request.target_clinical_time
      })
    : request.trigger;
  if (targetTime < state.clinical_time) {
    return {
      success: false,
      issues: [createTransitionIssue({
        code: "CLINICAL_TIME_REGRESSION",
        path: request.operation === "PROCESS_DUE"
          ? "$.target_clinical_time"
          : "$.current_clinical_time",
        message: "Clinical Engine cannot propose a state at an earlier Clinical Time."
      })]
    };
  }

  const budget = createEngineWorkBudget();
  const trace = createTraceCollector(budget);
  trace.add({
    kind: "EVALUATION_STARTED",
    clinical_time: targetTime,
    detail_code: "evaluation.started",
    data: { input_state_version: state.state_version, input_clinical_time: state.clinical_time }
  });
  let workingState = PatientStateSchema.parse(state);
  let schedulerState = scheduler;
  const proposals: ClinicalEventProposal[] = [];
  const activationKeys = new Set<string>();
  const caseFactIds = new Set<string>(policy.approved_case_fact_ids);
  let cycleEvaluations = 0;

  if (request.operation === "PROCESS_DUE") {
    while (true) {
      const nextDue = sortScheduledItems(schedulerState.pending_items)[0];
      if (nextDue === undefined || nextDue.due_clinical_time > targetTime) break;
      if (nextDue.due_clinical_time < workingState.clinical_time) {
        trace.addTerminal({
          kind: "SCHEDULER_LIVENESS_FAILURE",
          clinical_time: workingState.clinical_time,
          scheduled_item_id: nextDue.scheduled_item_id,
          detail_code: "schedule.pending-item-in-past",
          data: { due_clinical_time: nextDue.due_clinical_time }
        });
        return failureResult(state, publicTrigger, policy, trace, [createTransitionIssue({
          code: "SCHEDULER_NON_PROGRESS",
          path: "$.scheduler_state.pending_items",
          scheduled_item_id: nextDue.scheduled_item_id,
          detail_code: "schedule.pending-item-in-past",
          message: "Pending scheduled work cannot execute before authoritative Clinical Time."
        })], cycleEvaluations);
      }
      if (!consumeEngineWork(budget, "due_items_processed")
        || !consumeEngineWork(budget, "scheduler_causal_depth")) {
        return budgetFailure(state, publicTrigger, policy, trace, budget, cycleEvaluations);
      }
      const afterRemoval = SchedulerStateSchema.safeParse({
        scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
        pending_items: schedulerState.pending_items.filter(
          (item) => item.scheduled_item_id !== nextDue.scheduled_item_id
        )
      });
      if (!afterRemoval.success) {
        return failureResult(
          state,
          publicTrigger,
          policy,
          trace,
          transitionIssuesFromZodError(
            "INVALID_SCHEDULER_STATE",
            "$.scheduler_state",
            afterRemoval.error
          ),
          cycleEvaluations
        );
      }
      schedulerState = afterRemoval.data;
      trace.add({
        kind: "DUE_ITEM_PROCESSED",
        clinical_time: nextDue.due_clinical_time,
        rule_id: nextDue.originating_rule_id,
        scheduled_item_id: nextDue.scheduled_item_id,
        detail_code: "schedule.due-item-processed",
        data: { category: nextDue.category, priority: nextDue.priority }
      });
      const dueTrigger = ClinicalEvaluationTriggerSchema.parse({
        trigger_type: "SCHEDULED_ITEM",
        scheduled_item_id: nextDue.scheduled_item_id,
        category: nextDue.category
      });
      const step = executeStep({
        state: workingState,
        schedulerState,
        policy,
        trigger: dueTrigger,
        clinicalTime: nextDue.due_clinical_time,
        priorEvents: request.prior_event_facts,
        caseFactIds,
        dueItem: nextDue,
        trace,
        budget,
        activationKeys
      });
      if (budget.exceeded !== undefined) {
        return budgetFailure(state, publicTrigger, policy, trace, budget, cycleEvaluations);
      }
      if (!step.success) {
        return failureResult(state, publicTrigger, policy, trace, step.issues, cycleEvaluations);
      }
      workingState = step.state;
      schedulerState = step.schedulerState;
      proposals.push(...step.proposals);
      cycleEvaluations += step.cycleEvaluations;
    }
  }

  const finalStep = executeStep({
    state: workingState,
    schedulerState,
    policy,
    trigger: publicTrigger,
    clinicalTime: targetTime,
    priorEvents: request.prior_event_facts,
    caseFactIds,
    trace,
    budget,
    activationKeys,
    ...(request.operation === "PROCESS_DUE"
      ? { clinicalTimeWindowStartExclusive: state.clinical_time }
      : {})
  });
  if (budget.exceeded !== undefined) {
    return budgetFailure(state, publicTrigger, policy, trace, budget, cycleEvaluations);
  }
  if (!finalStep.success) {
    return failureResult(state, publicTrigger, policy, trace, finalStep.issues, cycleEvaluations);
  }
  workingState = finalStep.state;
  schedulerState = finalStep.schedulerState;
  proposals.push(...finalStep.proposals);
  cycleEvaluations += finalStep.cycleEvaluations;

  const contentChanged = patientStateFingerprint(workingState) !== patientStateFingerprint(state);
  const timeChanged = targetTime !== state.clinical_time;
  const stateChanged = contentChanged || timeChanged;
  const versionAfter = stateChanged ? state.state_version + 1 : state.state_version;
  const finalStateValidation = validateAuthoritativePatientState({
    ...workingState,
    state_version: versionAfter,
    clinical_time: targetTime
  });
  if (!finalStateValidation.valid) {
    return failureResult(
      state,
      publicTrigger,
      policy,
      trace,
      finalStateValidation.issues.map((item) => createTransitionIssue({
        code: "INVALID_NEXT_PATIENT_STATE",
        path: item.path,
        message: item.message
      })),
      cycleEvaluations
    );
  }
  const observations = projectObservations(
    finalStateValidation.state,
    policy.observation_projection
  );
  if (!observations.success) {
    trace.addTerminal({
      kind: "EFFECT_REJECTED",
      clinical_time: targetTime,
      detail_code: "projection.rejected",
      data: { issue_count: observations.issues.length }
    });
    return failureResult(
      state,
      publicTrigger,
      policy,
      trace,
      observations.issues.map((item) => createTransitionIssue({
        code: "OBSERVATION_PROJECTION_FAILED",
        path: item.path,
        detail_code: item.code.toLowerCase().replaceAll("_", "-"),
        message: item.message
      })),
      cycleEvaluations
    );
  }

  trace.addTerminal({
    kind: "EVALUATION_COMPLETED",
    clinical_time: targetTime,
    detail_code: stateChanged ? "evaluation.state-proposed" : "evaluation.no-state-change",
    data: {
      state_changed: stateChanged,
      output_state_version: versionAfter,
      event_proposal_count: proposals.length
    }
  });
  const finalTrace = buildTrace(
    state,
    publicTrigger,
    trace,
    policy.rules.some((rule) => rule.trigger.trigger_type === "STATE_CONDITION")
      ? "STABLE"
      : "NOT_REQUIRED",
    cycleEvaluations,
    policy.timeline_policy.max_derived_evaluations,
    versionAfter,
    targetTime
  );
  if (finalTrace === undefined) {
    markEngineWorkExceeded(budget, "trace_entries");
    return budgetFailure(state, publicTrigger, policy, trace, budget, cycleEvaluations);
  }

  const success = ClinicalTransitionSuccessSchema.safeParse({
    success: true,
    state_version_before: state.state_version,
    state_version_after: versionAfter,
    clinical_time_before: state.clinical_time,
    clinical_time_after: targetTime,
    state_changed: stateChanged,
    next_state: finalStateValidation.state,
    next_scheduler_state: schedulerState,
    observations: observations.observations,
    event_proposals: proposals,
    trace: finalTrace
  });
  if (!success.success) {
    return {
      success: false,
      issues: sortTransitionIssues(transitionIssuesFromZodError(
        "INVALID_TRANSITION_INPUT",
        "$.result",
        success.error
      )),
      trace: finalTrace
    };
  }
  return success.data;
}

/**
 * Sole production-intended Clinical Engine execution entry point. The policy
 * must be extracted from the authoritative compiled Case Package. The
 * envelope validates binding consistency but is not a client security token.
 */
export function evaluatePinnedClinicalPolicy(input: unknown): ClinicalTransitionResult {
  const parsed = PinnedClinicalEvaluationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: sortTransitionIssues(
        transitionIssuesFromZodError("INVALID_TRANSITION_INPUT", "$", parsed.error)
      )
    };
  }
  return executeParsedRequest(parsed.data);
}
