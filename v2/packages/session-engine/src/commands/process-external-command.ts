import { z } from "zod";

import {
  CanonicalEventEnvelopeSchema,
  PriorCommittedEventFactSchema,
  RealUtcTimeSchema,
  SessionClinicalClockSchema,
  type ClinicalEventProposal,
  type HashAdapter,
  type PriorCommittedEventFact
} from "../../../contracts/src/index.ts";
import {
  ClinicalTransitionIssueSchema,
  evaluatePinnedClinicalPolicy,
  type ClinicalTransitionFailure
} from "../../../clinical-engine/src/index.ts";

import {
  fingerprintExternalLearnerCommand,
  type ExternalLearnerCommandEnvelope
} from "./external-command.ts";
import {
  PendingSessionEventSchema,
  commitPendingSessionEvents,
  type EventIdFactory,
  type PendingSessionEvent
} from "../events/commit-events.ts";
import {
  CommittedCommandReplayRecordSchema,
  InMemorySessionAggregateSchema,
  SessionEventSequenceRangeSchema,
  validateInMemorySessionAggregate,
  type InMemorySessionAggregate
} from "../session/in-memory-session.ts";
import {
  drainDueWorkBeforeExternalCommand,
  type ClinicalTimeAdvancementSuccess
} from "../time/advance-clinical-time.ts";
import {
  PinnedSessionActionDefinitionSchema,
  type PinnedSessionActionDefinition
} from "../context/pinned-session-case.ts";
import {
  createSessionCommandIssue,
  SessionCommandIssueSchema,
  sortSessionCommandIssues,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const SESSION_COMMAND_RESULT_SCHEMA_VERSION = "1.0" as const;
const MAX_COMMAND_CLOSURE_PASSES = 32;
const MAX_COMMAND_EVENT_PROPOSALS = 512;
const MAX_PRIOR_EVENT_FACTS = 4096;

export const SessionCommandFailureSchema = z.strictObject({
  success: z.literal(false),
  issues: z.array(SessionCommandIssueSchema).min(1),
  clinical_engine_failure: z.strictObject({
    issues: z.array(ClinicalTransitionIssueSchema).min(1)
  }).optional()
});

export const SessionCommandSuccessSchema = z.strictObject({
  success: z.literal(true),
  result_schema_version: z.literal(SESSION_COMMAND_RESULT_SCHEMA_VERSION),
  issues: z.tuple([]),
  status: z.enum(["COMMITTED", "REPLAYED", "INTERRUPTED_BEFORE_COMMAND"]),
  command_executed: z.boolean(),
  replayed: z.boolean(),
  idempotency_recorded: z.boolean(),
  authoritative_session: InMemorySessionAggregateSchema,
  committed_events: z.array(CanonicalEventEnvelopeSchema).min(1).max(512),
  interrupting_events: z.array(CanonicalEventEnvelopeSchema).max(512),
  result_event_range: SessionEventSequenceRangeSchema,
  resulting_clinical_time: InMemorySessionAggregateSchema.shape.patient_state.shape.clinical_time
}).superRefine((value, context) => {
  if (value.status === "INTERRUPTED_BEFORE_COMMAND"
    && (value.command_executed || value.replayed || value.idempotency_recorded)) {
    context.addIssue({
      code: "custom",
      message: "Pre-command interrupt cannot claim learner command execution or replay."
    });
  }
  if (value.status === "REPLAYED" && (!value.command_executed || !value.replayed)) {
    context.addIssue({
      code: "custom",
      message: "Replay result must identify the previously executed command."
    });
  }
  if (value.status === "COMMITTED" && (!value.command_executed || value.replayed)) {
    context.addIssue({
      code: "custom",
      message: "Committed result must identify one newly executed learner command."
    });
  }
});
export type SessionCommandSuccess = z.infer<typeof SessionCommandSuccessSchema>;

export type SessionCommandFailure = z.infer<typeof SessionCommandFailureSchema>;
export type SessionCommandResult = SessionCommandFailure | SessionCommandSuccess;

export type SessionCommandDependencies = Readonly<{
  hash_adapter: HashAdapter;
  event_id_factory: EventIdFactory;
  real_time_utc: unknown;
  /** Authoritative state version observed before Coordinator time synchronization. */
  expected_state_version_at_intake?: number;
}>;

type DueSettlement =
  | {
      success: true;
      status: "REACHED_TARGET" | "INTERRUPTED";
      next_clock: ClinicalTimeAdvancementSuccess["next_clock"];
      next_state: ClinicalTimeAdvancementSuccess["next_state"];
      next_scheduler_state: ClinicalTimeAdvancementSuccess["next_scheduler_state"];
      event_proposals: ClinicalEventProposal[];
      interrupting_event_proposals: ClinicalEventProposal[];
      prior_event_facts: PriorCommittedEventFact[];
    }
  | {
      success: false;
      issues: SessionCommandIssue[];
      clinical_engine_failure?: ClinicalTransitionFailure;
    };

function failure(
  issues: readonly SessionCommandIssue[],
  clinicalEngineFailure?: ClinicalTransitionFailure
): SessionCommandFailure {
  const value = {
    success: false as const,
    issues: sortSessionCommandIssues(issues),
    ...(clinicalEngineFailure === undefined
      ? {}
      : { clinical_engine_failure: { issues: clinicalEngineFailure.issues } })
  };
  return SessionCommandFailureSchema.parse(value);
}

function eventFactsFromCommittedSession(
  session: InMemorySessionAggregate
): PriorCommittedEventFact[] {
  return session.committed_events.map((event) => PriorCommittedEventFactSchema.parse({
    event_type: event.event_type,
    ...(event.action_id === undefined ? {} : { action_id: event.action_id }),
    clinical_time: event.clinical_time
  }));
}

function eventFactsFromProposals(
  proposals: readonly ClinicalEventProposal[]
): PriorCommittedEventFact[] {
  return proposals.map((proposal) => PriorCommittedEventFactSchema.parse({
    event_type: proposal.event_type,
    ...(proposal.action_id === undefined ? {} : { action_id: proposal.action_id }),
    clinical_time: proposal.proposed_clinical_time
  }));
}

function commandEventFact(
  command: ExternalLearnerCommandEnvelope,
  action: PinnedSessionActionDefinition,
  clinicalTime: number
): PriorCommittedEventFact {
  return PriorCommittedEventFactSchema.parse({
    event_type: action.execution_event_type,
    action_id: command.action_request.action_id,
    clinical_time: clinicalTime
  });
}

function hasDueWork(
  scheduler: InMemorySessionAggregate["scheduler_state"],
  clinicalTime: number
): boolean {
  return scheduler.pending_items.some((item) => item.due_clinical_time <= clinicalTime);
}

function mapDueFailure(result: ReturnType<typeof drainDueWorkBeforeExternalCommand>): DueSettlement {
  if (result.success) throw new Error("Expected a due-work failure.");
  return {
    success: false,
    issues: result.issues.map((issue) => createSessionCommandIssue({
      code: "DUE_WORK_FAILED",
      path: issue.path,
      message: issue.message
    })),
    ...(result.clinical_engine_failure === undefined
      ? {}
      : { clinical_engine_failure: result.clinical_engine_failure })
  };
}

function settleDueClosure(input: {
  clock: InMemorySessionAggregate["clinical_clock"];
  state: InMemorySessionAggregate["patient_state"];
  scheduler_state: InMemorySessionAggregate["scheduler_state"];
  policy: InMemorySessionAggregate["pinned_case"]["clinical_policy"];
  prior_event_facts: PriorCommittedEventFact[];
  run_at_least_once: boolean;
}): DueSettlement {
  let clock = input.clock;
  let state = input.state;
  let scheduler = input.scheduler_state;
  let priorFacts = [...input.prior_event_facts];
  const proposals: ClinicalEventProposal[] = [];
  const interrupts: ClinicalEventProposal[] = [];
  let pass = 0;

  while ((pass === 0 && input.run_at_least_once)
    || hasDueWork(scheduler, clock.clinical_time)) {
    if (pass >= MAX_COMMAND_CLOSURE_PASSES) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "COMMAND_WORK_BUDGET_EXCEEDED",
          path: "$.session.scheduler_state",
          message: "Same-time due-work closure exceeded the Session command budget."
        })]
      };
    }
    const result = drainDueWorkBeforeExternalCommand({
      clock,
      policy: input.policy,
      state,
      scheduler_state: scheduler,
      prior_event_facts: priorFacts
    });
    if (!result.success) return mapDueFailure(result);

    pass += 1;
    proposals.push(...result.event_proposals);
    interrupts.push(...result.interrupting_event_proposals);
    if (proposals.length > MAX_COMMAND_EVENT_PROPOSALS) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "COMMAND_WORK_BUDGET_EXCEEDED",
          path: "$.session.event_proposals",
          message: "Due-work event proposals exceeded the Session command budget."
        })]
      };
    }
    const nextFacts = eventFactsFromProposals(result.event_proposals);
    if (priorFacts.length + nextFacts.length > MAX_PRIOR_EVENT_FACTS) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "COMMAND_WORK_BUDGET_EXCEEDED",
          path: "$.session.committed_events",
          message: "Relevant prior-event facts exceeded the Session command budget."
        })]
      };
    }
    priorFacts = [...priorFacts, ...nextFacts];
    clock = result.next_clock;
    state = result.next_state;
    scheduler = result.next_scheduler_state;
    if (result.status === "INTERRUPTED") {
      return {
        success: true,
        status: "INTERRUPTED",
        next_clock: clock,
        next_state: state,
        next_scheduler_state: scheduler,
        event_proposals: proposals,
        interrupting_event_proposals: interrupts,
        prior_event_facts: priorFacts
      };
    }
  }

  return {
    success: true,
    status: "REACHED_TARGET",
    next_clock: clock,
    next_state: state,
    next_scheduler_state: scheduler,
    event_proposals: proposals,
    interrupting_event_proposals: interrupts,
    prior_event_facts: priorFacts
  };
}

