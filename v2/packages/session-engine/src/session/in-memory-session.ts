import { z } from "zod";

import {
  CanonicalEventEnvelopeSchema,
  ClinicalTimeSchema,
  CommandIdSchema,
  EventIdSchema,
  IdempotencyKeySchema,
  PatientStateSchema,
  RealUtcTimeSchema,
  SchedulerStateSchema,
  SequenceNumberSchema,
  SessionClinicalClockSchema,
  SessionIdSchema,
  SessionModeSchema,
  Sha256DigestSchema,
  StateVersionSchema
} from "../../../contracts/src/index.ts";
import {
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema
} from "../../../case-schema/src/index.ts";
import {
  initializeClinicalScheduler,
  initializePatientState
} from "../../../clinical-engine/src/index.ts";

import { initializeSessionClinicalClock } from "../clock/session-clock.ts";
import {
  ExecutablePinnedSessionCaseContextSchema,
  createPinnedReviewSessionCaseContext,
  createPinnedSessionCaseContext,
  type ExecutablePinnedSessionCaseContext
} from "../context/pinned-session-case.ts";
import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError,
  sortSessionCommandIssues,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const IN_MEMORY_SESSION_AGGREGATE_SCHEMA_VERSION = "1.0" as const;

export const SessionEventSequenceRangeSchema = z.strictObject({
  first_sequence_no: SequenceNumberSchema,
  last_sequence_no: SequenceNumberSchema
}).superRefine((value, context) => {
  if (value.last_sequence_no < value.first_sequence_no) {
    context.addIssue({
      code: "custom",
      path: ["last_sequence_no"],
      message: "Last sequence number cannot precede first sequence number."
    });
  }
});
export type SessionEventSequenceRange = z.infer<typeof SessionEventSequenceRangeSchema>;

export const CommittedCommandReplayRecordSchema = z.strictObject({
  idempotency_key: IdempotencyKeySchema,
  command_id: CommandIdSchema,
  command_fingerprint: Sha256DigestSchema,
  result_event_range: SessionEventSequenceRangeSchema,
  committed_event_ids: z.array(EventIdSchema).min(1).max(512),
  command_event_id: EventIdSchema,
  resulting_state_version: StateVersionSchema,
  resulting_clinical_time: ClinicalTimeSchema,
  committed_at_utc: RealUtcTimeSchema
});
export type CommittedCommandReplayRecord = z.infer<
  typeof CommittedCommandReplayRecordSchema
>;

