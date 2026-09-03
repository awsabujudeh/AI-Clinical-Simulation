import { z } from "zod";

import {
  ClinicalEventProposalSchema,
  ClinicalTimeSchema,
  ClinicalTransitionSuccessSchema,
  PatientStateSchema,
  ExecutablePinnedClinicalPolicyEnvelopeSchema,
  PriorCommittedEventFactSchema,
  SchedulerStateSchema,
  SessionClinicalClockSchema,
  TransitionTraceSchema,
  type ClinicalEventProposal,
  type ClinicalTransitionSuccess,
  type PatientState,
  type SchedulerState,
  type SessionClinicalClock
} from "../../../contracts/src/index.ts";
import {
  ENGINE_WORK_LIMITS,
  ClinicalTransitionIssueSchema,
  evaluatePinnedClinicalPolicy,
  sortScheduledItems,
  type ClinicalTransitionFailure
} from "../../../clinical-engine/src/index.ts";

import {
  SessionTimeIssueSchema,
  createSessionTimeIssue,
  sessionTimeIssuesFromZodError,
  type SessionTimeIssue
} from "../clock/session-clock.ts";

export const CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION = "1.0" as const;

export const ClinicalTimeAdvancementSourceSchema = z.enum([
  "CASE_OWNED_DURATION",
  "SAME_TIME_COMMAND_GATE",
  "TRUSTED_TIME_SYNC"
]);
export type ClinicalTimeAdvancementSource = z.infer<
  typeof ClinicalTimeAdvancementSourceSchema
>;

export const ClinicalTimeAdvancementStatusSchema = z.enum([
  "REACHED_TARGET",
  "INTERRUPTED"
]);
export type ClinicalTimeAdvancementStatus = z.infer<
  typeof ClinicalTimeAdvancementStatusSchema
>;

export const ClinicalTimeAdvancementRequestSchema = z.strictObject({
  advancement_schema_version: z.literal(CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION),
  source: ClinicalTimeAdvancementSourceSchema,
  clock: SessionClinicalClockSchema,
  policy: ExecutablePinnedClinicalPolicyEnvelopeSchema,
  state: PatientStateSchema,
  scheduler_state: SchedulerStateSchema,
  prior_event_facts: z.array(PriorCommittedEventFactSchema).max(4096),
  requested_target_clinical_time: ClinicalTimeSchema
});
export type ClinicalTimeAdvancementRequest = z.infer<
  typeof ClinicalTimeAdvancementRequestSchema
>;

const ClinicalEngineFailureSnapshotSchema = z.strictObject({
  success: z.literal(false),
  issues: z.array(ClinicalTransitionIssueSchema),
  trace: TransitionTraceSchema.optional()
});

export const ClinicalTimeAdvancementFailureSchema = z.strictObject({
  success: z.literal(false),
  issues: z.array(SessionTimeIssueSchema).min(1),
  clinical_engine_failure: ClinicalEngineFailureSnapshotSchema.optional()
});
export type ClinicalTimeAdvancementFailure = z.infer<
  typeof ClinicalTimeAdvancementFailureSchema
>;

export const ClinicalTimeAdvancementSuccessSchema = z.strictObject({
  success: z.literal(true),
  issues: z.tuple([]),
  status: ClinicalTimeAdvancementStatusSchema,
  source: ClinicalTimeAdvancementSourceSchema,
  start_clinical_time: ClinicalTimeSchema,
  requested_target_clinical_time: ClinicalTimeSchema,
  reached_clinical_time: ClinicalTimeSchema,
  next_clock: SessionClinicalClockSchema,
  next_state: PatientStateSchema,
  next_scheduler_state: SchedulerStateSchema,
  observations: ClinicalTransitionSuccessSchema.shape.observations,
  event_proposals: z.array(ClinicalEventProposalSchema).max(512),
  interrupting_event_proposals: z.array(ClinicalEventProposalSchema).max(512),
  transitions: z.array(ClinicalTransitionSuccessSchema).min(1).max(257)
});
export type ClinicalTimeAdvancementSuccess = z.infer<
  typeof ClinicalTimeAdvancementSuccessSchema
>;

export type ClinicalTimeAdvancementResult =
  | ClinicalTimeAdvancementFailure
  | ClinicalTimeAdvancementSuccess;

type AdvancementBudget = {
  dueItems: number;
  eventProposals: number;
  ruleConsiderations: number;
  ruleActivations: number;
  effectApplications: number;
  scheduledCreations: number;
  cancellations: number;
  derivedEvaluations: number;
  traceEntries: number;
};

