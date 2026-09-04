import { z } from "zod";

import {
  JsonObjectSchema,
  SessionIdSchema,
  type JsonObject
} from "../../../../contracts/src/index.ts";

import {
  InMemorySessionAggregateSchema
} from "../../session/in-memory-session.ts";
import { canonicalSerialize } from "../../../../case-schema/src/index.ts";
import {
  createSessionCommandIssue,
  type SessionCommandIssue
} from "../../validation/session-command-issues.ts";
import {
  SessionAdapterCommitRequestSchema,
  createSessionCommitToken,
  type SessionAdapterCommitResult,
  type SessionAdapterLoadResult,
  type SessionCommitAdapter
} from "../session-commit-adapter.ts";

export const POSTGRES_SESSION_LOAD_FUNCTION =
  "load_authoritative_session_v2_012a" as const;
export const POSTGRES_SESSION_COMMIT_FUNCTION =
  "commit_authoritative_session_v2_012a" as const;

export type PostgresRpcError = Readonly<{
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}>;

export type PostgresRpcResult = Readonly<{
  data: unknown;
  error: PostgresRpcError | null;
}>;

/**
 * Narrow Supabase-compatible RPC surface. It deliberately imports no SDK and
 * can be implemented by the intended Edge runtime or by a native test harness.
 */
export interface PostgresSessionRpcClient {
  rpc(functionName: string, parameters: JsonObject): Promise<PostgresRpcResult>;
}

const LoadedResponseSchema = z.strictObject({
  status: z.literal("LOADED"),
  aggregate: InMemorySessionAggregateSchema,
  events: InMemorySessionAggregateSchema.shape.committed_events,
  commands: InMemorySessionAggregateSchema.shape.idempotency_records,
  checkpoint: InMemorySessionAggregateSchema.nullable()
});

const CommitResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("COMMITTED"),
    aggregate: InMemorySessionAggregateSchema
  }),
  z.strictObject({ status: z.literal("NOT_FOUND") }),
  z.strictObject({ status: z.literal("VERSION_CONFLICT") }),
  z.strictObject({ status: z.literal("IDEMPOTENCY_CONFLICT") }),
  z.strictObject({ status: z.literal("AUTHORITY_MISMATCH") }),
  z.strictObject({ status: z.literal("INVALID_COMMIT") })
]);

function persistenceFailure(path: string, message: string): SessionCommandIssue[] {
  return [createSessionCommandIssue({
    code: "SESSION_PERSISTENCE_FAILURE",
    path,
    message
  })];
}

