import { z } from "zod";

import {
  ClinicalTimeSchema,
  RealUtcTimeSchema,
  SequenceNumberSchema,
  SessionClinicalClockStatusSchema,
  SessionIdSchema,
  StateVersionSchema
} from "../../../contracts/src/index.ts";

import {
  InMemorySessionAggregateSchema,
  type InMemorySessionAggregate
} from "../session/in-memory-session.ts";
import {
  SessionCommandIssueSchema,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const SESSION_COMMIT_TOKEN_SCHEMA_VERSION = "1.0" as const;

/**
 * Composite compare-and-swap token over existing authoritative mutation axes.
 * This is deliberately not another Patient/Session version counter.
 */
export const SessionCommitTokenSchema = z.strictObject({
  token_schema_version: z.literal(SESSION_COMMIT_TOKEN_SCHEMA_VERSION),
  session_id: SessionIdSchema,
  patient_state_version: StateVersionSchema,
  next_event_sequence: SequenceNumberSchema,
  clock_status: SessionClinicalClockStatusSchema,
  clinical_time: ClinicalTimeSchema,
  trusted_real_time_anchor_utc: RealUtcTimeSchema.optional()
});
export type SessionCommitToken = z.infer<typeof SessionCommitTokenSchema>;

export const SessionAdapterCommitRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  expected_token: SessionCommitTokenSchema,
  proposed_session: InMemorySessionAggregateSchema
});
export type SessionAdapterCommitRequest = z.infer<
  typeof SessionAdapterCommitRequestSchema
>;

export type SessionAdapterLoadResult =
  | {
      success: true;
      issues: [];
      session: InMemorySessionAggregate;
      commit_token: SessionCommitToken;
    }
  | { success: false; issues: SessionCommandIssue[] };

export type SessionAdapterCommitResult =
  | {
      success: true;
      issues: [];
      session: InMemorySessionAggregate;
      commit_token: SessionCommitToken;
    }
  | { success: false; issues: SessionCommandIssue[] };

/** Storage-neutral authoritative Session load/atomic compare-and-swap boundary. */
export interface SessionCommitAdapter {
  load(sessionId: unknown): Promise<SessionAdapterLoadResult>;
  commit(input: unknown): Promise<SessionAdapterCommitResult>;
}

export function createSessionCommitToken(
  session: InMemorySessionAggregate
): SessionCommitToken {
  return SessionCommitTokenSchema.parse({
    token_schema_version: SESSION_COMMIT_TOKEN_SCHEMA_VERSION,
    session_id: session.session_id,
    patient_state_version: session.patient_state.state_version,
    next_event_sequence: session.next_sequence_no,
    clock_status: session.clinical_clock.status,
    clinical_time: session.clinical_clock.clinical_time,
    ...(session.trusted_real_time_anchor_utc === undefined
      ? {}
      : { trusted_real_time_anchor_utc: session.trusted_real_time_anchor_utc })
  });
}

export function sessionCommitTokensEqual(
  left: SessionCommitToken,
  right: SessionCommitToken
): boolean {
  return left.session_id === right.session_id
    && left.patient_state_version === right.patient_state_version
    && left.next_event_sequence === right.next_event_sequence
    && left.clock_status === right.clock_status
    && left.clinical_time === right.clinical_time
    && left.trusted_real_time_anchor_utc === right.trusted_real_time_anchor_utc;
}

export const SessionAdapterFailureSchema = z.strictObject({
  success: z.literal(false),
  issues: z.array(SessionCommandIssueSchema).min(1)
});