function matchesExpectedPinnedCase(
  command: ExternalLearnerCommandEnvelope,
  session: InMemorySessionAggregate
): SessionCommandIssue[] {
  const fields = [
    ["case_package_id", command.expected_case.case_package_id, session.pinned_case.case_package_id],
    ["case_version_id", command.expected_case.case_version_id, session.pinned_case.case_version_id],
    ["case_version", command.expected_case.case_version, session.pinned_case.case_version],
    ["execution_authority", command.expected_case.execution_authority, session.pinned_case.execution_authority]
  ] as const;
  const issues = fields
    .filter(([, expected, actual]) => expected !== actual)
    .map(([field]) => createSessionCommandIssue({
      code: "PINNED_CASE_MISMATCH",
      path: `$.command.expected_case.${field}`,
      message: `Command ${field} does not match the immutable pinned Session Case.`
    }));
  if (
    command.expected_case.execution_authority === "PUBLISHED_PRODUCTION"
    && session.pinned_case.execution_authority === "PUBLISHED_PRODUCTION"
    && command.expected_case.package_hash !== session.pinned_case.package_hash
  ) {
    issues.push(createSessionCommandIssue({
      code: "PINNED_CASE_MISMATCH",
      path: "$.command.expected_case.package_hash",
      message: "Command package hash does not match the immutable pinned production Case."
    }));
  }
  if (
    command.expected_case.execution_authority === "REVIEW_ONLY"
    && session.pinned_case.execution_authority === "REVIEW_ONLY"
    && command.expected_case.review_execution_hash !== session.pinned_case.review_execution_hash
  ) {
    issues.push(createSessionCommandIssue({
      code: "PINNED_CASE_MISMATCH",
      path: "$.command.expected_case.review_execution_hash",
      message: "Command review hash does not match the immutable pinned review artifact."
    }));
  }
  return issues;
}