function emptyAdvancementBudget(): AdvancementBudget {
  return {
    dueItems: 0,
    eventProposals: 0,
    ruleConsiderations: 0,
    ruleActivations: 0,
    effectApplications: 0,
    scheduledCreations: 0,
    cancellations: 0,
    derivedEvaluations: 0,
    traceEntries: 0
  };
}

function updateAdvancementBudget(
  budget: AdvancementBudget,
  transition: ClinicalTransitionSuccess
): SessionTimeIssue | undefined {
  for (const entry of transition.trace.entries) {
    budget.traceEntries += 1;
    switch (entry.kind) {
      case "DUE_ITEM_PROCESSED": budget.dueItems += 1; break;
      case "EVENT_PROPOSED": budget.eventProposals += 1; break;
      case "RULE_CONSIDERED": budget.ruleConsiderations += 1; break;
      case "RULE_FIRED": budget.ruleActivations += 1; break;
      case "EFFECT_APPLIED": budget.effectApplications += 1; break;
      case "SCHEDULED_ITEM_CREATED": budget.scheduledCreations += 1; break;
      case "SCHEDULED_ITEM_CANCELLED":
      case "SCHEDULED_ITEM_CANCELLATION_NO_MATCH": budget.cancellations += 1; break;
      case "DERIVED_EVALUATION": budget.derivedEvaluations += 1; break;
      default: break;
    }
  }

  const exceeded = budget.dueItems > ENGINE_WORK_LIMITS.scheduler_causal_depth
    || budget.eventProposals > ENGINE_WORK_LIMITS.event_proposals_created
    || budget.ruleConsiderations > ENGINE_WORK_LIMITS.rules_considered
    || budget.ruleActivations > ENGINE_WORK_LIMITS.rule_activations
    || budget.effectApplications > ENGINE_WORK_LIMITS.effects_attempted
    || budget.scheduledCreations > ENGINE_WORK_LIMITS.scheduled_items_created
    || budget.cancellations > ENGINE_WORK_LIMITS.cancellations_processed
    || budget.derivedEvaluations > ENGINE_WORK_LIMITS.derived_passes
    || budget.traceEntries > ENGINE_WORK_LIMITS.trace_entries;

  return exceeded
    ? createSessionTimeIssue({
        code: "ADVANCEMENT_BUDGET_EXCEEDED",
        path: "$.requested_target_clinical_time",
        message: "Clinical-Time advancement exceeded the inherited Clinical Engine work budget."
      })
    : undefined;
}

function failure(
  issues: readonly SessionTimeIssue[],
  clinicalEngineFailure?: ClinicalTransitionFailure
): ClinicalTimeAdvancementFailure {
  return ClinicalTimeAdvancementFailureSchema.parse({
    success: false,
    issues,
    ...(clinicalEngineFailure === undefined
      ? {}
      : { clinical_engine_failure: clinicalEngineFailure })
  });
}

function engineFailure(result: ClinicalTransitionFailure): ClinicalTimeAdvancementFailure {
  return failure([
    createSessionTimeIssue({
      code: "CLINICAL_ENGINE_FAILURE",
      path: "$.clinical_engine",
      message: "Pinned Clinical Engine due-work processing failed closed."
    })
  ], result);
}

function validateClockStateAlignment(
  clock: SessionClinicalClock,
  state: PatientState,
  targetClinicalTime: number
): SessionTimeIssue[] {
  const issues: SessionTimeIssue[] = [];
  if (clock.clinical_time !== state.clinical_time) {
    issues.push(createSessionTimeIssue({
      code: "CLOCK_STATE_MISMATCH",
      path: "$.clock.clinical_time",
      message: "Session clock and authoritative Patient State must start at the same Clinical Time."
    }));
  }
  if (targetClinicalTime < state.clinical_time) {
    issues.push(createSessionTimeIssue({
      code: "CLINICAL_TIME_REGRESSION",
      path: "$.requested_target_clinical_time",
      message: "Requested Clinical Time cannot precede authoritative Patient State time."
    }));
  }
  if (clock.status === "PAUSED") {
    issues.push(createSessionTimeIssue({
      code: "CLOCK_PAUSED",
      path: "$.clock.status",
      message: "Compressed Clinical-Time advancement cannot run while the Session clock is paused."
    }));
  }
  return issues;
}

/**
 * Pure orchestration over the sole pinned Clinical Engine entry point. It
 * advances only to the next scheduled boundary, then re-reads authoritative
 * scheduler output. This processes newly-created work without duplicating
 * scheduler execution logic and can stop exactly at a Case-owned interrupt.
 */
