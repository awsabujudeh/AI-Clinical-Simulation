import { z } from "zod";

import {
  ActionIdSchema,
  CasePackageIdSchema,
  CaseVersionIdSchema,
  ClinicalEffectIdSchema,
  ClinicalTimeSchema,
  ComplicationIdSchema,
  FactIdSchema,
  InterventionIdSchema,
  RuleEffectIdSchema,
  RuleIdSchema,
  ScheduledItemIdSchema,
  ScoringEvidenceRefIdSchema,
  SemanticVersionSchema,
  Sha256DigestSchema,
  SourceIdSchema,
  StateVersionSchema,
  TimingWindowIdSchema
} from "./ids.ts";
import { EventTypeSchema } from "./events.ts";
import { JsonObjectSchema, JsonValueSchema } from "./json.ts";
import {
  CaseControlledValueSchema,
  PainStateSchema,
  PatientStateSchema
} from "./patient-state.ts";
import {
  ObservationProjectionDefinitionSchema,
  ObservationProjectionSchema
} from "./observations.ts";

export const RULE_SCHEMA_VERSION = "1.0" as const;
export const SCHEDULER_SCHEMA_VERSION = "1.0" as const;
export const CLINICAL_EVENT_PROPOSAL_SCHEMA_VERSION = "1.0" as const;
export const TRANSITION_TRACE_SCHEMA_VERSION = "1.0" as const;
export const PINNED_CLINICAL_POLICY_SCHEMA_VERSION = "1.0" as const;

export const StateScalarTargetSchema = z.enum([
  "clinical_phase",
  "hemodynamic_state",
  "cardiac_rhythm",
  "perfusion",
  "respiratory_state",
  "oxygenation",
  "consciousness",
  "neurologic_state",
  "temperature_state",
  "metabolic_state"
]);
export type StateScalarTarget = z.infer<typeof StateScalarTargetSchema>;

export const ConflictPolicySchema = z.enum([
  "REPLACE",
  "BLOCK",
  "HIGHEST_PRIORITY"
]);
export type ConflictPolicy = z.infer<typeof ConflictPolicySchema>;

export const RulePrioritySchema = z.number().int().min(-1000).max(1000);
export const MaximumDerivedEvaluationsSchema = z.number().int().min(1).max(32);

const StateValueConditionShape = {
  target: StateScalarTargetSchema,
  value: CaseControlledValueSchema
};

export const RuleConditionSchema = z.discriminatedUnion("condition_type", [
  z.strictObject({
    condition_type: z.literal("STATE_EQUALS"),
    ...StateValueConditionShape
  }),
  z.strictObject({
    condition_type: z.literal("STATE_NOT_EQUALS"),
    ...StateValueConditionShape
  }),
  z.strictObject({
    condition_type: z.literal("INTERVENTION_PRESENT"),
    intervention_id: InterventionIdSchema
  }),
  z.strictObject({
    condition_type: z.literal("INTERVENTION_ABSENT"),
    intervention_id: InterventionIdSchema
  }),
  z.strictObject({
    condition_type: z.literal("COMPLICATION_PRESENT"),
    complication_id: ComplicationIdSchema
  }),
  z.strictObject({
    condition_type: z.literal("COMPLICATION_ABSENT"),
    complication_id: ComplicationIdSchema
  }),
  z.strictObject({
    condition_type: z.literal("OUTCOME_FLAG_PRESENT"),
    outcome_flag: CaseControlledValueSchema
  }),
  z.strictObject({
    condition_type: z.literal("OUTCOME_FLAG_ABSENT"),
    outcome_flag: CaseControlledValueSchema
  }),
  z.strictObject({
    condition_type: z.literal("CLINICAL_TIME_COMPARE"),
    operator: z.enum(["LT", "LTE", "EQ", "GTE", "GT"]),
    clinical_time: ClinicalTimeSchema
  }),
  z.strictObject({
    condition_type: z.literal("TRIGGER_EVENT_TYPE"),
    event_type: EventTypeSchema
  }),
  z.strictObject({
    condition_type: z.literal("TRIGGER_ACTION_ID"),
    action_id: ActionIdSchema
  }),
  z.strictObject({
    condition_type: z.literal("PRIOR_EVENT_OCCURRED"),
    event_type: EventTypeSchema,
    action_id: ActionIdSchema.optional()
  }),
  z.strictObject({
    condition_type: z.literal("CASE_FACT_PRESENT"),
    fact_id: FactIdSchema
  })
]);
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