function parameterMatchesType(
  value: unknown,
  type: PinnedSessionActionDefinition["parameter_definitions"][number]["value_type"]
): boolean {
  switch (type) {
    case "STRING": return typeof value === "string";
    case "NUMBER": return typeof value === "number" && Number.isFinite(value);
    case "INTEGER": return typeof value === "number" && Number.isInteger(value);
    case "BOOLEAN": return typeof value === "boolean";
    case "CODE": return typeof value === "string";
  }
}

function validateActionRequest(input: {
  action: PinnedSessionActionDefinition;
  command: ExternalLearnerCommandEnvelope;
  prior_event_facts: readonly PriorCommittedEventFact[];
}): SessionCommandIssue[] {
  const { action, command, prior_event_facts: priorFacts } = input;
  const issues: SessionCommandIssue[] = [];
  if (action.confirmation_policy !== "NONE") {
    issues.push(createSessionCommandIssue({
      code: "ACTION_CONFIRMATION_REQUIRED",
      path: "$.command.action_request.action_id",
      related_id: action.action_id,
      message: "This action requires the separate confirmation flow before execution."
    }));
  }
  if (action.repeat_policy === "CASE_DEFINED") {
    issues.push(createSessionCommandIssue({
      code: "ACTION_POLICY_UNSUPPORTED",
      path: "$.session.pinned_case.action_catalogue.repeat_policy",
      related_id: action.action_id,
      message: "Case-defined repeat policy cannot be proven by this command boundary."
    }));
  }
  if (action.repeat_policy === "NOT_REPEATABLE"
    && priorFacts.some((event) => event.action_id === action.action_id)) {
    issues.push(createSessionCommandIssue({
      code: "ACTION_NOT_REPEATABLE",
      path: "$.command.action_request.action_id",
      related_id: action.action_id,
      message: "The pinned action catalogue does not allow this action to repeat."
    }));
  }
  for (const prerequisite of action.prerequisite_action_ids) {
    if (!priorFacts.some((event) => event.action_id === prerequisite)) {
      issues.push(createSessionCommandIssue({
        code: "ACTION_PREREQUISITE_UNMET",
        path: "$.command.action_request.action_id",
        related_id: prerequisite,
        message: "A pinned action prerequisite has not occurred in the authoritative timeline."
      }));
    }
  }

  const definitions = new Map<string, PinnedSessionActionDefinition["parameter_definitions"][number]>(
    action.parameter_definitions.map((definition) => [
    definition.parameter_code,
    definition
    ])
  );
  const parameters = command.action_request.parameters;
  for (const key of Object.keys(parameters).sort()) {
    if (!definitions.has(key)) {
      issues.push(createSessionCommandIssue({
        code: "ACTION_PARAMETER_INVALID",
        path: `$.command.action_request.parameters.${key}`,
        related_id: key,
        message: "Parameter is not declared by the pinned action definition."
      }));
    }
  }
  for (const definition of action.parameter_definitions) {
    const hasValue = Object.hasOwn(parameters, definition.parameter_code);
    if (!hasValue) {
      if (definition.required) {
        issues.push(createSessionCommandIssue({
          code: "ACTION_PARAMETER_INVALID",
          path: `$.command.action_request.parameters.${definition.parameter_code}`,
          related_id: definition.parameter_code,
          message: "Required action parameter is missing."
        }));
      }
      continue;
    }
    const value = parameters[definition.parameter_code];
    if (!parameterMatchesType(value, definition.value_type)) {
      issues.push(createSessionCommandIssue({
        code: "ACTION_PARAMETER_INVALID",
        path: `$.command.action_request.parameters.${definition.parameter_code}`,
        related_id: definition.parameter_code,
        message: `Action parameter must have value type ${definition.value_type}.`
      }));
      continue;
    }
    if (typeof value === "number") {
      if (definition.minimum !== undefined && value < definition.minimum) {
        issues.push(createSessionCommandIssue({
          code: "ACTION_PARAMETER_INVALID",
          path: `$.command.action_request.parameters.${definition.parameter_code}`,
          related_id: definition.parameter_code,
          message: "Action parameter is below its pinned minimum."
        }));
      }
      if (definition.maximum !== undefined && value > definition.maximum) {
        issues.push(createSessionCommandIssue({
          code: "ACTION_PARAMETER_INVALID",
          path: `$.command.action_request.parameters.${definition.parameter_code}`,
          related_id: definition.parameter_code,
          message: "Action parameter exceeds its pinned maximum."
        }));
      }
    }
    if (definition.allowed_codes !== undefined
      && typeof value === "string"
      && !definition.allowed_codes.some((code) => code === value)) {
      issues.push(createSessionCommandIssue({
        code: "ACTION_PARAMETER_INVALID",
        path: `$.command.action_request.parameters.${definition.parameter_code}`,
        related_id: definition.parameter_code,
        message: "Action parameter code is not allowed by the pinned definition."
      }));
    }
  }
  return sortSessionCommandIssues(issues);
}

