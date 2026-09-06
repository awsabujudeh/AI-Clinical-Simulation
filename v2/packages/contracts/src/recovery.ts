import { z } from "zod";

import {
  EndSimulationRequestSchema,
  SafeSessionProjectionSchema,
  StartSessionRequestSchema,
  SubmitClinicalActionRequestSchema
} from "./api-v1.ts";
import { RealUtcTimeSchema } from "./events.ts";
import {
  CorrelationIdSchema,
  IdempotencyKeySchema,
  RequestIdSchema,
  SessionIdSchema
} from "./ids.ts";

export const RECOVERY_SCHEMA_VERSION = "1.0" as const;
export const MUTATION_RECONCILIATION_MAX_ATTEMPTS = 3 as const;
export const RECOVERY_JOURNAL_MAX_ENTRIES = 64 as const;

export const RecoveryPrincipalIdSchema = z.uuid().brand<"RecoveryPrincipalId">();
export type RecoveryPrincipalId = z.infer<typeof RecoveryPrincipalIdSchema>;

export const ConnectivityStateSchema = z.enum([
  "ONLINE",
  "OFFLINE_OR_UNREACHABLE",
  "RECOVERING",
  "SYNC_REQUIRED"
]);
export type ConnectivityState = z.infer<typeof ConnectivityStateSchema>;

export const ConnectivitySignalSchema = z.enum([
  "NAVIGATOR_REPORTED_ONLINE",
  "NAVIGATOR_REPORTED_OFFLINE",
  "REQUEST_SUCCEEDED",
  "REQUEST_FAILED_AMBIGUOUSLY",
  "RECOVERY_STARTED",
  "AUTHORITATIVE_SYNC_REQUIRED",
  "AUTHORITATIVE_SYNC_COMPLETED"
]);
export type ConnectivitySignal = z.infer<typeof ConnectivitySignalSchema>;

const RecoveryMutationCommonShape = {
  recovery_schema_version: z.literal(RECOVERY_SCHEMA_VERSION),
  api_schema_version: z.literal("1.0"),
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  idempotency_key: IdempotencyKeySchema
};

export const RecoveryMutationRequestSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    ...RecoveryMutationCommonShape,
    operation: z.literal("START_SESSION"),
    request: StartSessionRequestSchema
  }),
  z.strictObject({
    ...RecoveryMutationCommonShape,
    operation: z.literal("PROPOSE_ACTION"),
    session_id: SessionIdSchema,
    request: SubmitClinicalActionRequestSchema
  }),
  z.strictObject({
    ...RecoveryMutationCommonShape,
    operation: z.literal("END_SESSION"),
    session_id: SessionIdSchema,
    request: EndSimulationRequestSchema
  })
]);
export type RecoveryMutationRequest = z.infer<typeof RecoveryMutationRequestSchema>;

export const RecoveryJournalEntryIdSchema = z.string()
  .min(8)
  .max(384)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
  .brand<"RecoveryJournalEntryId">();
export type RecoveryJournalEntryId = z.infer<typeof RecoveryJournalEntryIdSchema>;

export const InDoubtRecoveryJournalEntrySchema = z.strictObject({
  recovery_schema_version: z.literal(RECOVERY_SCHEMA_VERSION),
  journal_entry_id: RecoveryJournalEntryIdSchema,
  principal_user_id: RecoveryPrincipalIdSchema,
  session_id: SessionIdSchema.optional(),
  delivery_state: z.literal("IN_DOUBT"),
  request: RecoveryMutationRequestSchema,
  canonical_request: z.string().min(2).max(32_768),
  attempt_count: z.number().int().min(1).max(MUTATION_RECONCILIATION_MAX_ATTEMPTS),
  maximum_attempts: z.literal(MUTATION_RECONCILIATION_MAX_ATTEMPTS),
  created_at_utc: RealUtcTimeSchema,
  last_attempt_at_utc: RealUtcTimeSchema
}).superRefine((entry, context) => {
  const requestSessionId = "session_id" in entry.request
    ? entry.request.session_id
    : undefined;
  if (requestSessionId !== entry.session_id) {
    context.addIssue({
      code: "custom",
      path: ["session_id"],
      message: "Journal Session identity must match the exact mutation request."
    });
  }
});
export type InDoubtRecoveryJournalEntry = z.infer<
  typeof InDoubtRecoveryJournalEntrySchema
