import { z } from "zod";

import {
  ApiErrorResponseSchema,
  ConnectivityStateSchema,
  EndSimulationResponseDataSchema,
  InDoubtRecoveryJournalEntrySchema,
  LastKnownSafeSessionProjectionSchema,
  RECOVERY_SCHEMA_VERSION,
  RealUtcTimeSchema,
  RequestIdSchema,
  CorrelationIdSchema,
  RecoveryJournalEntryIdSchema,
  RecoveryMutationOutcomeSchema,
  RecoveryMutationRequestSchema,
  RecoveryPrincipalIdSchema,
  SafeSessionProjectionSchema,
  SessionIdSchema,
  StartSessionResponseDataSchema,
  SubmitClinicalActionResponseDataSchema,
  createApiV1SuccessEnvelopeSchema,
  type InDoubtRecoveryJournalEntry,
  type RecoveryIssue,
  type RecoveryMutationOutcome,
  type RecoveryMutationRequest,
  type RecoveryPrincipalId
} from "../../contracts/src/index.ts";
import { BoundedInFlightRegistry } from "./in-flight.ts";
import {
  canonicalRecoveryRequest,
  createInDoubtEntry,
  incrementRecoveryAttempt,
  recoveryJournalEntryId,
  toMutationHttpRequest,
  validateStoredEntry,
  type RecoveryHttpRequest,
  type RecoveryTransport,
  type RecoveryTransportResult
} from "./request.ts";
import {
  READ_RETRY_MAX_ATTEMPTS,
  classifyApiResponse,
  readRetryDelayMilliseconds,
  shouldRetrySafeRead
} from "./retry.ts";
import type {
  RecoveryStorageAdapter,
  RecoveryStorageWriteResult
} from "./storage.ts";

const SubmitMutationInputSchema = z.strictObject({
  principal_user_id: RecoveryPrincipalIdSchema,
  connectivity_state: ConnectivityStateSchema,
  attempted_at_utc: RealUtcTimeSchema,
  request: RecoveryMutationRequestSchema
});

const ReconcileInputSchema = z.strictObject({
  principal_user_id: RecoveryPrincipalIdSchema,
  journal_entry_id: RecoveryJournalEntryIdSchema,
  attempted_at_utc: RealUtcTimeSchema,
  authentication_state: z.enum(["VERIFIED", "MISSING"])
});

const RecoverSessionInputSchema = z.strictObject({
  principal_user_id: RecoveryPrincipalIdSchema,
  session_id: SessionIdSchema,
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  observed_at_utc: RealUtcTimeSchema,
  authentication_state: z.enum(["VERIFIED", "MISSING"])
});

const successSchemas = {
  START_SESSION: createApiV1SuccessEnvelopeSchema(StartSessionResponseDataSchema),
  PROPOSE_ACTION: createApiV1SuccessEnvelopeSchema(SubmitClinicalActionResponseDataSchema),
  END_SESSION: createApiV1SuccessEnvelopeSchema(EndSimulationResponseDataSchema)
} as const;

const SafeSessionEnvelopeSchema = createApiV1SuccessEnvelopeSchema(
  SafeSessionProjectionSchema
);

export type RecoveryCoordinatorFailure = Readonly<{
  success: false;
  issue: RecoveryIssue;
  outcome?: RecoveryMutationOutcome;
}>;

export type RecoveryCoordinatorSuccess = Readonly<{
  success: true;
  outcome: RecoveryMutationOutcome;
  response?: unknown;
}>;

export type RecoveryMutationResult = RecoveryCoordinatorFailure | RecoveryCoordinatorSuccess;

export type SessionRecoveryResult =
  | Readonly<{
      success: true;
      connectivity_state: "ONLINE" | "SYNC_REQUIRED";
      authoritative_projection: z.infer<typeof SafeSessionProjectionSchema>;
      reconciliation_results: readonly RecoveryMutationResult[];
    }>
  | Readonly<{
      success: true;
      connectivity_state: "OFFLINE_OR_UNREACHABLE";
      last_known_projection: z.infer<typeof LastKnownSafeSessionProjectionSchema>;
      reconciliation_results: readonly [];
    }>
  | RecoveryCoordinatorFailure;