export const CommittedEventRuleTriggerSchema = z.strictObject({
  trigger_type: z.literal("COMMITTED_EVENT"),
  event_type: EventTypeSchema,
  action_id: ActionIdSchema.optional()
});

export const ClinicalTimeRuleTriggerSchema = z.strictObject({
  trigger_type: z.literal("CLINICAL_TIME_THRESHOLD"),
  threshold_clinical_time: ClinicalTimeSchema
});

export const ScheduledItemRuleTriggerSchema = z.strictObject({
  trigger_type: z.literal("SCHEDULED_ITEM"),
  scheduled_item_id: ScheduledItemIdSchema.optional(),
  category: CaseControlledValueSchema.optional()
}).superRefine((value, context) => {
  if (value.scheduled_item_id === undefined && value.category === undefined) {
    context.addIssue({
      code: "custom",
      message: "A scheduled-item trigger requires an item identity or category"
    });
  }
});

export const StateConditionRuleTriggerSchema = z.strictObject({
  trigger_type: z.literal("STATE_CONDITION"),
  conditions: z.array(RuleConditionSchema).min(1).max(16)
});

export const RuleTriggerSchema = z.union([
  CommittedEventRuleTriggerSchema,
  ClinicalTimeRuleTriggerSchema,
  ScheduledItemRuleTriggerSchema,
  StateConditionRuleTriggerSchema
]);
export type RuleTrigger = z.infer<typeof RuleTriggerSchema>;

export const EventProposalDefinitionSchema = z.strictObject({
  event_type: EventTypeSchema,
  action_id: ActionIdSchema.optional(),
  parameters: JsonObjectSchema,
  payload: JsonValueSchema,
  clinical_effect_ids: z.array(ClinicalEffectIdSchema).max(32)
});
export type EventProposalDefinition = z.infer<typeof EventProposalDefinitionSchema>;

const EffectBaseShape = {
  effect_id: RuleEffectIdSchema
};

export const SetStateEffectSchema = z.strictObject({
  effect_type: z.literal("SET_STATE"),
  ...EffectBaseShape,
  target: StateScalarTargetSchema,
  value: CaseControlledValueSchema
});

export const SetPainStateEffectSchema = z.strictObject({
  effect_type: z.literal("SET_PAIN_STATE"),
  ...EffectBaseShape,
  value: PainStateSchema
});

export const AddInterventionEffectSchema = z.strictObject({
  effect_type: z.literal("ADD_INTERVENTION"),
  ...EffectBaseShape,
  intervention_id: InterventionIdSchema,
  intervention_type: CaseControlledValueSchema,
  parameters: JsonObjectSchema
});

export const RemoveInterventionEffectSchema = z.strictObject({
  effect_type: z.literal("REMOVE_INTERVENTION"),
  ...EffectBaseShape,
  intervention_id: InterventionIdSchema
});

export const AddComplicationEffectSchema = z.strictObject({
  effect_type: z.literal("ADD_COMPLICATION"),
  ...EffectBaseShape,
  complication_id: ComplicationIdSchema,
  complication_type: CaseControlledValueSchema,
  attributes: JsonObjectSchema
});

export const RemoveComplicationEffectSchema = z.strictObject({
  effect_type: z.literal("REMOVE_COMPLICATION"),
  ...EffectBaseShape,
  complication_id: ComplicationIdSchema
});

