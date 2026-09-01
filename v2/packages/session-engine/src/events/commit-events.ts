import { z } from "zod";

import {
  ActionIdSchema,
  ActionRequestIdSchema,
  ActorIdSchema,
  CanonicalEventEnvelopeSchema,
  ClinicalEffectIdSchema,
  ClinicalTimeSchema,
  CorrelationIdSchema,
  EventActorTypeSchema,
  EventIdSchema,
  EventSourceSchema,
  EventTypeSchema,
  IdempotencyKeySchema,
  JsonObjectSchema,
  JsonValueSchema,
  RealUtcTimeSchema,
  RequestIdSchema,
  RuleIdSchema,
  SequenceNumberSchema,
  SessionIdSchema,
  StateVersionSchema,
  SemanticVersionSchema,
  type CanonicalEventEnvelope,
  type ClinicalEventProposal,
  type EventId,
  type EventType,
  type IdempotencyKey,
  type SequenceNumber,
  type SessionId
} from "../../../contracts/src/index.ts";

import {
  createSessionCommandIssue,
  sortSessionCommandIssues,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const PendingSessionEventSchema = z.strictObject({
  event_origin: z.enum(["LEARNER_COMMAND", "CLINICAL_ENGINE", "SESSION_COORDINATOR"]),
  clinical_time: ClinicalTimeSchema,
  actor_type: EventActorTypeSchema,
  actor_id: ActorIdSchema.optional(),
  source: EventSourceSchema,
  correlation_id: CorrelationIdSchema,
  causation_event_index: z.number().int().nonnegative().optional(),
  action_request_id: ActionRequestIdSchema.optional(),
  action_id: ActionIdSchema.optional(),
  rule_id: RuleIdSchema.optional(),
  event_type: EventTypeSchema,
  parameters: JsonObjectSchema,
  payload: JsonValueSchema,
  clinical_effect_ids: z.array(ClinicalEffectIdSchema).max(32),
  state_version_before: StateVersionSchema,
  state_version_after: StateVersionSchema,
  idempotency_key: IdempotencyKeySchema,
  request_id: RequestIdSchema.optional()
}).superRefine((value, context) => {
  if (value.event_origin === "LEARNER_COMMAND" && value.actor_type !== "LEARNER") {
    context.addIssue({
      code: "custom",
      path: ["actor_type"],
      message: "Learner command events must retain learner actor authority."
    });
  }
  if (value.event_origin === "CLINICAL_ENGINE"
    && (value.actor_type !== "SYSTEM" || value.source !== "ENGINE")) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "Clinical Engine proposals commit only as SYSTEM/ENGINE events."
    });
  }
  if (value.event_origin === "SESSION_COORDINATOR"
    && (value.actor_type !== "SYSTEM" || value.source !== "ENGINE")) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "Session Coordinator events commit only as SYSTEM/ENGINE events."
    });
  }
});
export type PendingSessionEvent = z.infer<typeof PendingSessionEventSchema>;

export type EventIdFactoryInput = Readonly<{
  session_id: SessionId;
  sequence_no: SequenceNumber;
  event_type: EventType;
  idempotency_key: IdempotencyKey;
  event_ordinal: number;
}>;

/** Event IDs are infrastructure-owned UUIDs; tests inject a pure factory. */
export interface EventIdFactory {
  createEventId(input: EventIdFactoryInput): unknown;
}

/** Maps a validated Clinical proposal into a still non-authoritative event. */
export function clinicalProposalToPendingSessionEvent(input: {
  proposal: ClinicalEventProposal;
  correlation_id: z.infer<typeof CorrelationIdSchema>;
  idempotency_key: z.infer<typeof IdempotencyKeySchema>;
  request_id?: z.infer<typeof RequestIdSchema>;
  state_version_before: z.infer<typeof StateVersionSchema>;
  state_version_after: z.infer<typeof StateVersionSchema>;
  causation_event_index?: number;
  action_request_id?: z.infer<typeof ActionRequestIdSchema>;
}): PendingSessionEvent {
  return {
    event_origin: "CLINICAL_ENGINE",
    clinical_time: input.proposal.proposed_clinical_time,
    actor_type: "SYSTEM",
    source: "ENGINE",
    correlation_id: input.correlation_id,
    ...(input.causation_event_index === undefined
      ? {}
      : { causation_event_index: input.causation_event_index }),
    ...(input.action_request_id === undefined
      ? {}
      : { action_request_id: input.action_request_id }),
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
    idempotency_key: input.idempotency_key,
    ...(input.request_id === undefined ? {} : { request_id: input.request_id })
  };
}

export type CommitPendingEventsResult =
  | { success: true; issues: []; events: CanonicalEventEnvelope[] }
  | { success: false; issues: SessionCommandIssue[] };