function rpcFailure(path: string, error: PostgresRpcError): SessionCommandIssue[] {
  const safeCode = error.code === undefined ? "" : ` (${error.code})`;
  return persistenceFailure(path, `Persistent Session operation failed${safeCode}: ${error.message}`);
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function validateLoadedAuthority(
  response: z.infer<typeof LoadedResponseSchema>
): SessionCommandIssue[] {
  if (!exactJson(response.events, response.aggregate.committed_events)) {
    return persistenceFailure(
      "$.persistence.events",
      "Durable Event rows do not match the authoritative Session aggregate."
    );
  }
  if (!exactJson(response.commands, response.aggregate.idempotency_records)) {
    return persistenceFailure(
      "$.persistence.commands",
      "Durable replay rows do not match the authoritative Session aggregate."
    );
  }
  if (response.checkpoint !== null && !exactJson(response.checkpoint, response.aggregate)) {
    return persistenceFailure(
      "$.persistence.checkpoint",
      "Latest durable checkpoint does not match the authoritative Session aggregate."
    );
  }
  return [];
}

function statusFailure(
  status: Exclude<z.infer<typeof CommitResponseSchema>["status"], "COMMITTED">
): SessionCommandIssue[] {
  switch (status) {
    case "NOT_FOUND":
      return [createSessionCommandIssue({
        code: "SESSION_NOT_FOUND",
        path: "$.session_id",
        message: "Authoritative Session was not found."
      })];
    case "VERSION_CONFLICT":
      return [createSessionCommandIssue({
        code: "SESSION_VERSION_CONFLICT",
        path: "$.expected_token",
        message: "Persistent Session changed after it was loaded."
      })];
    case "IDEMPOTENCY_CONFLICT":
      return [createSessionCommandIssue({
        code: "IDEMPOTENCY_CONFLICT",
        path: "$.proposed_session.idempotency_records",
        message: "Persistent idempotency identity conflicts with a prior committed command."
      })];
    case "AUTHORITY_MISMATCH":
      return [createSessionCommandIssue({
        code: "SESSION_AUTHORITY_MISMATCH",
        path: "$.proposed_session.pinned_case",
        message: "Persistent Session authority or pinned artifact identity cannot be rebound."
      })];
    case "INVALID_COMMIT":
      return persistenceFailure(
        "$.proposed_session",
        "Persistent commit did not preserve the authoritative append-only Session shape."
      );
  }
}

function asRpcObject(value: unknown): JsonObject {
  return JsonObjectSchema.parse(value);
}

/**
 * Persistent implementation of the unchanged V2-006 storage-neutral adapter.
 * PostgreSQL owns locking and atomic persistence; all clinical computation has
 * already completed before this boundary is called.
 */
export class PostgresSessionCommitAdapter implements SessionCommitAdapter {
  readonly #client: PostgresSessionRpcClient;

  constructor(client: PostgresSessionRpcClient) {
    this.#client = client;
  }

  async load(sessionIdInput: unknown): Promise<SessionAdapterLoadResult> {
    const sessionId = SessionIdSchema.safeParse(sessionIdInput);
    if (!sessionId.success) {
      return {
        success: false,
        issues: persistenceFailure("$.session_id", "Persistent Session identifier is invalid.")
      };
    }
    let result: PostgresRpcResult;
    try {
      result = await this.#client.rpc(
        POSTGRES_SESSION_LOAD_FUNCTION,
        asRpcObject({ p_session_id: sessionId.data })
      );
    } catch {
      return {
        success: false,
        issues: persistenceFailure("$.persistence.load", "Persistent Session load failed.")
      };
    }
    if (result.error !== null) return { success: false, issues: rpcFailure("$.persistence.load", result.error) };
    if (result.data !== null
      && typeof result.data === "object"
      && "status" in result.data
      && result.data.status === "NOT_FOUND") {
      return {
        success: false,
        issues: [createSessionCommandIssue({
          code: "SESSION_NOT_FOUND",
          path: "$.session_id",
          message: "Authoritative Session was not found."
        })]
      };
    }
    const loaded = LoadedResponseSchema.safeParse(result.data);
    if (!loaded.success) {
      return { success: false, issues: persistenceFailure(
        "$.persistence.load",
        "Persistent Session load returned malformed authoritative data."
      ) };
    }
    const integrityIssues = validateLoadedAuthority(loaded.data);
    if (integrityIssues.length > 0) return { success: false, issues: integrityIssues };
    return {
      success: true,
      issues: [],
      session: loaded.data.aggregate,
      commit_token: createSessionCommitToken(loaded.data.aggregate)
    };
  }

  async commit(input: unknown): Promise<SessionAdapterCommitResult> {
    const request = SessionAdapterCommitRequestSchema.safeParse(input);
    if (!request.success) {
      return {
        success: false,
        issues: persistenceFailure("$.commit", "Persistent Session commit request is invalid.")
      };
    }
    let result: PostgresRpcResult;
    try {
      result = await this.#client.rpc(
        POSTGRES_SESSION_COMMIT_FUNCTION,
        asRpcObject({ p_request: request.data })
      );
    } catch {
      return {
        success: false,
        issues: persistenceFailure("$.persistence.commit", "Persistent Session commit failed.")
      };
    }
    if (result.error !== null) {
      return { success: false, issues: rpcFailure("$.persistence.commit", result.error) };
    }
    const response = CommitResponseSchema.safeParse(result.data);
    if (!response.success) {
      return {
        success: false,
        issues: persistenceFailure(
          "$.persistence.commit",
          "Persistent Session commit returned a malformed result."
        )
      };
    }
    if (response.data.status !== "COMMITTED") {
      return { success: false, issues: statusFailure(response.data.status) };
    }
    if (response.data.aggregate.session_id !== request.data.session_id) {
      return {
        success: false,
        issues: persistenceFailure(
          "$.persistence.commit.aggregate.session_id",
          "Persistent commit returned the wrong Session identity."
        )
      };
    }
    return {
      success: true,
      issues: [],
      session: response.data.aggregate,
      commit_token: createSessionCommitToken(response.data.aggregate)
    };
  }
}

export function createPostgresSessionCommitAdapter(
  client: PostgresSessionRpcClient
): SessionCommitAdapter {
  return new PostgresSessionCommitAdapter(client);
}