>;

export const RecoveryResolutionStatusSchema = z.enum([
  "NOT_SENT",
  "IN_DOUBT",
  "CONFIRMED_SUCCESS",
  "CONFIRMED_REJECTION",
  "STALE_NOT_EXECUTED",
  "IDEMPOTENCY_CONFLICT",
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_DENIED",
  "DEPENDENCY_UNAVAILABLE",
  "RETRY_LIMIT_REACHED",
  "UNRECOVERABLE_INVALID_LOCAL_RECORD"
]);
export type RecoveryResolutionStatus = z.infer<
  typeof RecoveryResolutionStatusSchema
>;

export const RecoveryIssueCodeSchema = z.enum([
  "INVALID_RECOVERY_INPUT",
  "REQUEST_NOT_SENT",
  "REQUEST_IN_DOUBT",
  "LOCAL_STORAGE_FAILURE",
  "LOCAL_RECORD_INVALID",
  "LOCAL_IDEMPOTENCY_CONFLICT",
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_DENIED",
  "SESSION_VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "DEPENDENCY_UNAVAILABLE",
  "HTTP_REQUEST_REJECTED",
  "HTTP_RESPONSE_INVALID",
  "RETRY_LIMIT_REACHED"
]);
export type RecoveryIssueCode = z.infer<typeof RecoveryIssueCodeSchema>;

export const RecoveryIssueSchema = z.strictObject({
  code: RecoveryIssueCodeSchema,
  message_key: z.string().min(3).max(160),
  retryable: z.boolean()
});
export type RecoveryIssue = z.infer<typeof RecoveryIssueSchema>;

export const RecoveryMutationOutcomeSchema = z.strictObject({
  recovery_schema_version: z.literal(RECOVERY_SCHEMA_VERSION),
  operation: z.enum(["START_SESSION", "PROPOSE_ACTION", "END_SESSION"]),
  idempotency_key: IdempotencyKeySchema,
  status: RecoveryResolutionStatusSchema,
  requires_authoritative_sync: z.boolean(),
  replayed: z.boolean().optional(),
  http_status: z.number().int().min(100).max(599).optional(),
  server_error_code: z.string().min(1).max(160).optional(),
  issue: RecoveryIssueSchema.optional()
});
export type RecoveryMutationOutcome = z.infer<
  typeof RecoveryMutationOutcomeSchema
>;

export const LastKnownSafeSessionProjectionSchema = z.strictObject({
  recovery_schema_version: z.literal(RECOVERY_SCHEMA_VERSION),
  principal_user_id: RecoveryPrincipalIdSchema,
  session_id: SessionIdSchema,
  freshness: z.literal("STALE_LAST_KNOWN"),
  mutation_authority: z.literal("NONE"),
  captured_at_utc: RealUtcTimeSchema,
  projection: SafeSessionProjectionSchema
}).superRefine((value, context) => {
  if (value.projection.session_id !== value.session_id) {
    context.addIssue({
      code: "custom",
      path: ["projection", "session_id"],
      message: "Cached safe projection must match its scoped Session identity."
    });
  }
});
export type LastKnownSafeSessionProjection = z.infer<
  typeof LastKnownSafeSessionProjectionSchema
>;

export const RecoveryTelemetryCodeSchema = z.enum([
  "NETWORK_UNREACHABLE",
  "REQUEST_IN_DOUBT",
  "RECONCILIATION_REPLAYED",
  "RECONCILIATION_STALE",
  "LOCAL_RECORD_INVALID"
]);
export type RecoveryTelemetryCode = z.infer<typeof RecoveryTelemetryCodeSchema>;

export const RecoveryTelemetryEventSchema = z.strictObject({
  recovery_schema_version: z.literal(RECOVERY_SCHEMA_VERSION),
  code: RecoveryTelemetryCodeSchema,
  principal_user_id: RecoveryPrincipalIdSchema,
  session_id: SessionIdSchema.optional(),
  operation: z.enum(["START_SESSION", "PROPOSE_ACTION", "END_SESSION"]).optional(),
  idempotency_key: IdempotencyKeySchema.optional()
});
export type RecoveryTelemetryEvent = z.infer<typeof RecoveryTelemetryEventSchema>;