export interface RecoveryDelayAdapter {
  wait(milliseconds: number): Promise<void>;
}

export type RecoveryCoordinatorDependencies = Readonly<{
  storage: RecoveryStorageAdapter;
  transport: RecoveryTransport;
  delay: RecoveryDelayAdapter;
  in_flight?: BoundedInFlightRegistry;
}>;

function issue(
  code: RecoveryIssue["code"],
  messageKey: string,
  retryable: boolean
): RecoveryIssue {
  return { code, message_key: messageKey, retryable };
}

function outcome(input: Omit<RecoveryMutationOutcome, "recovery_schema_version">) {
  return RecoveryMutationOutcomeSchema.parse({
    recovery_schema_version: RECOVERY_SCHEMA_VERSION,
    ...input
  });
}

function baseOutcome(
  request: RecoveryMutationRequest,
  status: RecoveryMutationOutcome["status"],
  requiresAuthoritativeSync: boolean,
  details: Partial<RecoveryMutationOutcome> = {}
) {
  return outcome({
    operation: request.operation,
    idempotency_key: request.idempotency_key,
    status,
    requires_authoritative_sync: requiresAuthoritativeSync,
    ...details
  });
}

function parseMutationSuccess(
  request: RecoveryMutationRequest,
  transport: Extract<RecoveryTransportResult, { kind: "HTTP_RESPONSE" }>
) {
  if (transport.status < 200 || transport.status >= 300) return undefined;
  const parsed = successSchemas[request.operation].safeParse(transport.body);
  return parsed.success ? parsed.data : undefined;
}

function parseServerError(
  transport: Extract<RecoveryTransportResult, { kind: "HTTP_RESPONSE" }>
) {
  const parsed = ApiErrorResponseSchema.safeParse(transport.body);
  return parsed.success ? parsed.data.error : undefined;
}

function sessionReadRequest(input: {
  session_id: string;
  request_id: string;
  correlation_id: string;
}): RecoveryHttpRequest {
  return Object.freeze({
    method: "GET",
    path: `/v1/sessions/${encodeURIComponent(input.session_id)}/state`,
    headers: Object.freeze({
      "X-Api-Schema-Version": "1.0",
      "X-Request-Id": input.request_id,
      "X-Correlation-Id": input.correlation_id
    })
  });
}