export const InMemorySessionAggregateSchema = z.strictObject({
  aggregate_schema_version: z.literal(IN_MEMORY_SESSION_AGGREGATE_SCHEMA_VERSION),
  status: z.literal("ACTIVE"),
  session_id: SessionIdSchema,
  mode: SessionModeSchema,
  pinned_case: ExecutablePinnedSessionCaseContextSchema,
  patient_state: PatientStateSchema,
  scheduler_state: SchedulerStateSchema,
  clinical_clock: SessionClinicalClockSchema,
  trusted_real_time_anchor_utc: RealUtcTimeSchema.optional(),
  committed_events: z.array(CanonicalEventEnvelopeSchema).max(4096),
  next_sequence_no: SequenceNumberSchema,
  idempotency_records: z.array(CommittedCommandReplayRecordSchema).max(4096)
}).superRefine((value, context) => {
  if (value.patient_state.session_id !== value.session_id) {
    context.addIssue({
      code: "custom",
      path: ["patient_state", "session_id"],
      message: "Patient State session identity must match its Session aggregate."
    });
  }
  if (value.patient_state.case_version !== value.pinned_case.case_version) {
    context.addIssue({
      code: "custom",
      path: ["patient_state", "case_version"],
      message: "Patient State Case Version must match the pinned Session Case."
    });
  }
  if (value.patient_state.clinical_time !== value.clinical_clock.clinical_time) {
    context.addIssue({
      code: "custom",
      path: ["clinical_clock", "clinical_time"],
      message: "Clinical clock and authoritative Patient State must be aligned."
    });
  }

  const eventIds = new Set<string>();
  for (const [index, event] of value.committed_events.entries()) {
    const expectedSequence = index + 1;
    if (event.sequence_no !== expectedSequence) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "sequence_no"],
        message: "Committed Session events must use gap-free monotonic sequence numbers."
      });
    }
    if (event.session_id !== value.session_id) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "session_id"],
        message: "Committed event Session identity must match the aggregate."
      });
    }
    if (event.case_version !== value.pinned_case.case_version) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "case_version"],
        message: "Committed event Case Version must match the pinned Session Case."
      });
    }
    if (eventIds.has(event.event_id)) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "event_id"],
        message: "Committed event identities must be unique."
      });
    }
    eventIds.add(event.event_id);
  }
  if (value.next_sequence_no !== value.committed_events.length + 1) {
    context.addIssue({
      code: "custom",
      path: ["next_sequence_no"],
      message: "Next sequence number must immediately follow the committed timeline."
    });
  }

  const idempotencyKeys = new Set<string>();
  for (const [recordIndex, record] of value.idempotency_records.entries()) {
    if (idempotencyKeys.has(record.idempotency_key)) {
      context.addIssue({
        code: "custom",
        path: ["idempotency_records", recordIndex, "idempotency_key"],
        message: "Idempotency keys must be unique per Session."
      });
    }
    idempotencyKeys.add(record.idempotency_key);
    const expectedIds = value.committed_events
      .filter((event) => event.sequence_no >= record.result_event_range.first_sequence_no
        && event.sequence_no <= record.result_event_range.last_sequence_no)
      .map((event) => event.event_id);
    if (JSON.stringify(expectedIds) !== JSON.stringify(record.committed_event_ids)) {
      context.addIssue({
        code: "custom",
        path: ["idempotency_records", recordIndex, "committed_event_ids"],
        message: "Replay record event identities must exactly match its committed sequence range."
      });
    }
    if (!record.committed_event_ids.includes(record.command_event_id)) {
      context.addIssue({
        code: "custom",
        path: ["idempotency_records", recordIndex, "command_event_id"],
        message: "Replay record must identify its committed learner command event."
      });
    }
  }
});
export type InMemorySessionAggregate = z.infer<typeof InMemorySessionAggregateSchema>;

export type SessionAggregateValidationResult =
  | { success: true; issues: []; session: InMemorySessionAggregate }
  | { success: false; issues: SessionCommandIssue[] };

export function validateInMemorySessionAggregate(
  input: unknown
): SessionAggregateValidationResult {
  const parsed = InMemorySessionAggregateSchema.safeParse(input);
  return parsed.success
    ? { success: true, issues: [], session: parsed.data }
    : {
        success: false,
        issues: sessionCommandIssuesFromZodError(
          "INVALID_SESSION_AGGREGATE",
          "$.session",
          parsed.error
        )
      };
}

export const InMemorySessionInitializationRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  mode: SessionModeSchema,
  compiled_case_package: CompiledCasePackageSchema,
  trusted_real_time_anchor_utc: RealUtcTimeSchema.optional()
});
export type InMemorySessionInitializationRequest = z.infer<
  typeof InMemorySessionInitializationRequestSchema
>;

export type InMemorySessionInitializationResult =
  | { success: true; issues: []; session: InMemorySessionAggregate }
  | { success: false; issues: SessionCommandIssue[] };

export const ReviewInMemorySessionInitializationRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  mode: SessionModeSchema,
  review_execution_artifact: ReviewExecutionArtifactSchema,
  trusted_real_time_anchor_utc: RealUtcTimeSchema.optional()
});