function proposalToPendingEvent(input: {
  proposal: ClinicalEventProposal;
  command: ExternalLearnerCommandEnvelope;
  state_version_before: number;
  state_version_after: number;
  causation_event_index?: number;
  command_related: boolean;
}): PendingSessionEvent {
  return PendingSessionEventSchema.parse({
    event_origin: "CLINICAL_ENGINE",
    clinical_time: input.proposal.proposed_clinical_time,
    actor_type: "SYSTEM",
    source: "ENGINE",
    correlation_id: input.command.correlation_id,
    ...(input.causation_event_index === undefined
      ? {}
      : { causation_event_index: input.causation_event_index }),
    ...(input.command_related
      ? { action_request_id: input.command.action_request.action_request_id }
      : {}),
    ...(input.proposal.action_id === undefined
      ? {}
      : { action_id: input.proposal.action_id }),
    rule_id: input.proposal.originating_rule_id,
    event_type: input.proposal.event_type,
    parameters: input.proposal.parameters,
    payload: input.proposal.payload,
    clinical_effect_ids: input.proposal.clinical_effect_ids,
    state_version_before: input.state_version_before,
    state_version_after: input.state_version_after,
    idempotency_key: input.command.action_request.idempotency_key,
    request_id: input.command.request_id
  });
}