export const AddOutcomeFlagEffectSchema = z.strictObject({
  effect_type: z.literal("ADD_OUTCOME_FLAG"),
  ...EffectBaseShape,
  outcome_flag: CaseControlledValueSchema
});

export const RemoveOutcomeFlagEffectSchema = z.strictObject({
  effect_type: z.literal("REMOVE_OUTCOME_FLAG"),
  ...EffectBaseShape,
  outcome_flag: CaseControlledValueSchema
});

export const ImmediateStateEffectSchema = z.discriminatedUnion("effect_type", [
  SetStateEffectSchema,
  SetPainStateEffectSchema,
  AddInterventionEffectSchema,
  RemoveInterventionEffectSchema,
  AddComplicationEffectSchema,
  RemoveComplicationEffectSchema,
  AddOutcomeFlagEffectSchema,
  RemoveOutcomeFlagEffectSchema
]);
export type ImmediateStateEffect = z.infer<typeof ImmediateStateEffectSchema>;

const ScheduledEffectPayloadShape = {
  scheduled_item_id: ScheduledItemIdSchema,
  category: CaseControlledValueSchema,
  priority: RulePrioritySchema,
  conflict_policy: ConflictPolicySchema,
  effects: z.array(ImmediateStateEffectSchema).max(32),
  emitted_events: z.array(EventProposalDefinitionSchema).max(16)
};

export const ScheduleRelativeEffectSchema = z.strictObject({
  effect_type: z.literal("SCHEDULE_RELATIVE"),
  ...EffectBaseShape,
  ...ScheduledEffectPayloadShape,
  delay_clinical_seconds: z.number().finite().positive()
});

export const ScheduleAbsoluteEffectSchema = z.strictObject({
  effect_type: z.literal("SCHEDULE_ABSOLUTE"),
  ...EffectBaseShape,
  ...ScheduledEffectPayloadShape,
  due_clinical_time: ClinicalTimeSchema
});

export const CancellationSelectorSchema = z.discriminatedUnion("selector_type", [
  z.strictObject({
    selector_type: z.literal("SCHEDULED_ITEM_ID"),
    scheduled_item_id: ScheduledItemIdSchema
  }),
  z.strictObject({
    selector_type: z.literal("CATEGORY"),
    category: CaseControlledValueSchema
  })
]);
export type CancellationSelector = z.infer<typeof CancellationSelectorSchema>;

export const CancelScheduledEffectSchema = z.strictObject({
  effect_type: z.literal("CANCEL_SCHEDULED"),
  ...EffectBaseShape,
  selector: CancellationSelectorSchema
});

export const RuleEffectSchema = z.union([
  ImmediateStateEffectSchema,
  ScheduleRelativeEffectSchema,
  ScheduleAbsoluteEffectSchema,
  CancelScheduledEffectSchema
]);
export type RuleEffect = z.infer<typeof RuleEffectSchema>;

export const TransitionRuleSchema = z.strictObject({
  rule_schema_version: z.literal(RULE_SCHEMA_VERSION),
  rule_id: RuleIdSchema,
  rule_version: SemanticVersionSchema,
  trigger: RuleTriggerSchema,
  preconditions: z.array(RuleConditionSchema).max(32),
  exclusions: z.array(RuleConditionSchema).max(32),
  priority: RulePrioritySchema,
  conflict_policy: ConflictPolicySchema,
  effects: z.array(RuleEffectSchema).max(32),
  emitted_events: z.array(EventProposalDefinitionSchema).max(16),
  referenced_action_ids: z.array(ActionIdSchema).max(32),
  referenced_rule_ids: z.array(RuleIdSchema).max(32),
  referenced_fact_ids: z.array(FactIdSchema).max(32),
  source_ids: z.array(SourceIdSchema).min(1).max(32),
  timing_window_ids: z.array(TimingWindowIdSchema).max(16),
  scoring_evidence_refs: z.array(ScoringEvidenceRefIdSchema).max(32)
});
export type TransitionRule = z.infer<typeof TransitionRuleSchema>;

