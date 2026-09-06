import { z } from "zod";

import { canonicalSerialize } from "../../case-schema/src/index.ts";
import {
  InDoubtRecoveryJournalEntrySchema,
  MUTATION_RECONCILIATION_MAX_ATTEMPTS,
  RECOVERY_SCHEMA_VERSION,
  RecoveryJournalEntryIdSchema,
  RecoveryMutationRequestSchema,
  type InDoubtRecoveryJournalEntry,
  type RecoveryMutationRequest,
  type RecoveryPrincipalId
} from "../../contracts/src/index.ts";

export type RecoveryHttpRequest = Readonly<{
  method: "GET" | "POST";
  path: string;
  headers: Readonly<Record<string, string>>;
  body?: string;
}>;

export type RecoveryTransportResult =
  | Readonly<{ kind: "HTTP_RESPONSE"; status: number; body: unknown }>
  | Readonly<{
      kind: "NOT_SENT";
      failure: "KNOWN_OFFLINE" | "REQUEST_CONSTRUCTION_FAILURE";
    }>
  | Readonly<{
      kind: "AMBIGUOUS_TRANSPORT_FAILURE";
      failure: "BEFORE_RESPONSE_CERTAINTY" | "UNEXPECTED_NETWORK_FAILURE";
    }>;

/** The implementation is authenticated externally; no token enters recovery data. */
export interface RecoveryTransport {
  send(request: RecoveryHttpRequest): Promise<RecoveryTransportResult>;
}

export function canonicalRecoveryRequest(request: RecoveryMutationRequest): string {
  return canonicalSerialize(request);
}

export function recoveryJournalEntryId(
  principalUserId: RecoveryPrincipalId,
  request: RecoveryMutationRequest
) {
  return RecoveryJournalEntryIdSchema.parse(
    `recovery:${principalUserId}:${request.operation}:${request.idempotency_key}`
  );
}

export function mutationRequestPath(request: RecoveryMutationRequest): string {
  if (request.operation === "START_SESSION") return "/v1/sessions";
  if (request.operation === "PROPOSE_ACTION") {
    return `/v1/sessions/${encodeURIComponent(request.session_id)}/actions/propose`;
  }
  return `/v1/sessions/${encodeURIComponent(request.session_id)}/end`;
}

export function toMutationHttpRequest(
  request: RecoveryMutationRequest
): RecoveryHttpRequest {
  return Object.freeze({
    method: "POST",
    path: mutationRequestPath(request),
    headers: Object.freeze({
      "Content-Type": "application/json",
      "X-Api-Schema-Version": request.api_schema_version,
      "X-Request-Id": request.request_id,
      "X-Correlation-Id": request.correlation_id,
      "Idempotency-Key": request.idempotency_key
    }),
    body: canonicalSerialize(request.request)
  });
}

export function createInDoubtEntry(input: {
  principal_user_id: RecoveryPrincipalId;
  request: RecoveryMutationRequest;
  attempted_at_utc: string;
}): InDoubtRecoveryJournalEntry | undefined {
  const parsed = InDoubtRecoveryJournalEntrySchema.safeParse({
    recovery_schema_version: RECOVERY_SCHEMA_VERSION,
    journal_entry_id: recoveryJournalEntryId(input.principal_user_id, input.request),
    principal_user_id: input.principal_user_id,
    ...(input.request.operation === "START_SESSION"
      ? {}
      : { session_id: input.request.session_id }),
    delivery_state: "IN_DOUBT",
    request: input.request,
    canonical_request: canonicalRecoveryRequest(input.request),
    attempt_count: 1,
    maximum_attempts: MUTATION_RECONCILIATION_MAX_ATTEMPTS,
    created_at_utc: input.attempted_at_utc,
    last_attempt_at_utc: input.attempted_at_utc
  });
  return parsed.success ? parsed.data : undefined;
}

export type ValidatedStoredEntry =
  | { success: true; entry: InDoubtRecoveryJournalEntry }
  | { success: false; reason: "SCHEMA_INVALID" | "CANONICAL_REQUEST_MISMATCH" };

export function validateStoredEntry(input: unknown): ValidatedStoredEntry {
  const parsed = InDoubtRecoveryJournalEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, reason: "SCHEMA_INVALID" };
  return canonicalRecoveryRequest(parsed.data.request) === parsed.data.canonical_request
    ? { success: true, entry: parsed.data }
    : { success: false, reason: "CANONICAL_REQUEST_MISMATCH" };
}

export function incrementRecoveryAttempt(
  entry: InDoubtRecoveryJournalEntry,
  attemptedAtUtc: unknown
): InDoubtRecoveryJournalEntry | undefined {
  if (entry.attempt_count >= entry.maximum_attempts) return undefined;
  const parsedTime = z.string().safeParse(attemptedAtUtc);
  if (!parsedTime.success) return undefined;
  const parsed = InDoubtRecoveryJournalEntrySchema.safeParse({
    ...entry,
    attempt_count: entry.attempt_count + 1,
    last_attempt_at_utc: parsedTime.data
  });
  return parsed.success ? parsed.data : undefined;
}

export function parseRecoveryMutationRequest(input: unknown) {
  return RecoveryMutationRequestSchema.safeParse(input);
}
