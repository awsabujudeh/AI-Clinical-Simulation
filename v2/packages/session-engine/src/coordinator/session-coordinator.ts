import { z } from "zod";

import {
  CanonicalEventEnvelopeSchema,
  CorrelationIdSchema,
  IdempotencyKeySchema,
  RealUtcTimeSchema,
  RequestIdSchema,
  SessionIdSchema,
  type HashAdapter
} from "../../../contracts/src/index.ts";

import {
  pauseSessionClinicalClock,
  resumeSessionClinicalClock
} from "../clock/session-clock.ts";
import {
  processExternalLearnerCommand,
  SessionCommandSuccessSchema,
  type SessionCommandFailure,
  type SessionCommandSuccess
} from "../commands/process-external-command.ts";
import { fingerprintExternalLearnerCommand } from "../commands/external-command.ts";
import {
  commitPendingSessionEvents,
  type EventIdFactory,
  type PendingSessionEvent
} from "../events/commit-events.ts";
import {
  InMemorySessionAggregateSchema,
  type InMemorySessionAggregate
} from "../session/in-memory-session.ts";
import {
  TRUSTED_TIME_SYNC_SCHEMA_VERSION,
  synchronizeSessionToTrustedTime
} from "../time/synchronize-trusted-time.ts";
import { compareTrustedUtc } from "../time/trusted-utc.ts";
import {
  createSessionCommandIssue,
  SessionCommandIssueSchema,
  sessionCommandIssuesFromZodError,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";
import {
  type SessionAdapterLoadResult,
  type SessionCommitAdapter
} from "../adapters/session-commit-adapter.ts";

export const SESSION_COORDINATOR_SCHEMA_VERSION = "1.0" as const;

const SessionCoordinatorOperationSchema = z.enum([
  "SUBMIT_EXTERNAL_COMMAND",
  "SYNC_TRUSTED_TIME",
  "PAUSE_SESSION",
  "RESUME_SESSION"
]);
export type SessionCoordinatorOperation = z.infer<
  typeof SessionCoordinatorOperationSchema
>;

export const SessionCoordinatorContextSchema = z.strictObject({
  coordinator_schema_version: z.literal(SESSION_COORDINATOR_SCHEMA_VERSION),
  session_id: SessionIdSchema,
  trusted_real_time_utc: RealUtcTimeSchema,
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  idempotency_key: IdempotencyKeySchema
});
export type SessionCoordinatorContext = z.infer<typeof SessionCoordinatorContextSchema>;

export const SessionCoordinatorSubmitRequestSchema = SessionCoordinatorContextSchema.extend({
  command: z.unknown()
});
export type SessionCoordinatorSubmitRequest = z.infer<
  typeof SessionCoordinatorSubmitRequestSchema
>;

export const SessionCoordinatorSuccessSchema = z.strictObject({
  success: z.literal(true),
  issues: z.tuple([]),
  coordinator_schema_version: z.literal(SESSION_COORDINATOR_SCHEMA_VERSION),
  operation: SessionCoordinatorOperationSchema,
  status: z.enum(["COMMITTED", "REPLAYED", "NO_CHANGE", "INTERRUPTED"]),
  authoritative_session: InMemorySessionAggregateSchema,
  committed_events: z.array(CanonicalEventEnvelopeSchema).max(1024),
  command_result: SessionCommandSuccessSchema.optional()
});
export type SessionCoordinatorSuccess = z.infer<typeof SessionCoordinatorSuccessSchema>;

export type SessionCoordinatorFailure = {
  success: false;
  issues: SessionCommandIssue[];
  command_failure?: SessionCommandFailure;
};
export type SessionCoordinatorResult = SessionCoordinatorSuccess | SessionCoordinatorFailure;

export type SessionCoordinatorDependencies = Readonly<{
  adapter: SessionCommitAdapter;
  hash_adapter: HashAdapter;
  event_id_factory: EventIdFactory;
}>;

/** The one public Session orchestration authority for V2-006. */
export interface SessionCoordinator {
  submitExternalClinicalCommand(input: unknown): Promise<SessionCoordinatorResult>;
  syncRunningSession(input: unknown): Promise<SessionCoordinatorResult>;
  pauseSession(input: unknown): Promise<SessionCoordinatorResult>;
  resumeSession(input: unknown): Promise<SessionCoordinatorResult>;
}

function failure(
  issues: SessionCommandIssue[],
  commandFailure?: SessionCommandFailure
): SessionCoordinatorFailure {
  return {
    success: false,
    issues: z.array(SessionCommandIssueSchema).min(1).parse(issues),
    ...(commandFailure === undefined ? {} : { command_failure: commandFailure })
  };
}

function success(input: {
  operation: SessionCoordinatorOperation;
  status: SessionCoordinatorSuccess["status"];
  session: InMemorySessionAggregate;
  committedEvents?: SessionCoordinatorSuccess["committed_events"];
  commandResult?: SessionCommandSuccess;
}): SessionCoordinatorSuccess {
  return SessionCoordinatorSuccessSchema.parse({
    success: true,
    issues: [],
    coordinator_schema_version: SESSION_COORDINATOR_SCHEMA_VERSION,
    operation: input.operation,
    status: input.status,
    authoritative_session: input.session,
    committed_events: input.committedEvents ?? [],
    ...(input.commandResult === undefined ? {} : { command_result: input.commandResult })
  });
}

function parseContext(input: unknown) {
  const parsed = SessionCoordinatorContextSchema.safeParse(input);
  return parsed.success
    ? { success: true as const, context: parsed.data }
    : {
        success: false as const,
        issues: sessionCommandIssuesFromZodError(
          "INVALID_COORDINATOR_INPUT",
          "$.coordinator",
          parsed.error
        )
      };
}

function newEventsSince(
  before: InMemorySessionAggregate,
  after: InMemorySessionAggregate
) {
  return after.committed_events.slice(before.committed_events.length);
}

function sameSession(
  left: InMemorySessionAggregate,
  right: InMemorySessionAggregate
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateNoBackwardControlTime(
  session: InMemorySessionAggregate,
  trustedTime: z.infer<typeof RealUtcTimeSchema>
): SessionCommandIssue[] {
  const anchor = session.trusted_real_time_anchor_utc;
  if (anchor === undefined || compareTrustedUtc(trustedTime, anchor) >= 0) return [];
  return [createSessionCommandIssue({
    code: "TRUSTED_TIME_REGRESSION",
    path: "$.trusted_real_time_utc",
    message: "Trusted real time cannot precede the authoritative Session anchor."
  })];
}

function synchronize(
  session: InMemorySessionAggregate,
  context: SessionCoordinatorContext,
  eventIdFactory: EventIdFactory
) {
  return synchronizeSessionToTrustedTime({
    sync_schema_version: TRUSTED_TIME_SYNC_SCHEMA_VERSION,
    session,
    trusted_real_time_utc: context.trusted_real_time_utc,
    request_id: context.request_id,
    correlation_id: context.correlation_id,
    idempotency_key: context.idempotency_key
  }, eventIdFactory);
}

function appendLifecycleEvent(input: {
  session: InMemorySessionAggregate;
  context: SessionCoordinatorContext;
  eventType: "SESSION_PAUSED" | "SESSION_RESUMED";
  nextStatus: "PAUSED" | "RUNNING";
  eventIdFactory: EventIdFactory;
}): SessionCoordinatorResult {
  const changedClock = input.nextStatus === "PAUSED"
    ? pauseSessionClinicalClock(input.session.clinical_clock)
    : resumeSessionClinicalClock(input.session.clinical_clock);
  if (!changedClock.success) {
    return failure(changedClock.issues.map((issue) => createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: issue.path,
      message: issue.message
    })));
  }
  const pending: PendingSessionEvent = {
    event_origin: "SESSION_COORDINATOR",
    clinical_time: input.session.patient_state.clinical_time,
    actor_type: "SYSTEM",
    source: "ENGINE",
    correlation_id: input.context.correlation_id,
    event_type: input.eventType,
    parameters: {},
    payload: { clock_status: input.nextStatus },
    clinical_effect_ids: [],
    state_version_before: input.session.patient_state.state_version,
    state_version_after: input.session.patient_state.state_version,
    idempotency_key: input.context.idempotency_key,
    request_id: input.context.request_id
  };
  const committed = commitPendingSessionEvents({
    session_id: input.session.session_id,
    case_version: input.session.pinned_case.case_version,
    first_sequence_no: input.session.next_sequence_no,
    real_time_utc: input.context.trusted_real_time_utc,
    pending_events: [pending],
    event_id_factory: input.eventIdFactory
  });
  if (!committed.success) return failure(committed.issues);
  const proposed = InMemorySessionAggregateSchema.safeParse({
    ...input.session,
    clinical_clock: changedClock.clock,
    trusted_real_time_anchor_utc: input.context.trusted_real_time_utc,
    committed_events: [...input.session.committed_events, ...committed.events],
    next_sequence_no: input.session.next_sequence_no + committed.events.length
  });
  if (!proposed.success) {
    return failure([createSessionCommandIssue({
      code: "TIME_SYNCHRONIZATION_FAILED",
      path: "$.session",
      message: "Session lifecycle change did not form a valid proposed aggregate."
    })]);
  }
  return success({
    operation: input.eventType === "SESSION_PAUSED" ? "PAUSE_SESSION" : "RESUME_SESSION",
    status: "COMMITTED",
    session: proposed.data,
    committedEvents: committed.events
  });
}

