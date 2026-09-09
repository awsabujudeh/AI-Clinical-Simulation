import { z } from "zod";

import {
  JsonObjectSchema,
  PatientConversationContextSchema,
  PatientConversationTranscriptSchema,
  PatientConversationTurnSchema,
  type JsonObject
} from "../../../contracts/src/index.ts";
import type { PostgresSessionRpcClient } from "../../../session-engine/src/index.ts";

import {
  PatientConversationBeginRequestSchema,
  PatientConversationCompleteRequestSchema,
  type PatientConversationBeginResult,
  type PatientConversationCompleteResult,
  type PatientConversationListResult,
  type PatientConversationRepository
} from "./repository.ts";

export const POSTGRES_PATIENT_CONVERSATION_BEGIN_FUNCTION =
  "begin_patient_conversation_v2_019a" as const;
export const POSTGRES_PATIENT_CONVERSATION_COMPLETE_FUNCTION =
  "complete_patient_conversation_v2_019a" as const;
export const POSTGRES_PATIENT_CONVERSATION_LIST_FUNCTION =
  "list_patient_conversation_v2_019a" as const;

const BeginResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("CLAIMED"),
    turn_id: z.string(),
    turn_sequence: z.number().int().positive(),
    question_event_id: z.string().uuid(),
    context: PatientConversationContextSchema
  }),
  z.strictObject({ status: z.literal("REPLAYED"), turn: PatientConversationTurnSchema }),
  z.strictObject({ status: z.enum([
    "IN_PROGRESS",
    "IDEMPOTENCY_CONFLICT",
    "VERSION_CONFLICT",
    "SESSION_ENDED",
    "NOT_AUTHORIZED",
    "NOT_FOUND",
    "INVALID_REQUEST"
  ]) })
]);

const CompleteResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.enum(["COMMITTED", "REPLAYED"]), turn: PatientConversationTurnSchema }),
  z.strictObject({ status: z.enum([
    "CLAIM_NOT_FOUND",
    "CLAIM_MISMATCH",
    "IDEMPOTENCY_CONFLICT",
    "VERSION_CONFLICT",
    "SESSION_ENDED",
    "NOT_AUTHORIZED",
    "NOT_FOUND",
    "INVALID_REQUEST"
  ]) })
]);

const ListResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("LOADED"), transcript: PatientConversationTranscriptSchema }),
  z.strictObject({ status: z.enum(["NOT_AUTHORIZED", "NOT_FOUND", "INVALID_REQUEST"]) })
]);

function rpcObject(value: unknown): JsonObject {
  return JsonObjectSchema.parse(value);
}

export class PostgresPatientConversationRepository implements PatientConversationRepository {
  readonly #client: PostgresSessionRpcClient;

  constructor(client: PostgresSessionRpcClient) {
    this.#client = client;
  }

  async begin(input: Parameters<PatientConversationRepository["begin"]>[0]): Promise<PatientConversationBeginResult> {
    const parsed = PatientConversationBeginRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "INVALID_REQUEST" };
    try {
      const result = await this.#client.rpc(
        POSTGRES_PATIENT_CONVERSATION_BEGIN_FUNCTION,
        { p_request: rpcObject(parsed.data) }
      );
      if (result.error !== null) return { success: false, code: "PERSISTENCE_FAILURE" };
      const response = BeginResponseSchema.safeParse(result.data);
      if (!response.success) return { success: false, code: "PERSISTENCE_FAILURE" };
      if (response.data.status === "CLAIMED") {
        return { success: true, ...response.data };
      }
      if (response.data.status === "REPLAYED") {
        return { success: true, ...response.data };
      }
      return { success: false, code: response.data.status };
    } catch {
      return { success: false, code: "PERSISTENCE_FAILURE" };
    }
  }

  async complete(input: Parameters<PatientConversationRepository["complete"]>[0]): Promise<PatientConversationCompleteResult> {
    const parsed = PatientConversationCompleteRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "INVALID_REQUEST" };
    try {
      const result = await this.#client.rpc(
        POSTGRES_PATIENT_CONVERSATION_COMPLETE_FUNCTION,
        { p_request: rpcObject(parsed.data) }
      );
      if (result.error !== null) return { success: false, code: "PERSISTENCE_FAILURE" };
      const response = CompleteResponseSchema.safeParse(result.data);
      if (!response.success) return { success: false, code: "PERSISTENCE_FAILURE" };
      return response.data.status === "COMMITTED" || response.data.status === "REPLAYED"
        ? { success: true, status: response.data.status, turn: response.data.turn }
        : { success: false, code: response.data.status };
    } catch {
      return { success: false, code: "PERSISTENCE_FAILURE" };
    }
  }

  async list(input: Parameters<PatientConversationRepository["list"]>[0]): Promise<PatientConversationListResult> {
    try {
      const result = await this.#client.rpc(
        POSTGRES_PATIENT_CONVERSATION_LIST_FUNCTION,
        rpcObject({
          p_session_id: input.session_id,
          p_principal_user_id: input.principal_user_id,
          p_limit: input.limit
        })
      );
      if (result.error !== null) return { success: false, code: "PERSISTENCE_FAILURE" };
      const response = ListResponseSchema.safeParse(result.data);
      if (!response.success) return { success: false, code: "PERSISTENCE_FAILURE" };
      return response.data.status === "LOADED"
        ? { success: true, transcript: response.data.transcript }
        : { success: false, code: response.data.status };
    } catch {
      return { success: false, code: "PERSISTENCE_FAILURE" };
    }
  }
}
