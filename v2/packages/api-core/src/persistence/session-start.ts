import { z } from "zod";

import {
  IdempotencyKeySchema,
  Sha256DigestSchema
} from "../../../contracts/src/index.ts";
import {
  InMemorySessionAggregateSchema,
  type InMemorySessionAggregate,
  type PostgresSessionRpcClient
} from "../../../session-engine/src/index.ts";

export const POSTGRES_SESSION_START_FUNCTION =
  "start_authoritative_session_v2_013" as const;
export const POSTGRES_SESSION_COMMIT_FUNCTION_V2_013 =
  "commit_authoritative_session_v2_013" as const;

export const SessionStartCommitRequestSchema = z.strictObject({
  aggregate: InMemorySessionAggregateSchema,
  principal_user_id: z.uuid(),
  membership_id: z.string().min(1).max(160),
  institution_id: z.string().min(2).max(64),
  idempotency_key: IdempotencyKeySchema,
  request_hash: Sha256DigestSchema
});
export type SessionStartCommitRequest = z.infer<
  typeof SessionStartCommitRequestSchema
>;

export type SessionStartCommitResult =
  | {
      success: true;
      status: "CREATED" | "REPLAYED";
      session: InMemorySessionAggregate;
    }
  | {
      success: false;
      code:
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_AUTHORIZED"
        | "INVALID_START"
        | "PERSISTENCE_UNAVAILABLE";
    };

export interface SessionStartRepository {
  start(input: unknown): Promise<SessionStartCommitResult>;
}

const StartRpcResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.enum(["CREATED", "REPLAYED"]),
    aggregate: InMemorySessionAggregateSchema
  }),
  z.strictObject({ status: z.literal("IDEMPOTENCY_CONFLICT") }),
  z.strictObject({ status: z.literal("UNAUTHORIZED") }),
  z.strictObject({ status: z.literal("INVALID_START") })
]);

export class PostgresSessionStartRepository implements SessionStartRepository {
  readonly #client: PostgresSessionRpcClient;

  constructor(client: PostgresSessionRpcClient) {
    this.#client = client;
  }

  async start(input: unknown): Promise<SessionStartCommitResult> {
    const request = SessionStartCommitRequestSchema.safeParse(input);
    if (!request.success) return { success: false, code: "INVALID_START" };
    try {
      const rpc = await this.#client.rpc(POSTGRES_SESSION_START_FUNCTION, {
        p_request: request.data
      });
      if (rpc.error !== null) return { success: false, code: "PERSISTENCE_UNAVAILABLE" };
      const response = StartRpcResponseSchema.safeParse(rpc.data);
      if (!response.success) return { success: false, code: "PERSISTENCE_UNAVAILABLE" };
      if (response.data.status === "CREATED" || response.data.status === "REPLAYED") {
        return {
          success: true,
          status: response.data.status,
          session: response.data.aggregate
        };
      }
      if (response.data.status === "IDEMPOTENCY_CONFLICT") {
        return { success: false, code: "IDEMPOTENCY_CONFLICT" };
      }
      return response.data.status === "UNAUTHORIZED"
        ? { success: false, code: "NOT_AUTHORIZED" }
        : { success: false, code: "INVALID_START" };
    } catch {
      return { success: false, code: "PERSISTENCE_UNAVAILABLE" };
    }
  }
}
