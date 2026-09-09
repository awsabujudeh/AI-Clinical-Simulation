import { z } from "zod";

import {
  ConversationTurnIdSchema,
  EventIdSchema,
  Sha256DigestSchema,
  IdempotencyKeySchema,
  PatientConversationContextSchema,
  PatientConversationTranscriptSchema,
  PatientConversationTurnSchema,
  RealUtcTimeSchema,
  SessionIdSchema,
  type PatientConversationContext,
  type PatientConversationTranscript,
  type PatientConversationTurn
} from "../../../contracts/src/index.ts";
import {
  InMemorySessionAggregateSchema,
  SessionCommitTokenSchema
} from "../../../session-engine/src/index.ts";

const PrincipalUserIdSchema = z.string().uuid();
const MembershipIdSchema = z.string().min(1).max(160);
const InstitutionIdSchema = z.string().min(2).max(64);
export const PatientConversationClaimTokenSchema = z.string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u);

export const PatientConversationBeginRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  principal_user_id: PrincipalUserIdSchema,
  membership_id: MembershipIdSchema,
  institution_id: InstitutionIdSchema,
  idempotency_key: IdempotencyKeySchema,
  canonical_request_hash: Sha256DigestSchema,
  turn_id: ConversationTurnIdSchema,
  question_event_id: EventIdSchema,
  claim_token: PatientConversationClaimTokenSchema,
  claimed_at_utc: RealUtcTimeSchema,
  claim_expires_at_utc: RealUtcTimeSchema,
  context: PatientConversationContextSchema,
  question: z.strictObject({
    text: z.string().trim().min(1).max(4_000),
    locale: PatientConversationContextSchema.shape.locale,
    source: z.enum(["TEXT", "STT"]),
    utterance_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
  }),
  expected_token: SessionCommitTokenSchema,
  proposed_session: InMemorySessionAggregateSchema
});
export type PatientConversationBeginRequest = z.infer<
  typeof PatientConversationBeginRequestSchema
>;

export type PatientConversationBeginResult =
  | Readonly<{
      success: true;
      status: "CLAIMED";
      turn_id: string;
      turn_sequence: number;
      question_event_id: string;
      context: PatientConversationContext;
    }>
  | Readonly<{
      success: true;
      status: "REPLAYED";
      turn: PatientConversationTurn;
    }>
  | Readonly<{
      success: false;
      code:
        | "IN_PROGRESS"
        | "IDEMPOTENCY_CONFLICT"
        | "VERSION_CONFLICT"
        | "SESSION_ENDED"
        | "NOT_AUTHORIZED"
        | "NOT_FOUND"
        | "INVALID_REQUEST"
        | "PERSISTENCE_FAILURE";
    }>;

export const PatientConversationCompleteRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  principal_user_id: PrincipalUserIdSchema,
  idempotency_key: IdempotencyKeySchema,
  canonical_request_hash: Sha256DigestSchema,
  claim_token: PatientConversationClaimTokenSchema,
  completed_at_utc: RealUtcTimeSchema,
  turn: PatientConversationTurnSchema,
  expected_token: SessionCommitTokenSchema,
  proposed_session: InMemorySessionAggregateSchema
});
export type PatientConversationCompleteRequest = z.infer<
  typeof PatientConversationCompleteRequestSchema
>;

export type PatientConversationCompleteResult =
  | Readonly<{ success: true; status: "COMMITTED" | "REPLAYED"; turn: PatientConversationTurn }>
  | Readonly<{
      success: false;
      code:
        | "CLAIM_NOT_FOUND"
        | "CLAIM_MISMATCH"
        | "IDEMPOTENCY_CONFLICT"
        | "VERSION_CONFLICT"
        | "SESSION_ENDED"
        | "NOT_AUTHORIZED"
        | "NOT_FOUND"
        | "INVALID_REQUEST"
        | "PERSISTENCE_FAILURE";
    }>;

export type PatientConversationListResult =
  | Readonly<{ success: true; transcript: PatientConversationTranscript }>
  | Readonly<{
      success: false;
      code: "NOT_AUTHORIZED" | "NOT_FOUND" | "INVALID_REQUEST" | "PERSISTENCE_FAILURE";
    }>;

export interface PatientConversationRepository {
  begin(input: PatientConversationBeginRequest): Promise<PatientConversationBeginResult>;
  complete(input: PatientConversationCompleteRequest): Promise<PatientConversationCompleteResult>;
  list(input: {
    session_id: string;
    principal_user_id: string;
    limit: number;
  }): Promise<PatientConversationListResult>;
}

export function parseTranscript(input: unknown): PatientConversationTranscript | undefined {
  const parsed = PatientConversationTranscriptSchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}