export const ScheduledItemSchema = z.strictObject({
  scheduler_schema_version: z.literal(SCHEDULER_SCHEMA_VERSION),
  scheduled_item_id: ScheduledItemIdSchema,
  originating_rule_id: RuleIdSchema,
  category: CaseControlledValueSchema,
  due_clinical_time: ClinicalTimeSchema,
  priority: RulePrioritySchema,
  conflict_policy: ConflictPolicySchema,
  effects: z.array(ImmediateStateEffectSchema).max(32),
  emitted_events: z.array(EventProposalDefinitionSchema).max(16)
});
export type ScheduledItem = z.infer<typeof ScheduledItemSchema>;

export const SchedulerStateSchema = z.strictObject({
  scheduler_schema_version: z.literal(SCHEDULER_SCHEMA_VERSION),
  pending_items: z.array(ScheduledItemSchema).max(1024)
});
export type SchedulerState = z.infer<typeof SchedulerStateSchema>;

export const PinnedClinicalPolicyEnvelopeSchema = z.strictObject({
  policy_schema_version: z.literal(PINNED_CLINICAL_POLICY_SCHEMA_VERSION),
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  package_hash: Sha256DigestSchema,
  review_subject_hash: Sha256DigestSchema,
  rule_schema_version: z.literal(RULE_SCHEMA_VERSION),
  rules: z.array(TransitionRuleSchema).max(512),
  timeline_policy: z.strictObject({
    scheduler_schema_version: z.literal(SCHEDULER_SCHEMA_VERSION),
    max_derived_evaluations: MaximumDerivedEvaluationsSchema,
    initial_scheduled_items: z.array(ScheduledItemSchema).max(128)
  }),
  observation_projection: ObservationProjectionDefinitionSchema,
  approved_case_fact_ids: z.array(FactIdSchema).max(512),
  module_hashes: z.strictObject({
    rules: Sha256DigestSchema,
    timeline_policy: Sha256DigestSchema,
    initial_state: Sha256DigestSchema,
    clinical_facts: Sha256DigestSchema
  })
}).superRefine((value, context) => {
  const factIds = new Set<string>();
  for (const factId of value.approved_case_fact_ids) {
    if (factIds.has(factId)) {
      context.addIssue({
        code: "custom",
        path: ["approved_case_fact_ids"],
        message: "Pinned Case Fact identities must be unique"
      });
    }
    factIds.add(factId);
  }
});
export type PinnedClinicalPolicyEnvelope = z.infer<
  typeof PinnedClinicalPolicyEnvelopeSchema
>;

export const PriorCommittedEventFactSchema = z.strictObject({
  event_type: EventTypeSchema,
  action_id: ActionIdSchema.optional(),
  clinical_time: ClinicalTimeSchema
});
export type PriorCommittedEventFact = z.infer<typeof PriorCommittedEventFactSchema>;

export const ClinicalEvaluationTriggerSchema = z.discriminatedUnion("trigger_type", [
  z.strictObject({
    trigger_type: z.literal("COMMITTED_EVENT"),
    event_type: EventTypeSchema,
    action_id: ActionIdSchema.optional()
  }),
  z.strictObject({
    trigger_type: z.literal("CLINICAL_TIME"),
    target_clinical_time: ClinicalTimeSchema
  }),
  z.strictObject({
    trigger_type: z.literal("SCHEDULED_ITEM"),
    scheduled_item_id: ScheduledItemIdSchema,
    category: CaseControlledValueSchema
  }),
  z.strictObject({
    trigger_type: z.literal("STATE_CONDITION")
  })
]);
export type ClinicalEvaluationTrigger = z.infer<typeof ClinicalEvaluationTriggerSchema>;