function eventRange(events: readonly z.infer<typeof CanonicalEventEnvelopeSchema>[]) {
  return SessionEventSequenceRangeSchema.parse({
    first_sequence_no: events[0]!.sequence_no,
    last_sequence_no: events.at(-1)!.sequence_no
  });
}

function commitInterruptedDueSettlement(input: {
  session: InMemorySessionAggregate;
  command: ExternalLearnerCommandEnvelope;
  due: Extract<DueSettlement, { success: true }>;
  dependencies: SessionCommandDependencies;
}): SessionCommandResult {
  const pending = input.due.event_proposals.map((proposal) => proposalToPendingEvent({
    proposal,
    command: input.command,
    state_version_before: input.session.patient_state.state_version,
    state_version_after: input.due.next_state.state_version,
    command_related: false
  }));
  const committed = commitPendingSessionEvents({
    session_id: input.session.session_id,
    case_version: input.session.pinned_case.case_version,
    first_sequence_no: input.session.next_sequence_no,
    real_time_utc: input.dependencies.real_time_utc,
    pending_events: pending,
    event_id_factory: input.dependencies.event_id_factory
  });
  if (!committed.success) return failure(committed.issues);

  const nextSession = InMemorySessionAggregateSchema.safeParse({
    ...input.session,
    patient_state: input.due.next_state,
    scheduler_state: input.due.next_scheduler_state,
    clinical_clock: input.due.next_clock,
    committed_events: [...input.session.committed_events, ...committed.events],
    next_sequence_no: input.session.next_sequence_no + committed.events.length
  });
  if (!nextSession.success) {
    return failure([createSessionCommandIssue({
      code: "EVENT_SEQUENCE_INVALID",
      path: "$.session",
      message: "Authoritative due-work event batch did not form a valid Session aggregate."
    })]);
  }
  const interruptTypes = new Set(
    input.session.pinned_case.clinical_policy.timeline_policy.interrupting_event_types
  );
  return SessionCommandSuccessSchema.parse({
    success: true,
    result_schema_version: SESSION_COMMAND_RESULT_SCHEMA_VERSION,
    issues: [],
    status: "INTERRUPTED_BEFORE_COMMAND",
    command_executed: false,
    replayed: false,
    idempotency_recorded: false,
    authoritative_session: nextSession.data,
    committed_events: committed.events,
    interrupting_events: committed.events.filter((event) => interruptTypes.has(event.event_type)),
    result_event_range: eventRange(committed.events),
    resulting_clinical_time: input.due.next_state.clinical_time
  });
}

