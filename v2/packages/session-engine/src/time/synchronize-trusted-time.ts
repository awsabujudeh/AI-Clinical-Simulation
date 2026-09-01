import { z } from "zod";

import {
  CanonicalEventEnvelopeSchema,
  CorrelationIdSchema,
  IdempotencyKeySchema,
  PriorCommittedEventFactSchema,
  RealUtcTimeSchema,
  RequestIdSchema,
  type CanonicalEventEnvelope,
  type PriorCommittedEventFact
} from "../../../contracts/src/index.ts";

import { advanceNormalClinicalClock } from "../clock/session-clock.ts";
import {
  clinicalProposalToPendingSessionEvent,
  commitPendingSessionEvents,
  type EventIdFactory
} from "../events/commit-events.ts";
import {
  InMemorySessionAggregateSchema,
  type InMemorySessionAggregate
} from "../session/in-memory-session.ts";
import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";
import {
  CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION,
  advanceClinicalTime
} from "./advance-clinical-time.ts";
import {
  addTrustedRealSeconds,
  elapsedWholeTrustedSeconds
} from "./trusted-utc.ts";

export const TRUSTED_TIME_SYNC_SCHEMA_VERSION = "1.0" as const;

export const TrustedTimeSynchronizationRequestSchema = z.strictObject({
  sync_schema_version: z.literal(TRUSTED_TIME_SYNC_SCHEMA_VERSION),
  session: InMemorySessionAggregateSchema,
  trusted_real_time_utc: RealUtcTimeSchema,
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  idempotency_key: IdempotencyKeySchema
});
export type TrustedTimeSynchronizationRequest = z.infer<
  typeof TrustedTimeSynchronizationRequestSchema
>;

export const TrustedTimeSynchronizationStatusSchema = z.enum([
  "ANCHORED",
  "NO_CHANGE",
  "PAUSED_NO_CHANGE",
  "REACHED_TARGET",
  "INTERRUPTED"
]);
export type TrustedTimeSynchronizationStatus = z.infer<
  typeof TrustedTimeSynchronizationStatusSchema
>;

export const TrustedTimeSynchronizationSuccessSchema = z.strictObject({
  success: z.literal(true),
  issues: z.tuple([]),
  sync_schema_version: z.literal(TRUSTED_TIME_SYNC_SCHEMA_VERSION),
  status: TrustedTimeSynchronizationStatusSchema,
  proposed_session: InMemorySessionAggregateSchema,
  committed_events: z.array(CanonicalEventEnvelopeSchema).max(512),
  requested_trusted_real_time_utc: RealUtcTimeSchema,
  reached_trusted_real_time_utc: RealUtcTimeSchema,
  requested_target_clinical_time: InMemorySessionAggregateSchema.shape.patient_state.shape.clinical_time,
  reached_clinical_time: InMemorySessionAggregateSchema.shape.patient_state.shape.clinical_time
});
export type TrustedTimeSynchronizationSuccess = z.infer<
  typeof TrustedTimeSynchronizationSuccessSchema
>;

export type TrustedTimeSynchronizationResult =
  | TrustedTimeSynchronizationSuccess
  | { success: false; issues: SessionCommandIssue[] };

function failure(issues: SessionCommandIssue[]): TrustedTimeSynchronizationResult {
  return { success: false, issues };
}

function eventFactsFromSession(
  session: InMemorySessionAggregate
): PriorCommittedEventFact[] {
  return session.committed_events.map((event) => PriorCommittedEventFactSchema.parse({
    event_type: event.event_type,
    ...(event.action_id === undefined ? {} : { action_id: event.action_id }),
    clinical_time: event.clinical_time
  }));
}

function success(input: {
  status: TrustedTimeSynchronizationStatus;
  session: InMemorySessionAggregate;
  events?: CanonicalEventEnvelope[];
  requestedTrustedTime: z.infer<typeof RealUtcTimeSchema>;
  reachedTrustedTime: z.infer<typeof RealUtcTimeSchema>;
  requestedTargetClinicalTime: number;
}): TrustedTimeSynchronizationSuccess {
  return TrustedTimeSynchronizationSuccessSchema.parse({
    success: true,
    issues: [],
    sync_schema_version: TRUSTED_TIME_SYNC_SCHEMA_VERSION,
    status: input.status,
    proposed_session: input.session,
    committed_events: input.events ?? [],
    requested_trusted_real_time_utc: input.requestedTrustedTime,
    reached_trusted_real_time_utc: input.reachedTrustedTime,
    requested_target_clinical_time: input.requestedTargetClinicalTime,
    reached_clinical_time: input.session.patient_state.clinical_time
  });
}

/**
 * Pure trusted-time projection. The supplied timestamp is explicit authority;
 * this function never reads a wall clock and never persists its proposal.
 */