export const ClinicalEventProposalSchema = z.strictObject({
  proposal_schema_version: z.literal(CLINICAL_EVENT_PROPOSAL_SCHEMA_VERSION),
  event_type: EventTypeSchema,
  originating_rule_id: RuleIdSchema,
  action_id: ActionIdSchema.optional(),
  clinical_effect_ids: z.array(ClinicalEffectIdSchema).max(32),
  parameters: JsonObjectSchema,
  payload: JsonValueSchema,
  proposed_clinical_time: ClinicalTimeSchema
});
export type ClinicalEventProposal = z.infer<typeof ClinicalEventProposalSchema>;

export const TransitionTraceEntryKindSchema = z.enum([
  "EVALUATION_STARTED",
  "RULE_CONSIDERED",
  "RULE_INELIGIBLE",
  "RULE_EXCLUDED",
  "RULE_FIRED",
  "EFFECT_APPLIED",
  "STATE_CHANNEL_CHANGED",
  "SCHEDULED_ITEM_CREATED",
  "SCHEDULED_ITEM_CANCELLED",
  "SCHEDULED_ITEM_CANCELLATION_NO_MATCH",
  "DUE_ITEM_PROCESSED",
  "CONFLICT_RESOLVED",
  "CONFLICT_DETECTED",
  "EVENT_PROPOSED",
  "DERIVED_EVALUATION",
  "CYCLE_GUARD_FAILED",
  "BUDGET_EXCEEDED",
  "SCHEDULER_LIVENESS_FAILURE",
  "EFFECT_REJECTED",
  "EVALUATION_COMPLETED"
]);
export type TransitionTraceEntryKind = z.infer<typeof TransitionTraceEntryKindSchema>;

export const TransitionTraceEntrySchema = z.strictObject({
  trace_index: z.number().int().nonnegative(),
  kind: TransitionTraceEntryKindSchema,
  clinical_time: ClinicalTimeSchema,
  rule_id: RuleIdSchema.optional(),
  effect_id: RuleEffectIdSchema.optional(),
  scheduled_item_id: ScheduledItemIdSchema.optional(),
  state_channel: z.string().min(1).max(160).optional(),
  detail_code: z.string().min(1).max(160).regex(
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u,
    "Expected a stable trace detail code"
  ),
  data: JsonObjectSchema
});
export type TransitionTraceEntry = z.infer<typeof TransitionTraceEntrySchema>;

export const TransitionTraceSchema = z.strictObject({
  trace_schema_version: z.literal(TRANSITION_TRACE_SCHEMA_VERSION),
  input_state_version: StateVersionSchema,
  input_clinical_time: ClinicalTimeSchema,
  trigger: ClinicalEvaluationTriggerSchema,
  entries: z.array(TransitionTraceEntrySchema).max(4096),
  cycle_guard: z.strictObject({
    status: z.enum(["STABLE", "NOT_REQUIRED", "FAILED"]),
    evaluations: z.number().int().nonnegative(),
    maximum_evaluations: MaximumDerivedEvaluationsSchema
  }),
  output_state_version: StateVersionSchema,
  output_clinical_time: ClinicalTimeSchema
});
export type TransitionTrace = z.infer<typeof TransitionTraceSchema>;

export const ClinicalTransitionSuccessSchema = z.strictObject({
  success: z.literal(true),
  state_version_before: StateVersionSchema,
  state_version_after: StateVersionSchema,
  clinical_time_before: ClinicalTimeSchema,
  clinical_time_after: ClinicalTimeSchema,
  state_changed: z.boolean(),
  next_state: PatientStateSchema,
  next_scheduler_state: SchedulerStateSchema,
  observations: ObservationProjectionSchema,
  event_proposals: z.array(ClinicalEventProposalSchema).max(512),
  trace: TransitionTraceSchema
});
export type ClinicalTransitionSuccess = z.infer<typeof ClinicalTransitionSuccessSchema>;