export function commitPendingSessionEvents(input: {
  session_id: SessionId;
  case_version: z.infer<typeof SemanticVersionSchema>;
  first_sequence_no: SequenceNumber;
  real_time_utc: unknown;
  pending_events: readonly PendingSessionEvent[];
  event_id_factory: EventIdFactory;
}): CommitPendingEventsResult {
  const realTime = RealUtcTimeSchema.safeParse(input.real_time_utc);
  if (!realTime.success) {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "EVENT_CONVERSION_FAILED",
        path: "$.dependencies.real_time_utc",
        message: "Trusted commit time must be a valid UTC timestamp."
      })]
    };
  }
  const pending = z.array(PendingSessionEventSchema).min(1).max(512)
    .safeParse(input.pending_events);
  if (!pending.success) {
    return {
      success: false,
      issues: sortSessionCommandIssues(pending.error.issues.map((issue) =>
        createSessionCommandIssue({
          code: "EVENT_CONVERSION_FAILED",
          path: issue.path.length === 0
            ? "$.pending_events"
            : `$.pending_events.${issue.path.map(String).join(".")}`,
          message: issue.message
        })
      ))
    };
  }

  const eventIds: EventId[] = [];
  try {
    for (const [index, event] of pending.data.entries()) {
      if (event.causation_event_index !== undefined
        && event.causation_event_index >= index) {
        return {
          success: false,
          issues: [createSessionCommandIssue({
            code: "EVENT_CONVERSION_FAILED",
            path: `$.pending_events.${index}.causation_event_index`,
            message: "Event causation must reference an earlier event in the same batch."
          })]
        };
      }
      const sequence = SequenceNumberSchema.safeParse(input.first_sequence_no + index);
      if (!sequence.success) {
        return {
          success: false,
          issues: [createSessionCommandIssue({
            code: "EVENT_SEQUENCE_INVALID",
            path: `$.pending_events.${index}`,
            message: "Event batch would exceed valid authoritative sequence numbers."
          })]
        };
      }
      const eventId = EventIdSchema.safeParse(input.event_id_factory.createEventId(Object.freeze({
        session_id: input.session_id,
        sequence_no: sequence.data,
        event_type: event.event_type,
        idempotency_key: event.idempotency_key,
        event_ordinal: index
      })));
      if (!eventId.success) {
        return {
          success: false,
          issues: [createSessionCommandIssue({
            code: "EVENT_CONVERSION_FAILED",
            path: `$.pending_events.${index}.event_id`,
            message: "Event ID factory must return a canonical UUID EventId."
          })]
        };
      }
      eventIds.push(eventId.data);
    }
  } catch {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "EVENT_CONVERSION_FAILED",
        path: "$.dependencies.event_id_factory",
        message: "Event ID factory failed before the authoritative batch was committed."
      })]
    };
  }

  if (new Set(eventIds).size !== eventIds.length) {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "EVENT_CONVERSION_FAILED",
        path: "$.pending_events",
        message: "Event ID factory produced a duplicate UUID in one transaction."
      })]
    };
  }

  const events: CanonicalEventEnvelope[] = [];
  for (const [index, event] of pending.data.entries()) {
    const envelope = CanonicalEventEnvelopeSchema.safeParse({
      event_id: eventIds[index],
      session_id: input.session_id,
      sequence_no: input.first_sequence_no + index,
      event_schema_version: "1.0",
      clinical_time: event.clinical_time,
      real_time_utc: realTime.data,
      actor_type: event.actor_type,
      ...(event.actor_id === undefined ? {} : { actor_id: event.actor_id }),
      source: event.source,
      correlation_id: event.correlation_id,
      ...(event.causation_event_index === undefined
        ? {}
        : { causation_event_id: eventIds[event.causation_event_index] }),
      ...(event.action_request_id === undefined
        ? {}
        : { action_request_id: event.action_request_id }),
      ...(event.action_id === undefined ? {} : { action_id: event.action_id }),
      ...(event.rule_id === undefined ? {} : { rule_id: event.rule_id }),
      event_type: event.event_type,
      parameters: event.parameters,
      status: "COMMITTED",
      payload: event.payload,
      clinical_effect_ids: event.clinical_effect_ids,
      state_version_before: event.state_version_before,
      state_version_after: event.state_version_after,
      scoring_evidence_refs: [],
      case_version: input.case_version,
      idempotency_key: event.idempotency_key,
      ...(event.request_id === undefined ? {} : { request_id: event.request_id })
    });
    if (!envelope.success) {
      return {
        success: false,
        issues: sortSessionCommandIssues(envelope.error.issues.map((issue) =>
          createSessionCommandIssue({
            code: "EVENT_CONVERSION_FAILED",
            path: `$.pending_events.${index}.${issue.path.map(String).join(".")}`,
            message: issue.message
          })
        ))
      };
    }
    events.push(envelope.data);
  }
  return { success: true, issues: [], events };
}