async function commitProposal(
  loaded: Extract<SessionAdapterLoadResult, { success: true }>,
  proposed: InMemorySessionAggregate,
  adapter: SessionCommitAdapter
) {
  return adapter.commit({
    session_id: loaded.session.session_id,
    expected_token: loaded.commit_token,
    proposed_session: proposed
  });
}

export function createSessionCoordinator(
  dependencies: SessionCoordinatorDependencies
): SessionCoordinator {
  async function syncRunningSession(input: unknown): Promise<SessionCoordinatorResult> {
    const parsed = parseContext(input);
    if (!parsed.success) return failure(parsed.issues);
    const loaded = await dependencies.adapter.load(parsed.context.session_id);
    if (!loaded.success) return failure(loaded.issues);
    const synchronized = synchronize(
      loaded.session,
      parsed.context,
      dependencies.event_id_factory
    );
    if (!synchronized.success) return failure(synchronized.issues);
    if (sameSession(loaded.session, synchronized.proposed_session)) {
      return success({
        operation: "SYNC_TRUSTED_TIME",
        status: "NO_CHANGE",
        session: loaded.session
      });
    }
    const committed = await commitProposal(
      loaded,
      synchronized.proposed_session,
      dependencies.adapter
    );
    if (!committed.success) return failure(committed.issues);
    return success({
      operation: "SYNC_TRUSTED_TIME",
      status: synchronized.status === "INTERRUPTED" ? "INTERRUPTED" : "COMMITTED",
      session: committed.session,
      committedEvents: newEventsSince(loaded.session, committed.session)
    });
  }

  async function pauseSession(input: unknown): Promise<SessionCoordinatorResult> {
    const parsed = parseContext(input);
    if (!parsed.success) return failure(parsed.issues);
    const loaded = await dependencies.adapter.load(parsed.context.session_id);
    if (!loaded.success) return failure(loaded.issues);
    if (loaded.session.clinical_clock.status === "PAUSED") {
      const timeIssues = validateNoBackwardControlTime(
        loaded.session,
        parsed.context.trusted_real_time_utc
      );
      return timeIssues.length > 0
        ? failure(timeIssues)
        : success({
            operation: "PAUSE_SESSION",
            status: "NO_CHANGE",
            session: loaded.session
          });
    }
    const synchronized = synchronize(
      loaded.session,
      parsed.context,
      dependencies.event_id_factory
    );
    if (!synchronized.success) return failure(synchronized.issues);
    if (synchronized.status === "INTERRUPTED") {
      const committedInterrupt = await commitProposal(
        loaded,
        synchronized.proposed_session,
        dependencies.adapter
      );
      if (!committedInterrupt.success) return failure(committedInterrupt.issues);
      return success({
        operation: "PAUSE_SESSION",
        status: "INTERRUPTED",
        session: committedInterrupt.session,
        committedEvents: newEventsSince(loaded.session, committedInterrupt.session)
      });
    }
    const paused = appendLifecycleEvent({
      session: synchronized.proposed_session,
      context: parsed.context,
      eventType: "SESSION_PAUSED",
      nextStatus: "PAUSED",
      eventIdFactory: dependencies.event_id_factory
    });
    if (!paused.success) return paused;
    const committed = await commitProposal(
      loaded,
      paused.authoritative_session,
      dependencies.adapter
    );
    if (!committed.success) return failure(committed.issues);
    return success({
      operation: "PAUSE_SESSION",
      status: "COMMITTED",
      session: committed.session,
      committedEvents: newEventsSince(loaded.session, committed.session)
    });
  }

  async function resumeSession(input: unknown): Promise<SessionCoordinatorResult> {
    const parsed = parseContext(input);
    if (!parsed.success) return failure(parsed.issues);
    const loaded = await dependencies.adapter.load(parsed.context.session_id);
    if (!loaded.success) return failure(loaded.issues);
    const timeIssues = validateNoBackwardControlTime(
      loaded.session,
      parsed.context.trusted_real_time_utc
    );
    if (timeIssues.length > 0) return failure(timeIssues);
    if (loaded.session.clinical_clock.status === "RUNNING") {
      return success({
        operation: "RESUME_SESSION",
        status: "NO_CHANGE",
        session: loaded.session
      });
    }
    const resumed = appendLifecycleEvent({
      session: loaded.session,
      context: parsed.context,
      eventType: "SESSION_RESUMED",
      nextStatus: "RUNNING",
      eventIdFactory: dependencies.event_id_factory
    });
    if (!resumed.success) return resumed;
    const committed = await commitProposal(
      loaded,
      resumed.authoritative_session,
      dependencies.adapter
    );
    if (!committed.success) return failure(committed.issues);
    return success({
      operation: "RESUME_SESSION",
      status: "COMMITTED",
      session: committed.session,
      committedEvents: newEventsSince(loaded.session, committed.session)
    });
  }

  async function resolveExactReplayAfterCommitConflict(
    request: SessionCoordinatorSubmitRequest,
    conflictIssues: SessionCommandIssue[]
  ): Promise<SessionCoordinatorResult> {
    const current = await dependencies.adapter.load(request.session_id);
    if (!current.success) return failure(current.issues);
    const fingerprint = await fingerprintExternalLearnerCommand(
      request.command,
      dependencies.hash_adapter
    );
    if (!fingerprint.success) return failure(fingerprint.issues);
    const record = current.session.idempotency_records.find(
      (candidate) => candidate.idempotency_key
        === fingerprint.command.action_request.idempotency_key
    );
    if (record === undefined) {
      // A concurrent unrelated commit may have changed medical state. Never
      // recompute the clinical command against that new authority.
      return failure(conflictIssues);
    }
    const replay = await processExternalLearnerCommand(
      current.session,
      request.command,
      {
        hash_adapter: dependencies.hash_adapter,
        event_id_factory: dependencies.event_id_factory,
        real_time_utc: request.trusted_real_time_utc,
        expected_state_version_at_intake: current.session.patient_state.state_version
      }
    );
    if (!replay.success) return failure(replay.issues, replay);
    if (replay.status !== "REPLAYED") return failure(conflictIssues);
    return success({
      operation: "SUBMIT_EXTERNAL_COMMAND",
      status: "REPLAYED",
      session: current.session,
      committedEvents: [],
      commandResult: replay
    });
  }

  async function submitAttempt(
    request: SessionCoordinatorSubmitRequest
  ): Promise<SessionCoordinatorResult> {
    const loaded = await dependencies.adapter.load(request.session_id);
    if (!loaded.success) return failure(loaded.issues);
    const synchronized = synchronize(
      loaded.session,
      request,
      dependencies.event_id_factory
    );
    if (!synchronized.success) return failure(synchronized.issues);
    if (synchronized.status === "INTERRUPTED") {
      const committedInterrupt = await commitProposal(
        loaded,
        synchronized.proposed_session,
        dependencies.adapter
      );
      if (!committedInterrupt.success) {
        return failure(committedInterrupt.issues);
      }
      return success({
        operation: "SUBMIT_EXTERNAL_COMMAND",
        status: "INTERRUPTED",
        session: committedInterrupt.session,
        committedEvents: newEventsSince(loaded.session, committedInterrupt.session)
      });
    }
    const command = await processExternalLearnerCommand(
      synchronized.proposed_session,
      request.command,
      {
        hash_adapter: dependencies.hash_adapter,
        event_id_factory: dependencies.event_id_factory,
        real_time_utc: request.trusted_real_time_utc,
        expected_state_version_at_intake: loaded.session.patient_state.state_version
      }
    );
    if (!command.success) return failure(command.issues, command);

    if (sameSession(loaded.session, command.authoritative_session)) {
      return success({
        operation: "SUBMIT_EXTERNAL_COMMAND",
        status: command.status === "REPLAYED" ? "REPLAYED" : "NO_CHANGE",
        session: loaded.session,
        commandResult: command
      });
    }
    const committed = await commitProposal(
      loaded,
      command.authoritative_session,
      dependencies.adapter
    );
    if (!committed.success) {
      return committed.issues.some((issue) => issue.code === "SESSION_VERSION_CONFLICT")
        ? resolveExactReplayAfterCommitConflict(request, committed.issues)
        : failure(committed.issues);
    }
    const committedCommand = SessionCommandSuccessSchema.parse({
      ...command,
      authoritative_session: committed.session
    });
    return success({
      operation: "SUBMIT_EXTERNAL_COMMAND",
      status: command.status === "REPLAYED"
        ? "REPLAYED"
        : command.status === "INTERRUPTED_BEFORE_COMMAND"
          ? "INTERRUPTED"
          : "COMMITTED",
      session: committed.session,
      committedEvents: newEventsSince(loaded.session, committed.session),
      commandResult: committedCommand
    });
  }

  async function submitExternalClinicalCommand(
    input: unknown
  ): Promise<SessionCoordinatorResult> {
    const request = SessionCoordinatorSubmitRequestSchema.safeParse(input);
    if (!request.success) {
      return failure(sessionCommandIssuesFromZodError(
        "INVALID_COORDINATOR_INPUT",
        "$.coordinator",
        request.error
      ));
    }
    return submitAttempt(request.data);
  }

  return Object.freeze({
    submitExternalClinicalCommand,
    syncRunningSession,
    pauseSession,
    resumeSession
  });
}