export function advanceClinicalTime(input: unknown): ClinicalTimeAdvancementResult {
  const parsed = ClinicalTimeAdvancementRequestSchema.safeParse(input);
  if (!parsed.success) {
    return failure(sessionTimeIssuesFromZodError(
      "INVALID_ADVANCEMENT_INPUT",
      parsed.error
    ));
  }

  const request = parsed.data;
  const alignmentIssues = validateClockStateAlignment(
    request.clock,
    request.state,
    request.requested_target_clinical_time
  );
  if (alignmentIssues.length > 0) return failure(alignmentIssues);

  let state = PatientStateSchema.parse(request.state);
  let schedulerState = SchedulerStateSchema.parse(request.scheduler_state);
  const transitions: ClinicalTransitionSuccess[] = [];
  const eventProposals: ClinicalEventProposal[] = [];
  const interruptingEventProposals: ClinicalEventProposal[] = [];
  const interruptTypes = new Set(request.policy.timeline_policy.interrupting_event_types);
  const budget = emptyAdvancementBudget();

  while (true) {
    const nextDue = sortScheduledItems(schedulerState.pending_items).find(
      (item) => item.due_clinical_time <= request.requested_target_clinical_time
    );
    const nextThreshold = request.policy.rules
      .flatMap((rule) => rule.trigger.trigger_type === "CLINICAL_TIME_THRESHOLD"
        ? [rule.trigger.threshold_clinical_time]
        : [])
      .filter((threshold) => threshold > state.clinical_time
        && threshold <= request.requested_target_clinical_time)
      .sort((left, right) => left - right)[0];
    const stepTarget = Math.min(
      nextDue?.due_clinical_time ?? request.requested_target_clinical_time,
      nextThreshold ?? request.requested_target_clinical_time
    );
    const result = evaluatePinnedClinicalPolicy({
      operation: "PROCESS_DUE",
      policy: request.policy,
      state,
      scheduler_state: schedulerState,
      prior_event_facts: request.prior_event_facts,
      target_clinical_time: stepTarget
    });
    if (!result.success) return engineFailure(result);

    const budgetIssue = updateAdvancementBudget(budget, result);
    if (budgetIssue !== undefined) return failure([budgetIssue]);

    transitions.push(result);
    eventProposals.push(...result.event_proposals);
    const stepInterrupts = result.event_proposals.filter(
      (proposal) => interruptTypes.has(proposal.event_type)
    );
    interruptingEventProposals.push(...stepInterrupts);
    state = result.next_state;
    schedulerState = result.next_scheduler_state;

    if (stepInterrupts.length > 0 || stepTarget >= request.requested_target_clinical_time) {
      const status = stepInterrupts.length > 0 ? "INTERRUPTED" : "REACHED_TARGET";
      const lastTransition = transitions.at(-1)!;
      return ClinicalTimeAdvancementSuccessSchema.parse({
        success: true,
        issues: [],
        status,
        source: request.source,
        start_clinical_time: request.state.clinical_time,
        requested_target_clinical_time: request.requested_target_clinical_time,
        reached_clinical_time: state.clinical_time,
        next_clock: {
          ...request.clock,
          clinical_time: state.clinical_time
        },
        next_state: state,
        next_scheduler_state: schedulerState,
        observations: lastTransition.observations,
        event_proposals: eventProposals,
        interrupting_event_proposals: interruptingEventProposals,
        transitions
      });
    }
  }
}

export const DueBeforeExternalCommandRequestSchema = ClinicalTimeAdvancementRequestSchema
  .omit({
    advancement_schema_version: true,
    source: true,
    requested_target_clinical_time: true
  });
export type DueBeforeExternalCommandRequest = z.infer<
  typeof DueBeforeExternalCommandRequestSchema
>;

/**
 * V2-006A boundary only: drains work already due at command time and returns
 * the resulting authoritative context. It does not accept or route a command.
 */
export function drainDueWorkBeforeExternalCommand(
  input: unknown
): ClinicalTimeAdvancementResult {
  const parsed = DueBeforeExternalCommandRequestSchema.safeParse(input);
  if (!parsed.success) {
    return failure(sessionTimeIssuesFromZodError(
      "INVALID_ADVANCEMENT_INPUT",
      parsed.error
    ));
  }

  return advanceClinicalTime({
    advancement_schema_version: CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION,
    source: "SAME_TIME_COMMAND_GATE",
    ...parsed.data,
    requested_target_clinical_time: parsed.data.clock.clinical_time
  });
}
