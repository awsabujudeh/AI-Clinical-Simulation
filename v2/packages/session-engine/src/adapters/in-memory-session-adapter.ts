import {
  SessionIdSchema
} from "../../../contracts/src/index.ts";

import {
  InMemorySessionAggregateSchema,
  type InMemorySessionAggregate
} from "../session/in-memory-session.ts";
import { compareTrustedUtc } from "../time/trusted-utc.ts";
import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError
} from "../validation/session-command-issues.ts";
import {
  SessionAdapterCommitRequestSchema,
  createSessionCommitToken,
  sessionCommitTokensEqual,
  type SessionAdapterCommitResult,
  type SessionAdapterLoadResult,
  type SessionCommitAdapter
} from "./session-commit-adapter.ts";

function cloneSession(session: InMemorySessionAggregate): InMemorySessionAggregate {
  return InMemorySessionAggregateSchema.parse(session);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactPrefix(current: readonly unknown[], proposed: readonly unknown[]): boolean {
  return current.length <= proposed.length
    && current.every((value, index) => sameJson(value, proposed[index]));
}

function validateCommitProgression(
  current: InMemorySessionAggregate,
  proposed: InMemorySessionAggregate
) {
  const issues = [];
  if (proposed.session_id !== current.session_id
    || proposed.mode !== current.mode
    || !sameJson(proposed.pinned_case, current.pinned_case)) {
    issues.push(createSessionCommandIssue({
      code: "SESSION_ADAPTER_FAILURE",
      path: "$.proposed_session",
      message: "Atomic Session commit cannot replace pinned identity, mode, or Case authority."
    }));
  }
  if (proposed.patient_state.state_version < current.patient_state.state_version
    || proposed.patient_state.clinical_time < current.patient_state.clinical_time) {
    issues.push(createSessionCommandIssue({
      code: "SESSION_ADAPTER_FAILURE",
      path: "$.proposed_session.patient_state",
      message: "Atomic Session commit cannot regress Patient State version or Clinical Time."
    }));
  }
  if (!exactPrefix(current.committed_events, proposed.committed_events)) {
    issues.push(createSessionCommandIssue({
      code: "SESSION_ADAPTER_FAILURE",
      path: "$.proposed_session.committed_events",
      message: "Atomic Session commit must preserve the exact append-only event prefix."
    }));
  }
  if (!exactPrefix(current.idempotency_records, proposed.idempotency_records)) {
    issues.push(createSessionCommandIssue({
      code: "SESSION_ADAPTER_FAILURE",
      path: "$.proposed_session.idempotency_records",
      message: "Atomic Session commit must preserve committed idempotency records."
    }));
  }
  for (const record of proposed.idempotency_records.slice(current.idempotency_records.length)) {
    if (record.result_event_range.first_sequence_no < current.next_sequence_no) {
      issues.push(createSessionCommandIssue({
        code: "SESSION_ADAPTER_FAILURE",
        path: "$.proposed_session.idempotency_records",
        message: "A new idempotency record must bind events created by this commit."
      }));
    }
  }
  if (current.trusted_real_time_anchor_utc !== undefined
    && proposed.trusted_real_time_anchor_utc !== undefined
    && compareTrustedUtc(
      proposed.trusted_real_time_anchor_utc,
      current.trusted_real_time_anchor_utc
    ) < 0) {
    issues.push(createSessionCommandIssue({
      code: "SESSION_ADAPTER_FAILURE",
      path: "$.proposed_session.trusted_real_time_anchor_utc",
      message: "Atomic Session commit cannot move the trusted real-time anchor backward."
    }));
  }
  return issues;
}

/** Portable copy-safe in-memory proof of the future persistent adapter contract. */
export class InMemorySessionCommitAdapter implements SessionCommitAdapter {
  readonly #sessions = new Map<string, InMemorySessionAggregate>();

  constructor(initialSessions: readonly unknown[] = []) {
    for (const input of initialSessions) {
      const session = InMemorySessionAggregateSchema.parse(input);
      if (this.#sessions.has(session.session_id)) {
        throw new Error(`Duplicate initial Session: ${session.session_id}`);
      }
      this.#sessions.set(session.session_id, cloneSession(session));
    }
  }

  async load(sessionIdInput: unknown): Promise<SessionAdapterLoadResult> {
    const sessionId = SessionIdSchema.safeParse(sessionIdInput);
    if (!sessionId.success) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "INVALID_COORDINATOR_INPUT",
          path: "$.session_id",
          message: "Session adapter load requires a valid SessionId."
        })]
      };
    }
    const stored = this.#sessions.get(sessionId.data);
    if (stored === undefined) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "SESSION_NOT_FOUND",
          path: "$.session_id",
          related_id: sessionId.data,
          message: "Authoritative Session was not found."
        })]
      };
    }
    const session = cloneSession(stored);
    return {
      success: true,
      issues: [],
      session,
      commit_token: createSessionCommitToken(session)
    };
  }

  async commit(input: unknown): Promise<SessionAdapterCommitResult> {
    const request = SessionAdapterCommitRequestSchema.safeParse(input);
    if (!request.success) {
      return {
        success: false,
        issues: sessionCommandIssuesFromZodError(
          "INVALID_COORDINATOR_INPUT",
          "$.adapter_commit",
          request.error
        )
      };
    }
    const current = this.#sessions.get(request.data.session_id);
    if (current === undefined) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "SESSION_NOT_FOUND",
          path: "$.session_id",
          related_id: request.data.session_id,
          message: "Authoritative Session was not found."
        })]
      };
    }
    const currentToken = createSessionCommitToken(current);
    if (!sessionCommitTokensEqual(currentToken, request.data.expected_token)) {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "SESSION_VERSION_CONFLICT",
          path: "$.expected_token",
          related_id: request.data.session_id,
          message: "Authoritative Session changed after it was loaded."
        })]
      };
    }
    const progressionIssues = validateCommitProgression(current, request.data.proposed_session);
    if (progressionIssues.length > 0) {
      return { success: false, issues: progressionIssues };
    }
    const stored = cloneSession(request.data.proposed_session);
    this.#sessions.set(stored.session_id, stored);
    const session = cloneSession(stored);
    return {
      success: true,
      issues: [],
      session,
      commit_token: createSessionCommitToken(session)
    };
  }
}