export function synchronizeSessionToTrustedTime(
  input: unknown,
  eventIdFactory: EventIdFactory
): TrustedTimeSynchronizationResult {
  const request = TrustedTimeSynchronizationRequestSchema.safeParse(input);
  if (!request.success) {
    return failure(sessionCommandIssuesFromZodError(
      "INVALID_COORDINATOR_INPUT",
      "$.trusted_time_sync",
      request.error
    ));
  }
  const { session, trusted_real_time_utc: trustedTime } = request.data;
  const anchor = session.trusted_real_time_anchor_utc;
  if (anchor === undefined) {
    const anchored = InMemorySessionAggregateSchema.safeParse({
      ...session,
      trusted_real_time_anchor_utc: trustedTime
    });
    if (!anchored.success) {
      return failure([createSessionCommandIssue({
        code: "TIME_SYNCHRONIZATION_FAILED",
        path: "$.session",
        message: "Trusted real-time anchor did not produce a valid Session aggregate."
      })]);
    }
    return success({
      status: "ANCHORED",
      session: anchored.data,
      requestedTrustedTime: trustedTime,
      reachedTrustedTime: trustedTime,
      requestedTargetClinicalTime: session.patient_state.clinical_time
    });
  }

  const elapsed = elapsedWholeTrustedSeconds(anchor, trustedTime);
  if (!elapsed.success) {
    const regression = elapsed.reason === "REGRESSION";
    return failure([createSessionCommandIssue({
      code: regression ? "TRUSTED_TIME_REGRESSION" : "TRUSTED_TIME_PRECISION_INVALID",
      path: "$.trusted_real_time_utc",
      message: regression
        ? "Trusted real time cannot precede the authoritative Session anchor."
        : "Trusted synchronization requires a finite whole-second elapsed interval."
    })]);
  }
  if (session.clinical_clock.status === "PAUSED") {
    return success({
      status: "PAUSED_NO_CHANGE",
      session,
      requestedTrustedTime: trustedTime,
      reachedTrustedTime: anchor,
      requestedTargetClinicalTime: session.patient_state.clinical_time
    });
  }
  if (elapsed.elapsed_seconds === 0) {
    return success({
      status: "NO_CHANGE",
      session,
      requestedTrustedTime: trustedTime,
      reachedTrustedTime: anchor,
      requestedTargetClinicalTime: session.patient_state.clinical_time
    });
  }

  const projectedClock = advanceNormalClinicalClock({
    clock: session.clinical_clock,
    policy: session.pinned_case.clinical_policy,
    elapsed_real_seconds: elapsed.elapsed_seconds
  });
  if (!projectedClock.success) {
    return failure(projectedClock.issues.map((issue) => createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: issue.path,
      message: issue.message
    })));
  }
  const advancement = advanceClinicalTime({
    advancement_schema_version: CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION,
    source: "TRUSTED_TIME_SYNC",
    clock: session.clinical_clock,
    policy: session.pinned_case.clinical_policy,
    state: session.patient_state,
    scheduler_state: session.scheduler_state,
    prior_event_facts: eventFactsFromSession(session),
    requested_target_clinical_time: projectedClock.clock.clinical_time
  });
  if (!advancement.success) {
    return failure(advancement.issues.map((issue) => createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: issue.path,
      message: issue.message
    })));
  }

  const pending = advancement.event_proposals.map((proposal) =>
    clinicalProposalToPendingSessionEvent({
      proposal,
      correlation_id: request.data.correlation_id,
      idempotency_key: request.data.idempotency_key,
      request_id: request.data.request_id,
      state_version_before: session.patient_state.state_version,
      state_version_after: advancement.next_state.state_version
    })
  );
  let committedEvents: CanonicalEventEnvelope[] = [];
  if (pending.length > 0) {
    const committed = commitPendingSessionEvents({
      session_id: session.session_id,
      case_version: session.pinned_case.case_version,
      first_sequence_no: session.next_sequence_no,
      real_time_utc: trustedTime,
      pending_events: pending,
      event_id_factory: eventIdFactory
    });
    if (!committed.success) return failure(committed.issues);
    committedEvents = committed.events;
  }

  const reachedTrustedTime = advancement.status === "REACHED_TARGET"
    ? trustedTime
    : addTrustedRealSeconds(
        anchor,
        (advancement.reached_clinical_time - session.patient_state.clinical_time)
          / session.pinned_case.clinical_policy.timeline_policy.time_ratio
      );
  if (reachedTrustedTime === undefined) {
    return failure([createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: "$.trusted_real_time_anchor_utc",
      message: "Reached Clinical Time could not be represented as a trusted UTC anchor."
    })]);
  }

  const proposed = InMemorySessionAggregateSchema.safeParse({
    ...session,
    patient_state: advancement.next_state,
    scheduler_state: advancement.next_scheduler_state,
    clinical_clock: advancement.next_clock,
    trusted_real_time_anchor_utc: reachedTrustedTime,
    committed_events: [...session.committed_events, ...committedEvents],
    next_sequence_no: session.next_sequence_no + committedEvents.length
  });
  if (!proposed.success) {
    return failure([createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: "$.session",
      message: "Trusted-time proposal did not form a valid authoritative Session aggregate."
    })]);
  }
  return success({
    status: advancement.status,
    session: proposed.data,
    events: committedEvents,
    requestedTrustedTime: trustedTime,
    reachedTrustedTime,
    requestedTargetClinicalTime: projectedClock.clock.clinical_time
  });
}
