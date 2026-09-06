import {
  RecoveryMutationRequestSchema,
  RecoveryPrincipalIdSchema,
  type RecoveryMutationRequest
} from "../../../packages/contracts/src/index.ts";
import {
  InMemoryRecoveryStorageAdapter,
  canonicalRecoveryRequest,
  createRecoveryCoordinator,
  reduceConnectivityState,
  type RecoveryTransport
} from "../../../packages/recovery-core/src/index.ts";

export const RECOVERY_TEST_PRINCIPAL = RecoveryPrincipalIdSchema.parse(
  "10000000-0000-4000-8000-000000000001"
);
export const RECOVERY_OTHER_PRINCIPAL = RecoveryPrincipalIdSchema.parse(
  "10000000-0000-4000-8000-000000000002"
);
export const RECOVERY_TEST_TIME = "2026-09-06T10:00:00Z" as const;
export const RECOVERY_LATER_TIME = "2026-09-06T10:01:00Z" as const;

export function createStartRecoveryRequest(
  caseId = "case.synthetic-assessment",
  idempotencyKey = "idempotency.recovery.start"
): Extract<RecoveryMutationRequest, { operation: "START_SESSION" }> {
  const parsed = RecoveryMutationRequestSchema.parse({
    recovery_schema_version: "1.0",
    api_schema_version: "1.0",
    operation: "START_SESSION",
    request_id: "request.recovery.start",
    correlation_id: "correlation.recovery.start",
    idempotency_key: idempotencyKey,
    request: {
      case_id: caseId,
      patient_language: "en-US",
      mode: "ASSESSMENT",
      client_capabilities: {
        supports_static_visual_fallback: true,
        supports_audio: false
      }
    }
  });
  if (parsed.operation !== "START_SESSION") throw new Error("Invalid start fixture.");
  return parsed;
}

export function createActionRecoveryRequest(input: {
  session_id: string;
  expected_state_version?: number;
  idempotency_key?: string;
  action_id?: string;
}): Extract<RecoveryMutationRequest, { operation: "PROPOSE_ACTION" }> {
  const parsed = RecoveryMutationRequestSchema.parse({
    recovery_schema_version: "1.0",
    api_schema_version: "1.0",
    operation: "PROPOSE_ACTION",
    session_id: input.session_id,
    request_id: "request.recovery.action",
    correlation_id: "correlation.recovery.action",
    idempotency_key: input.idempotency_key ?? "idempotency.recovery.action",
    request: {
      command_id: "command.recovery.action",
      action_request_id: "action-request.recovery.action",
      action_id: input.action_id ?? "examination.synthetic-check",
      expected_state_version: input.expected_state_version ?? 0,
      parameters: {},
      source: "UI"
    }
  });
  if (parsed.operation !== "PROPOSE_ACTION") throw new Error("Invalid action fixture.");
  return parsed;
}

export function createEndRecoveryRequest(input: {
  session_id: string;
  expected_state_version: number;
  idempotency_key?: string;
}): Extract<RecoveryMutationRequest, { operation: "END_SESSION" }> {
  const parsed = RecoveryMutationRequestSchema.parse({
    recovery_schema_version: "1.0",
    api_schema_version: "1.0",
    operation: "END_SESSION",
    session_id: input.session_id,
    request_id: "request.recovery.end",
    correlation_id: "correlation.recovery.end",
    idempotency_key: input.idempotency_key ?? "idempotency.recovery.end",
    request: {
      expected_state_version: input.expected_state_version,
      reason: "LEARNER_COMPLETED"
    }
  });
  if (parsed.operation !== "END_SESSION") throw new Error("Invalid end fixture.");
  return parsed;
}

export const V2_014A_PORTABILITY_EXPECTED =
  '{"connectivity_after_browser_hint":"RECOVERING","connectivity_after_trusted_success":"ONLINE","canonical_request":"{\\"api_schema_version\\":\\"1.0\\",\\"correlation_id\\":\\"correlation.recovery.start\\",\\"idempotency_key\\":\\"idempotency.recovery.start\\",\\"operation\\":\\"START_SESSION\\",\\"recovery_schema_version\\":\\"1.0\\",\\"request\\":{\\"case_id\\":\\"case.synthetic-assessment\\",\\"client_capabilities\\":{\\"supports_audio\\":false,\\"supports_static_visual_fallback\\":true},\\"mode\\":\\"ASSESSMENT\\",\\"patient_language\\":\\"en-US\\"},\\"request_id\\":\\"request.recovery.start\\"}","outcome":"IN_DOUBT","journal_attempt_count":1,"same_idempotency_key":true,"same_canonical_request":true}' as const;

export async function createV2014aPortabilitySnapshot() {
  const storage = new InMemoryRecoveryStorageAdapter();
  const transport: RecoveryTransport = {
    async send() {
      return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      };
    }
  };
  const coordinator = createRecoveryCoordinator({
    storage,
    transport,
    delay: { async wait() {} }
  });
  const request = createStartRecoveryRequest();
  const result = await coordinator.submitMutation({
    principal_user_id: RECOVERY_TEST_PRINCIPAL,
    connectivity_state: "ONLINE",
    attempted_at_utc: RECOVERY_TEST_TIME,
    request
  });
  const entries = await storage.listJournalEntries({
    principal_user_id: RECOVERY_TEST_PRINCIPAL
  });
  const entry = entries[0] as {
    attempt_count: number;
    idempotency_key?: string;
    request: typeof request;
    canonical_request: string;
  };
  return {
    connectivity_after_browser_hint: reduceConnectivityState(
      "OFFLINE_OR_UNREACHABLE",
      "NAVIGATOR_REPORTED_ONLINE"
    ),
    connectivity_after_trusted_success: reduceConnectivityState(
      "RECOVERING",
      "REQUEST_SUCCEEDED"
    ),
    canonical_request: canonicalRecoveryRequest(request),
    outcome: result.outcome?.status,
    journal_attempt_count: entry.attempt_count,
    same_idempotency_key:
      entry.request.idempotency_key === request.idempotency_key,
    same_canonical_request:
      entry.canonical_request === canonicalRecoveryRequest(request)
  };
}