function initializeFromPinnedCase(input: {
  sessionId: z.infer<typeof SessionIdSchema>;
  mode: z.infer<typeof SessionModeSchema>;
  pinnedCase: ExecutablePinnedSessionCaseContext;
  initialPatientState: unknown;
  trustedRealTimeAnchorUtc?: z.infer<typeof RealUtcTimeSchema>;
}): InMemorySessionInitializationResult {
  const patient = initializePatientState(input.initialPatientState, input.sessionId);
  if (!patient.success) {
    return {
      success: false,
      issues: patient.issues.map((issue) => createSessionCommandIssue({
        code: "INVALID_SESSION_AGGREGATE",
        path: issue.path,
        message: issue.message
      }))
    };
  }

  const scheduler = initializeClinicalScheduler(
    input.pinnedCase.clinical_policy.timeline_policy.initial_scheduled_items
  );
  const clock = initializeSessionClinicalClock(patient.state.clinical_time);
  if (!scheduler.success || !clock.success) {
    return {
      success: false,
      issues: sortSessionCommandIssues([
        ...(!scheduler.success ? scheduler.issues.map((issue) => createSessionCommandIssue({
          code: "INVALID_SESSION_AGGREGATE",
          path: issue.path,
          message: issue.message
        })) : []),
        ...(!clock.success ? clock.issues.map((issue) => createSessionCommandIssue({
          code: "INVALID_SESSION_AGGREGATE",
          path: issue.path,
          message: issue.message
        })) : [])
      ])
    };
  }

  const session = InMemorySessionAggregateSchema.safeParse({
    aggregate_schema_version: IN_MEMORY_SESSION_AGGREGATE_SCHEMA_VERSION,
    status: "ACTIVE",
    session_id: input.sessionId,
    mode: input.mode,
    pinned_case: input.pinnedCase,
    patient_state: patient.state,
    scheduler_state: scheduler.schedulerState,
    clinical_clock: clock.clock,
    ...(input.trustedRealTimeAnchorUtc === undefined
      ? {}
      : { trusted_real_time_anchor_utc: input.trustedRealTimeAnchorUtc }),
    committed_events: [],
    next_sequence_no: 1,
    idempotency_records: []
  });
  return session.success
    ? { success: true, issues: [], session: session.data }
    : {
        success: false,
        issues: sessionCommandIssuesFromZodError(
          "INVALID_SESSION_AGGREGATE",
          "$.session",
          session.error
        )
      };
}

/** Creates a new in-memory authority only from one immutable compiled package. */
export function initializeInMemorySession(
  input: unknown
): InMemorySessionInitializationResult {
  const request = InMemorySessionInitializationRequestSchema.safeParse(input);
  if (!request.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_SESSION_AGGREGATE",
        "$.initialization",
        request.error
      )
    };
  }

  const pinned = createPinnedSessionCaseContext(request.data.compiled_case_package);
  if (!pinned.success) {
    return {
      success: false,
      issues: pinned.issues
    };
  }
  return initializeFromPinnedCase({
    sessionId: request.data.session_id,
    mode: request.data.mode,
    pinnedCase: pinned.context,
    initialPatientState: request.data.compiled_case_package.initial_state.patient_state,
    ...(request.data.trusted_real_time_anchor_utc === undefined
      ? {}
      : { trustedRealTimeAnchorUtc: request.data.trusted_real_time_anchor_utc })
  });
}

/** Creates a trusted review Session without converting it to production. */
export function initializeReviewInMemorySession(
  input: unknown
): InMemorySessionInitializationResult {
  const request = ReviewInMemorySessionInitializationRequestSchema.safeParse(input);
  if (!request.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_SESSION_AGGREGATE",
        "$.initialization",
        request.error
      )
    };
  }
  const pinned = createPinnedReviewSessionCaseContext(request.data.review_execution_artifact);
  if (!pinned.success) return { success: false, issues: pinned.issues };
  return initializeFromPinnedCase({
    sessionId: request.data.session_id,
    mode: request.data.mode,
    pinnedCase: pinned.context,
    initialPatientState: request.data.review_execution_artifact.source_case.initial_state.patient_state,
    ...(request.data.trusted_real_time_anchor_utc === undefined
      ? {}
      : { trustedRealTimeAnchorUtc: request.data.trusted_real_time_anchor_utc })
  });
}