export function createRecoveryCoordinator(dependencies: RecoveryCoordinatorDependencies) {
  const inFlight = dependencies.in_flight ?? new BoundedInFlightRegistry();

  async function safelyDelete(entry: InDoubtRecoveryJournalEntry) {
    try {
      await dependencies.storage.deleteJournalEntry(entry.journal_entry_id);
      return true;
    } catch {
      return false;
    }
  }

  async function safelyWriteJournal(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<RecoveryStorageWriteResult> {
    try {
      return await dependencies.storage.writeJournalEntry(entry);
    } catch {
      return { success: false, code: "STORAGE_FAILURE" };
    }
  }

  async function safelyWriteProjection(
    projection: z.infer<typeof LastKnownSafeSessionProjectionSchema>
  ): Promise<RecoveryStorageWriteResult> {
    try {
      return await dependencies.storage.writeLastKnownProjection(projection);
    } catch {
      return { success: false, code: "STORAGE_FAILURE" };
    }
  }

  async function safelyResolveTerminalEntry(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<boolean> {
    if (await safelyDelete(entry)) return true;
    const suppressed = InDoubtRecoveryJournalEntrySchema.safeParse({
      ...entry,
      attempt_count: entry.maximum_attempts
    });
    if (!suppressed.success) return false;
    return (await safelyWriteJournal(suppressed.data)).success;
  }

  async function sendEntry(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<RecoveryMutationResult> {
    let transport: RecoveryTransportResult;
    try {
      transport = await dependencies.transport.send(toMutationHttpRequest(entry.request));
    } catch {
      transport = {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "UNEXPECTED_NETWORK_FAILURE"
      };
    }

    if (transport.kind === "NOT_SENT") {
      const locallyResolved = await safelyResolveTerminalEntry(entry);
      if (!locallyResolved) {
        return {
          success: false,
          issue: issue(
            "LOCAL_STORAGE_FAILURE",
            "recovery.storage.resolve-terminal-failed",
            true
          )
        };
      }
      const notSentIssue = issue(
        "REQUEST_NOT_SENT",
        "recovery.request.not-sent",
        false
      );
      return {
        success: false,
        issue: notSentIssue,
        outcome: baseOutcome(entry.request, "NOT_SENT", true, {
          issue: notSentIssue
        })
      };
    }

    if (transport.kind === "AMBIGUOUS_TRANSPORT_FAILURE") {
      const recoveryIssue = issue(
        "REQUEST_IN_DOUBT",
        "recovery.request.in-doubt",
        true
      );
      return {
        success: false,
        issue: recoveryIssue,
        outcome: baseOutcome(entry.request, "IN_DOUBT", false, {
          issue: recoveryIssue
        })
      };
    }

    const success = parseMutationSuccess(entry.request, transport);
    if (success !== undefined) {
      if (!await safelyDelete(entry)) {
        const storageIssue = issue(
          "LOCAL_STORAGE_FAILURE",
          "recovery.storage.cleanup-failed",
          true
        );
        return {
          success: false,
          issue: storageIssue,
          outcome: baseOutcome(entry.request, "IN_DOUBT", false, {
            http_status: transport.status,
            issue: storageIssue
          })
        };
      }
      const replayed = "replayed" in success.data
        && typeof success.data.replayed === "boolean"
        ? success.data.replayed
        : false;
      return {
        success: true,
        response: success,
        outcome: baseOutcome(entry.request, "CONFIRMED_SUCCESS", false, {
          replayed,
          http_status: transport.status
        })
      };
    }

    const serverError = parseServerError(transport);
    const classification = classifyApiResponse(transport.status, serverError?.code);
    const withHttp = {
      http_status: transport.status,
      ...(serverError === undefined ? {} : { server_error_code: serverError.code })
    };

    if (classification === "STALE_CONFLICT") {
      if (!await safelyResolveTerminalEntry(entry)) {
        return {
          success: false,
          issue: issue(
            "LOCAL_STORAGE_FAILURE",
            "recovery.storage.resolve-terminal-failed",
            true
          )
        };
      }
      const staleIssue = issue(
        "SESSION_VERSION_CONFLICT",
        "recovery.mutation.stale-not-executed",
        false
      );
      return {
        success: false,
        issue: staleIssue,
        outcome: baseOutcome(entry.request, "STALE_NOT_EXECUTED", true, {
          ...withHttp,
          issue: staleIssue
        })
      };
    }
    if (classification === "IDEMPOTENCY_CONFLICT") {
      if (!await safelyResolveTerminalEntry(entry)) {
        return {
          success: false,
          issue: issue(
            "LOCAL_STORAGE_FAILURE",
            "recovery.storage.resolve-terminal-failed",
            true
          )
        };
      }
      const conflictIssue = issue(
        "IDEMPOTENCY_CONFLICT",
        "recovery.mutation.idempotency-conflict",
        false
      );
      return {
        success: false,
        issue: conflictIssue,
        outcome: baseOutcome(entry.request, "IDEMPOTENCY_CONFLICT", true, {
          ...withHttp,
          issue: conflictIssue
        })
      };
    }
    if (classification === "AUTHENTICATION_EXPIRED") {
      const authIssue = issue(
        "AUTHENTICATION_REQUIRED",
        "recovery.authentication.required",
        false
      );
      return {
        success: false,
        issue: authIssue,
        outcome: baseOutcome(entry.request, "AUTHENTICATION_REQUIRED", false, {
          ...withHttp,
          issue: authIssue
        })
      };
    }
    if (classification === "AUTHORIZATION_FAILURE") {
      if (!await safelyResolveTerminalEntry(entry)) {
        return {
          success: false,
          issue: issue(
            "LOCAL_STORAGE_FAILURE",
            "recovery.storage.resolve-terminal-failed",
            true
          )
        };
      }
      const authorizationIssue = issue(
        "AUTHORIZATION_DENIED",
        "recovery.authorization.denied",
        false
      );
      return {
        success: false,
        issue: authorizationIssue,
        outcome: baseOutcome(entry.request, "AUTHORIZATION_DENIED", true, {
          ...withHttp,
          issue: authorizationIssue
        })
      };
    }
    if (classification === "DEFINITIVE_REJECTION") {
      if (!await safelyResolveTerminalEntry(entry)) {
        return {
          success: false,
          issue: issue(
            "LOCAL_STORAGE_FAILURE",
            "recovery.storage.resolve-terminal-failed",
            true
          )
        };
      }
      const rejectionIssue = issue(
        "HTTP_REQUEST_REJECTED",
        "recovery.mutation.confirmed-rejection",
        false
      );
      return {
        success: false,
        issue: rejectionIssue,
        outcome: baseOutcome(entry.request, "CONFIRMED_REJECTION", true, {
          ...withHttp,
          issue: rejectionIssue
        })
      };
    }

    const uncertainIssue = classification === "DEPENDENCY_UNAVAILABLE"
      ? issue("DEPENDENCY_UNAVAILABLE", "recovery.dependency.unavailable", true)
      : issue("HTTP_RESPONSE_INVALID", "recovery.response.invalid", true);
    return {
      success: false,
      issue: uncertainIssue,
      outcome: baseOutcome(
        entry.request,
        classification === "DEPENDENCY_UNAVAILABLE"
          ? "DEPENDENCY_UNAVAILABLE"
          : "IN_DOUBT",
        false,
        { ...withHttp, issue: uncertainIssue }
      )
    };
  }

  async function submitMutation(input: unknown): Promise<RecoveryMutationResult> {
    const parsed = SubmitMutationInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        issue: issue("INVALID_RECOVERY_INPUT", "recovery.input.invalid", false)
      };
    }
    const { request } = parsed.data;
    if (parsed.data.connectivity_state !== "ONLINE") {
      const notSentIssue = issue(
        "REQUEST_NOT_SENT",
        "recovery.request.not-sent",
        false
      );
      return {
        success: false,
        issue: notSentIssue,
        outcome: baseOutcome(request, "NOT_SENT", true, { issue: notSentIssue })
      };
    }

    const canonical = canonicalRecoveryRequest(request);
    const entryId = recoveryJournalEntryId(parsed.data.principal_user_id, request);
    const run = inFlight.run({
      key: entryId,
      canonical_request: canonical,
      operation: async () => {
        let prior: unknown;
        try {
          prior = await dependencies.storage.readJournalEntry(entryId);
        } catch {
          return {
            success: false,
            issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.read-failed", true)
          } satisfies RecoveryMutationResult;
        }
        if (prior !== null) {
          const validated = validateStoredEntry(prior);
          if (!validated.success) {
            const invalidIssue = issue(
              "LOCAL_RECORD_INVALID",
              "recovery.local-record.invalid",
              false
            );
            return {
              success: false,
              issue: invalidIssue,
              outcome: baseOutcome(
                request,
                "UNRECOVERABLE_INVALID_LOCAL_RECORD",
                true,
                { issue: invalidIssue }
              )
            } satisfies RecoveryMutationResult;
          }
          if (
            validated.entry.principal_user_id !== parsed.data.principal_user_id
            || validated.entry.canonical_request !== canonical
          ) {
            const conflictIssue = issue(
              "LOCAL_IDEMPOTENCY_CONFLICT",
              "recovery.local-idempotency.conflict",
              false
            );
            return {
              success: false,
              issue: conflictIssue,
              outcome: baseOutcome(request, "IDEMPOTENCY_CONFLICT", true, {
                issue: conflictIssue
              })
            } satisfies RecoveryMutationResult;
          }
          const incremented = incrementRecoveryAttempt(
            validated.entry,
            parsed.data.attempted_at_utc
          );
          if (incremented === undefined) {
            const limitIssue = issue(
              "RETRY_LIMIT_REACHED",
              "recovery.retry.limit-reached",
              false
            );
            return {
              success: false,
              issue: limitIssue,
              outcome: baseOutcome(request, "RETRY_LIMIT_REACHED", false, {
                issue: limitIssue
              })
            } satisfies RecoveryMutationResult;
          }
          const stored = await safelyWriteJournal(incremented);
          if (!stored.success) {
            return {
              success: false,
              issue: issue(
                "LOCAL_STORAGE_FAILURE",
                "recovery.storage.write-failed",
                true
              )
            } satisfies RecoveryMutationResult;
          }
          return sendEntry(incremented);
        }

        const entry = createInDoubtEntry({
          principal_user_id: parsed.data.principal_user_id,
          request,
          attempted_at_utc: parsed.data.attempted_at_utc
        });
        if (entry === undefined) {
          return {
            success: false,
            issue: issue("INVALID_RECOVERY_INPUT", "recovery.input.invalid", false)
          } satisfies RecoveryMutationResult;
        }
        const stored = await safelyWriteJournal(entry);
        if (!stored.success) {
          const storageIssue = issue(
            stored.code === "LOCAL_IDEMPOTENCY_CONFLICT"
              ? "LOCAL_IDEMPOTENCY_CONFLICT"
              : "LOCAL_STORAGE_FAILURE",
            stored.code === "LOCAL_IDEMPOTENCY_CONFLICT"
              ? "recovery.local-idempotency.conflict"
              : "recovery.storage.write-failed",
            stored.code !== "LOCAL_IDEMPOTENCY_CONFLICT"
          );
          return {
            success: false,
            issue: storageIssue,
            outcome: baseOutcome(
              request,
              stored.code === "LOCAL_IDEMPOTENCY_CONFLICT"
                ? "IDEMPOTENCY_CONFLICT"
                : "NOT_SENT",
              true,
              { issue: storageIssue }
            )
          } satisfies RecoveryMutationResult;
        }
        return sendEntry(entry);
      }
    });
    if (!run.success) {
      const conflictIssue = issue(
        run.code === "IN_FLIGHT_CONFLICT"
          ? "LOCAL_IDEMPOTENCY_CONFLICT"
          : "LOCAL_STORAGE_FAILURE",
        run.code === "IN_FLIGHT_CONFLICT"
          ? "recovery.in-flight.conflict"
          : "recovery.in-flight.capacity",
        false
      );
      return {
        success: false,
        issue: conflictIssue,
        outcome: baseOutcome(request, "IDEMPOTENCY_CONFLICT", true, {
          issue: conflictIssue
        })
      };
    }
    return run.value;
  }

  async function reconcileInDoubt(input: unknown): Promise<RecoveryMutationResult> {
    const parsed = ReconcileInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        issue: issue("INVALID_RECOVERY_INPUT", "recovery.input.invalid", false)
      };
    }
    let raw: unknown;
    try {
      raw = await dependencies.storage.readJournalEntry(parsed.data.journal_entry_id);
    } catch {
      return {
        success: false,
        issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.read-failed", true)
      };
    }
    const validated = validateStoredEntry(raw);
    if (!validated.success) {
      const invalidIssue = issue(
        "LOCAL_RECORD_INVALID",
        "recovery.local-record.invalid",
        false
      );
      return { success: false, issue: invalidIssue };
    }
    const entry = validated.entry;
    if (entry.principal_user_id !== parsed.data.principal_user_id) {
      const authzIssue = issue(
        "AUTHORIZATION_DENIED",
        "recovery.principal.changed",
        false
      );
      return {
        success: false,
        issue: authzIssue,
        outcome: baseOutcome(entry.request, "AUTHORIZATION_DENIED", true, {
          issue: authzIssue
        })
      };
    }
    if (parsed.data.authentication_state !== "VERIFIED") {
      const authIssue = issue(
        "AUTHENTICATION_REQUIRED",
        "recovery.authentication.required",
        false
      );
      return {
        success: false,
        issue: authIssue,
        outcome: baseOutcome(entry.request, "AUTHENTICATION_REQUIRED", false, {
          issue: authIssue
        })
      };
    }
    const incremented = incrementRecoveryAttempt(entry, parsed.data.attempted_at_utc);
    if (incremented === undefined) {
      const limitIssue = issue(
        "RETRY_LIMIT_REACHED",
        "recovery.retry.limit-reached",
        false
      );
      return {
        success: false,
        issue: limitIssue,
        outcome: baseOutcome(entry.request, "RETRY_LIMIT_REACHED", false, {
          issue: limitIssue
        })
      };
    }
    const stored = await safelyWriteJournal(incremented);
    if (!stored.success) {
      return {
        success: false,
        issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.write-failed", true)
      };
    }
    return sendEntry(incremented);
  }

  async function readSessionWithRetry(input: {
    session_id: string;
    request_id: string;
    correlation_id: string;
  }): Promise<RecoveryTransportResult> {
    const request = sessionReadRequest(input);
    let last: RecoveryTransportResult = {
      kind: "AMBIGUOUS_TRANSPORT_FAILURE",
      failure: "UNEXPECTED_NETWORK_FAILURE"
    };
    for (let attempt = 1; attempt <= READ_RETRY_MAX_ATTEMPTS; attempt += 1) {
      try {
        last = await dependencies.transport.send(request);
      } catch {
        last = {
          kind: "AMBIGUOUS_TRANSPORT_FAILURE",
          failure: "UNEXPECTED_NETWORK_FAILURE"
        };
      }
      if (last.kind === "NOT_SENT") return last;
      const serverError = last.kind === "HTTP_RESPONSE"
        ? parseServerError(last)
        : undefined;
      const retryKind = last.kind === "AMBIGUOUS_TRANSPORT_FAILURE"
        ? "NETWORK_FAILURE" as const
        : classifyApiResponse(last.status, serverError?.code) === "DEPENDENCY_UNAVAILABLE"
          ? "DEPENDENCY_UNAVAILABLE" as const
          : "SEMANTIC_RESPONSE" as const;
      if (!shouldRetrySafeRead({ attempt, result: retryKind })) return last;
      const delay = readRetryDelayMilliseconds(attempt + 1);
      if (delay !== undefined) await dependencies.delay.wait(delay);
    }
    return last;
  }

  async function recoverSession(input: unknown): Promise<SessionRecoveryResult> {
    const parsed = RecoverSessionInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        issue: issue("INVALID_RECOVERY_INPUT", "recovery.input.invalid", false)
      };
    }
    if (parsed.data.authentication_state !== "VERIFIED") {
      return {
        success: false,
        issue: issue(
          "AUTHENTICATION_REQUIRED",
          "recovery.authentication.required",
          false
        )
      };
    }
    const recoveryInput = parsed.data;

    async function readSafeCachedProjection(): Promise<SessionRecoveryResult> {
      let raw: unknown;
      try {
        raw = await dependencies.storage.readLastKnownProjection(recoveryInput);
      } catch {
        raw = null;
      }
      const cached = LastKnownSafeSessionProjectionSchema.safeParse(raw);
      if (
        !cached.success
        || cached.data.principal_user_id !== recoveryInput.principal_user_id
        || cached.data.session_id !== recoveryInput.session_id
      ) {
        return {
          success: false,
          issue: issue("REQUEST_IN_DOUBT", "recovery.session.unreachable", true)
        };
      }
      return {
        success: true,
        connectivity_state: "OFFLINE_OR_UNREACHABLE",
        last_known_projection: cached.data,
        reconciliation_results: []
      };
    }

    const read = await readSessionWithRetry(recoveryInput);
    if (read.kind === "NOT_SENT" || read.kind === "AMBIGUOUS_TRANSPORT_FAILURE") {
      return readSafeCachedProjection();
    }
    const initialServerError = parseServerError(read);
    if (
      classifyApiResponse(read.status, initialServerError?.code)
      === "DEPENDENCY_UNAVAILABLE"
    ) {
      return readSafeCachedProjection();
    }

    const envelope = read.status === 200
      ? SafeSessionEnvelopeSchema.safeParse(read.body)
      : undefined;
    if (
      envelope === undefined
      || !envelope.success
      || envelope.data.data.session_id !== recoveryInput.session_id
    ) {
      const serverError = parseServerError(read);
      const classification = classifyApiResponse(read.status, serverError?.code);
      return {
        success: false,
        issue: classification === "AUTHENTICATION_EXPIRED"
          ? issue("AUTHENTICATION_REQUIRED", "recovery.authentication.required", false)
          : classification === "AUTHORIZATION_FAILURE"
            ? issue("AUTHORIZATION_DENIED", "recovery.authorization.denied", false)
            : issue("HTTP_RESPONSE_INVALID", "recovery.response.invalid", false)
      };
    }

    const cached = LastKnownSafeSessionProjectionSchema.safeParse({
      recovery_schema_version: RECOVERY_SCHEMA_VERSION,
      principal_user_id: recoveryInput.principal_user_id,
      session_id: recoveryInput.session_id,
      freshness: "STALE_LAST_KNOWN",
      mutation_authority: "NONE",
      captured_at_utc: recoveryInput.observed_at_utc,
      projection: envelope.data.data
    });
    if (!cached.success) {
      return {
        success: false,
        issue: issue("HTTP_RESPONSE_INVALID", "recovery.response.invalid", false)
      };
    }
    const stored = await safelyWriteProjection(cached.data);
    if (!stored.success) {
      return {
        success: false,
        issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.write-failed", true)
      };
    }

    let rawEntries: readonly unknown[];
    try {
      rawEntries = await dependencies.storage.listJournalEntries({
        principal_user_id: recoveryInput.principal_user_id,
        session_id: recoveryInput.session_id
      });
    } catch {
      return {
        success: false,
        issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.read-failed", true)
      };
    }
    const reconciliationResults: RecoveryMutationResult[] = [];
    let synchronizationRequired = false;
    for (const rawEntry of rawEntries) {
      const entry = validateStoredEntry(rawEntry);
      if (
        !entry.success
        || entry.entry.principal_user_id !== recoveryInput.principal_user_id
        || entry.entry.session_id !== recoveryInput.session_id
      ) {
        return {
          success: false,
          issue: issue("LOCAL_RECORD_INVALID", "recovery.local-record.invalid", false)
        };
      }
      const result = await reconcileInDoubt({
        principal_user_id: recoveryInput.principal_user_id,
        journal_entry_id: entry.entry.journal_entry_id,
        attempted_at_utc: recoveryInput.observed_at_utc,
        authentication_state: "VERIFIED"
      });
      reconciliationResults.push(result);
      if (!result.success || result.outcome.requires_authoritative_sync) {
        synchronizationRequired = true;
      }
    }

    let finalProjection = envelope.data.data;
    if (reconciliationResults.length > 0) {
      const refreshed = await readSessionWithRetry(recoveryInput);
      const refreshedEnvelope = refreshed.kind === "HTTP_RESPONSE" && refreshed.status === 200
        ? SafeSessionEnvelopeSchema.safeParse(refreshed.body)
        : undefined;
      if (
        refreshedEnvelope === undefined
        || !refreshedEnvelope.success
        || refreshedEnvelope.data.data.session_id !== recoveryInput.session_id
      ) {
        return {
          success: false,
          issue: issue("HTTP_RESPONSE_INVALID", "recovery.resync.failed", true)
        };
      }
      finalProjection = refreshedEnvelope.data.data;
    }
    const finalCached = LastKnownSafeSessionProjectionSchema.safeParse({
      recovery_schema_version: RECOVERY_SCHEMA_VERSION,
      principal_user_id: recoveryInput.principal_user_id,
      session_id: recoveryInput.session_id,
      freshness: "STALE_LAST_KNOWN",
      mutation_authority: "NONE",
      captured_at_utc: recoveryInput.observed_at_utc,
      projection: finalProjection
    });
    if (!finalCached.success) {
      return {
        success: false,
        issue: issue("HTTP_RESPONSE_INVALID", "recovery.response.invalid", false)
      };
    }
    const finalStored = await safelyWriteProjection(
      finalCached.data
    );
    if (!finalStored.success) {
      return {
        success: false,
        issue: issue("LOCAL_STORAGE_FAILURE", "recovery.storage.write-failed", true)
      };
    }
    return {
      success: true,
      connectivity_state: synchronizationRequired ? "SYNC_REQUIRED" : "ONLINE",
      authoritative_projection: finalProjection,
      reconciliation_results: Object.freeze(reconciliationResults)
    };
  }

  return Object.freeze({
    submitMutation,
    reconcileInDoubt,
    recoverSession
  });
}