function replayCommittedCommand(
  session: InMemorySessionAggregate,
  record: InMemorySessionAggregate["idempotency_records"][number]
): SessionCommandResult {
  const eventIds = new Set(record.committed_event_ids);
  const events = session.committed_events.filter((event) => eventIds.has(event.event_id));
  const interruptTypes = new Set(
    session.pinned_case.clinical_policy.timeline_policy.interrupting_event_types
  );
  return SessionCommandSuccessSchema.parse({
    success: true,
    result_schema_version: SESSION_COMMAND_RESULT_SCHEMA_VERSION,
    issues: [],
    status: "REPLAYED",
    command_executed: true,
    replayed: true,
    idempotency_recorded: true,
    authoritative_session: session,
    committed_events: events,
    interrupting_events: events.filter((event) => interruptTypes.has(event.event_type)),
    result_event_range: record.result_event_range,
    resulting_clinical_time: record.resulting_clinical_time
  });
}

/**
 * Pure in-memory command transaction. Its returned aggregate is the only
 * authoritative commit; failures expose no tentative Patient/Scheduler state.
 */
export async function processExternalLearnerCommand(
  sessionInput: unknown,
  commandInput: unknown,
  dependencies: SessionCommandDependencies
): Promise<SessionCommandResult> {
  const validatedSession = validateInMemorySessionAggregate(sessionInput);
  if (!validatedSession.success) return failure(validatedSession.issues);
  const session = validatedSession.session;
  const fingerprint = await fingerprintExternalLearnerCommand(
    commandInput,
    dependencies.hash_adapter
  );
  if (!fingerprint.success) return failure(fingerprint.issues);
  const command = fingerprint.command;

  const identityIssues = matchesExpectedPinnedCase(command, session);
  if (command.action_request.session_id !== session.session_id) {
    identityIssues.push(createSessionCommandIssue({
      code: "SESSION_ID_MISMATCH",
      path: "$.command.action_request.session_id",
      message: "Action Request Session identity does not match the authoritative Session."
    }));
  }
  if (identityIssues.length > 0) return failure(identityIssues);

  const existingRecord = session.idempotency_records.find(
    (record) => record.idempotency_key === command.action_request.idempotency_key
  );
  if (existingRecord !== undefined) {
    return existingRecord.command_fingerprint === fingerprint.fingerprint
      ? replayCommittedCommand(session, existingRecord)
      : failure([createSessionCommandIssue({
          code: "IDEMPOTENCY_CONFLICT",
          path: "$.command.action_request.idempotency_key",
          related_id: command.action_request.idempotency_key,
          message: "Idempotency key was already committed for a different canonical command."
        })]);
  }

  const stateVersionAtIntake = dependencies.expected_state_version_at_intake
    ?? session.patient_state.state_version;
  if (command.action_request.expected_state_version !== stateVersionAtIntake) {
    return failure([createSessionCommandIssue({
      code: "STATE_VERSION_CONFLICT",
      path: "$.command.action_request.expected_state_version",
      message: "Expected Patient State Version does not match authoritative command intake state."
    })]);
  }

  const priorFacts = eventFactsFromCommittedSession(session);
  const due = settleDueClosure({
    clock: session.clinical_clock,
    state: session.patient_state,
    scheduler_state: session.scheduler_state,
    policy: session.pinned_case.clinical_policy,
    prior_event_facts: priorFacts,
    run_at_least_once: true
  });
  if (!due.success) return failure(due.issues, due.clinical_engine_failure);
  if (due.status === "INTERRUPTED") {
    return commitInterruptedDueSettlement({ session, command, due, dependencies });
  }

  const action = session.pinned_case.action_catalogue.find(
    (item) => item.action_id === command.action_request.action_id
  );
  if (action === undefined) {
    return failure([createSessionCommandIssue({
      code: "UNKNOWN_ACTION_ID",
      path: "$.command.action_request.action_id",
      related_id: command.action_request.action_id,
      message: "Action identity is not present in the immutable pinned Case catalogue."
    })]);
  }
  const parsedAction = PinnedSessionActionDefinitionSchema.parse(action);
  const actionIssues = validateActionRequest({
    action: parsedAction,
    command,
    prior_event_facts: due.prior_event_facts
  });
  if (actionIssues.length > 0) return failure(actionIssues);

  const clinical = evaluatePinnedClinicalPolicy({
    operation: "EVALUATE_TRIGGER",
    policy: session.pinned_case.clinical_policy,
    state: due.next_state,
    scheduler_state: due.next_scheduler_state,
    prior_event_facts: due.prior_event_facts,
    trigger: {
      trigger_type: "COMMITTED_EVENT",
      event_type: parsedAction.execution_event_type,
      action_id: parsedAction.action_id
    },
    current_clinical_time: due.next_state.clinical_time
  });
  if (!clinical.success) {
    return failure([createSessionCommandIssue({
      code: "CLINICAL_ENGINE_FAILURE",
      path: "$.clinical_engine",
      message: "Clinical Engine rejected the tentative learner command transaction."
    })], clinical);
  }

  const postCommandPriorFacts = [
    ...due.prior_event_facts,
    commandEventFact(command, parsedAction, due.next_state.clinical_time),
    ...eventFactsFromProposals(clinical.event_proposals)
  ];
  if (postCommandPriorFacts.length > MAX_PRIOR_EVENT_FACTS) {
    return failure([createSessionCommandIssue({
      code: "COMMAND_WORK_BUDGET_EXCEEDED",
      path: "$.session.committed_events",
      message: "Command-triggered prior-event facts exceeded the Session budget."
    })]);
  }
  const postDue = settleDueClosure({
    clock: SessionClinicalClockSchema.parse({
      ...due.next_clock,
      clinical_time: clinical.next_state.clinical_time
    }),
    state: clinical.next_state,
    scheduler_state: clinical.next_scheduler_state,
    policy: session.pinned_case.clinical_policy,
    prior_event_facts: postCommandPriorFacts,
    run_at_least_once: false
  });
  if (!postDue.success) return failure(postDue.issues, postDue.clinical_engine_failure);

  const finalState = postDue.next_state;
  const finalScheduler = postDue.next_scheduler_state;
  const finalClock = postDue.next_clock;
  const pending: PendingSessionEvent[] = due.event_proposals.map((proposal) =>
    proposalToPendingEvent({
      proposal,
      command,
      state_version_before: session.patient_state.state_version,
      state_version_after: due.next_state.state_version,
      command_related: false
    })
  );
  const commandEventIndex = pending.length;
  pending.push(PendingSessionEventSchema.parse({
    event_origin: "LEARNER_COMMAND",
    clinical_time: due.next_state.clinical_time,
    actor_type: "LEARNER",
    actor_id: command.learner_actor_id,
    source: command.action_request.source,
    correlation_id: command.correlation_id,
    action_request_id: command.action_request.action_request_id,
    action_id: command.action_request.action_id,
    event_type: parsedAction.execution_event_type,
    parameters: command.action_request.parameters,
    payload: {
      catalogue_membership: "VERIFIED",
      execution_status: "EXECUTED"
    },
    clinical_effect_ids: [],
    state_version_before: due.next_state.state_version,
    state_version_after: finalState.state_version,
    idempotency_key: command.action_request.idempotency_key,
    request_id: command.request_id
  }));
  for (const proposal of [...clinical.event_proposals, ...postDue.event_proposals]) {
    pending.push(proposalToPendingEvent({
      proposal,
      command,
      state_version_before: due.next_state.state_version,
      state_version_after: finalState.state_version,
      causation_event_index: commandEventIndex,
      command_related: true
    }));
  }

  const committed = commitPendingSessionEvents({
    session_id: session.session_id,
    case_version: session.pinned_case.case_version,
    first_sequence_no: session.next_sequence_no,
    real_time_utc: dependencies.real_time_utc,
    pending_events: pending,
    event_id_factory: dependencies.event_id_factory
  });
  if (!committed.success) return failure(committed.issues);

  const range = eventRange(committed.events);
  const commandEvent = committed.events[commandEventIndex]!;
  const commitTime = RealUtcTimeSchema.safeParse(dependencies.real_time_utc);
  if (!commitTime.success) {
    return failure([createSessionCommandIssue({
      code: "EVENT_CONVERSION_FAILED",
      path: "$.dependencies.real_time_utc",
      message: "Trusted commit time failed replay-record validation."
    })]);
  }
  const replayRecord = CommittedCommandReplayRecordSchema.parse({
    idempotency_key: command.action_request.idempotency_key,
    command_id: command.action_request.command_id,
    command_fingerprint: fingerprint.fingerprint,
    result_event_range: range,
    committed_event_ids: committed.events.map((event) => event.event_id),
    command_event_id: commandEvent.event_id,
    resulting_state_version: finalState.state_version,
    resulting_clinical_time: finalState.clinical_time,
    committed_at_utc: commitTime.data
  });
  const nextSession = InMemorySessionAggregateSchema.safeParse({
    ...session,
    patient_state: finalState,
    scheduler_state: finalScheduler,
    clinical_clock: finalClock,
    committed_events: [...session.committed_events, ...committed.events],
    next_sequence_no: session.next_sequence_no + committed.events.length,
    idempotency_records: [...session.idempotency_records, replayRecord]
  });
  if (!nextSession.success) {
    return failure([createSessionCommandIssue({
      code: "EVENT_SEQUENCE_INVALID",
      path: "$.session",
      message: "Tentative command batch did not form a valid authoritative Session aggregate."
    })]);
  }

  const interruptTypes = new Set(
    session.pinned_case.clinical_policy.timeline_policy.interrupting_event_types
  );
  return SessionCommandSuccessSchema.parse({
    success: true,
    result_schema_version: SESSION_COMMAND_RESULT_SCHEMA_VERSION,
    issues: [],
    status: "COMMITTED",
    command_executed: true,
    replayed: false,
    idempotency_recorded: true,
    authoritative_session: nextSession.data,
    committed_events: committed.events,
    interrupting_events: committed.events.filter((event) =>
      event.sequence_no > commandEvent.sequence_no && interruptTypes.has(event.event_type)
    ),
    result_event_range: range,
    resulting_clinical_time: finalState.clinical_time
  });
}
