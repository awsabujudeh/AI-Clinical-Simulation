import {
  ConnectivityStateSchema,
  EndSimulationResponseDataSchema,
  RecoveryMutationRequestSchema,
  RecoveryPrincipalIdSchema,
  SafeLearnerActionSchema,
  StartSessionResponseDataSchema,
  SubmitClinicalActionResponseDataSchema,
  createApiV1SuccessEnvelopeSchema,
  type PatientLanguage,
  type StartSessionRequest
} from "@ai-clinical-simulation/contracts";
import type {
  RecoveryMutationResult,
  SessionRecoveryResult
} from "@ai-clinical-simulation/recovery-core";

import type {
  SessionLoadResult,
  StudentClinicalActionIntent,
  StudentClinicalActionResult,
  StudentFinalizationIntent,
  StudentFinalizationResult,
  StartSessionResult,
  StudentUiServices
} from "./types";

const StartSessionSuccessEnvelopeSchema = createApiV1SuccessEnvelopeSchema(
  StartSessionResponseDataSchema
);
const SubmitClinicalActionSuccessEnvelopeSchema = createApiV1SuccessEnvelopeSchema(
  SubmitClinicalActionResponseDataSchema
);
const EndSimulationSuccessEnvelopeSchema = createApiV1SuccessEnvelopeSchema(
  EndSimulationResponseDataSchema
);

export type ClinicalActionRequestIdentity = Readonly<{
  request_id: string;
  correlation_id: string;
  idempotency_key: string;
  command_id: string;
  action_request_id: string;
  attempted_at_utc: string;
}>;

export interface ClinicalActionIdentityFactory {
  create(intent: StudentClinicalActionIntent): ClinicalActionRequestIdentity;
}

export interface RecoveryMutationCoordinator {
  submitMutation(input: unknown): Promise<RecoveryMutationResult>;
}

export type SessionFinalizationRequestIdentity = Readonly<{
  request_id: string;
  correlation_id: string;
  idempotency_key: string;
  attempted_at_utc: string;
}>;

export interface SessionFinalizationIdentityFactory {
  create(intent: StudentFinalizationIntent): SessionFinalizationRequestIdentity;
}

export function actionSubmissionFromRecovery(
  result: RecoveryMutationResult,
  idempotencyKey: string
): StudentClinicalActionResult {
  if (result.success) {
    const parsed = SubmitClinicalActionSuccessEnvelopeSchema.safeParse(result.response);
    return parsed.success
      ? {
          kind: "COMMITTED",
          replayed: parsed.data.data.replayed,
          idempotency_key: idempotencyKey,
          committed_event_ids: parsed.data.data.committed_event_ids,
          projection: parsed.data.data.session
        }
      : { kind: "UNAVAILABLE", requires_authoritative_sync: true };
  }
  const common = {
    ...(result.outcome?.idempotency_key === undefined
      ? {}
      : { idempotency_key: result.outcome.idempotency_key }),
    ...(result.outcome?.http_status === undefined
      ? {}
      : { http_status: result.outcome.http_status })
  };
  switch (result.outcome?.status) {
    case "NOT_SENT":
      return { kind: "NOT_SENT", requires_authoritative_sync: true, ...common };
    case "IN_DOUBT":
      return { kind: "IN_DOUBT", requires_authoritative_sync: true, ...common };
    case "STALE_NOT_EXECUTED":
      return { kind: "STALE", requires_authoritative_sync: true, ...common };
    case "IDEMPOTENCY_CONFLICT":
      return { kind: "IDEMPOTENCY_CONFLICT", requires_authoritative_sync: true, ...common };
    case "AUTHENTICATION_REQUIRED":
      return { kind: "UNAUTHENTICATED", requires_authoritative_sync: false, ...common };
    case "AUTHORIZATION_DENIED":
      return { kind: "UNAUTHORIZED", requires_authoritative_sync: false, ...common };
    case "CONFIRMED_REJECTION":
      return { kind: "REJECTED", requires_authoritative_sync: false, ...common };
    default:
      return {
        kind: result.issue.code === "INVALID_RECOVERY_INPUT" ? "INVALID" : "UNAVAILABLE",
        requires_authoritative_sync: result.issue.retryable,
        ...common
      };
  }
}

export function createRecoveryBackedStudentActionService(dependencies: {
  coordinator: RecoveryMutationCoordinator;
  identity_factory: ClinicalActionIdentityFactory;
}) {
  return Object.freeze({
    async submit(intent: StudentClinicalActionIntent): Promise<StudentClinicalActionResult> {
      const action = SafeLearnerActionSchema.safeParse(intent.action);
      if (!action.success) {
        return { kind: "INVALID", requires_authoritative_sync: false };
      }
      const identity = dependencies.identity_factory.create(intent);
      const request = RecoveryMutationRequestSchema.safeParse({
        recovery_schema_version: "1.0",
        api_schema_version: "1.0",
        operation: "PROPOSE_ACTION",
        session_id: intent.session_id,
        request_id: identity.request_id,
        correlation_id: identity.correlation_id,
        idempotency_key: identity.idempotency_key,
        request: {
          command_id: identity.command_id,
          action_request_id: identity.action_request_id,
          action_id: action.data.action_id,
          expected_state_version: intent.expected_state_version,
          parameters: intent.parameters,
          source: "UI"
        }
      });
      if (!request.success) {
        return { kind: "INVALID", requires_authoritative_sync: false };
      }
      const principal = RecoveryPrincipalIdSchema.safeParse(intent.principal_user_id);
      const connectivity = ConnectivityStateSchema.safeParse(intent.connectivity_state);
      if (!principal.success || !connectivity.success) {
        return { kind: "INVALID", requires_authoritative_sync: false };
      }
      const result = await dependencies.coordinator.submitMutation({
        principal_user_id: principal.data,
        connectivity_state: connectivity.data,
        attempted_at_utc: identity.attempted_at_utc,
        request: request.data
      });
      return actionSubmissionFromRecovery(
        result,
        identity.idempotency_key
      );
    }
  });
}

export function finalizationFromRecovery(
  result: RecoveryMutationResult,
  idempotencyKey: string
): StudentFinalizationResult {
  if (result.success) {
    const parsed = EndSimulationSuccessEnvelopeSchema.safeParse(result.response);
    return parsed.success
      ? {
          kind: "COMMITTED",
          replayed: parsed.data.data.replayed,
          idempotency_key: idempotencyKey,
          projection: parsed.data.data.session,
          assessment: parsed.data.data.assessment
        }
      : { kind: "UNAVAILABLE", requires_authoritative_sync: true };
  }
  const common = {
    ...(result.outcome?.idempotency_key === undefined
      ? {}
      : { idempotency_key: result.outcome.idempotency_key }),
    ...(result.outcome?.http_status === undefined
      ? {}
      : { http_status: result.outcome.http_status })
  };
  switch (result.outcome?.status) {
    case "NOT_SENT":
      return { kind: "NOT_SENT", requires_authoritative_sync: true, ...common };
    case "IN_DOUBT":
      return { kind: "IN_DOUBT", requires_authoritative_sync: true, ...common };
    case "STALE_NOT_EXECUTED":
      return { kind: "STALE", requires_authoritative_sync: true, ...common };
    case "IDEMPOTENCY_CONFLICT":
      return { kind: "IDEMPOTENCY_CONFLICT", requires_authoritative_sync: true, ...common };
    case "AUTHENTICATION_REQUIRED":
      return { kind: "UNAUTHENTICATED", requires_authoritative_sync: false, ...common };
    case "AUTHORIZATION_DENIED":
      return { kind: "UNAUTHORIZED", requires_authoritative_sync: false, ...common };
    case "CONFIRMED_REJECTION":
      return { kind: "REJECTED", requires_authoritative_sync: false, ...common };
    default:
      return {
        kind: result.issue.code === "INVALID_RECOVERY_INPUT" ? "INVALID" : "UNAVAILABLE",
        requires_authoritative_sync: result.issue.retryable,
        ...common
      };
  }
}

export function createRecoveryBackedStudentFinalizationService(dependencies: {
  coordinator: RecoveryMutationCoordinator;
  identity_factory: SessionFinalizationIdentityFactory;
}) {
  return Object.freeze({
    async end(intent: StudentFinalizationIntent): Promise<StudentFinalizationResult> {
      const identity = dependencies.identity_factory.create(intent);
      const principal = RecoveryPrincipalIdSchema.safeParse(intent.principal_user_id);
      const connectivity = ConnectivityStateSchema.safeParse(intent.connectivity_state);
      const request = RecoveryMutationRequestSchema.safeParse({
        recovery_schema_version: "1.0",
        api_schema_version: "1.0",
        operation: "END_SESSION",
        session_id: intent.session_id,
        request_id: identity.request_id,
        correlation_id: identity.correlation_id,
        idempotency_key: identity.idempotency_key,
        request: {
          expected_state_version: intent.expected_state_version,
          reason: "LEARNER_COMPLETED"
        }
      });
      if (!principal.success || !connectivity.success || !request.success) {
        return { kind: "INVALID", requires_authoritative_sync: false };
      }
      const result = await dependencies.coordinator.submitMutation({
        principal_user_id: principal.data,
        connectivity_state: connectivity.data,
        attempted_at_utc: identity.attempted_at_utc,
        request: request.data
      });
      return finalizationFromRecovery(result, identity.idempotency_key);
    }
  });
}

export function sessionLoadFromRecovery(
  result: SessionRecoveryResult
): SessionLoadResult {
  if (result.success) {
    if (result.connectivity_state === "OFFLINE_OR_UNREACHABLE") {
      return {
        kind: "STALE",
        connectivity: "OFFLINE_OR_UNREACHABLE",
        cached: result.last_known_projection,
        request_status: "IN_DOUBT"
      };
    }
    const staleRejection = result.reconciliation_results.some(
      (entry) => entry.outcome?.status === "STALE_NOT_EXECUTED"
    );
    const inDoubt = result.reconciliation_results.some(
      (entry) => entry.outcome?.status === "IN_DOUBT"
    );
    return {
      kind: "AUTHORITATIVE",
      connectivity: result.connectivity_state,
      projection: result.authoritative_projection,
      ...(staleRejection
        ? { request_status: "STALE_NOT_EXECUTED" as const }
        : inDoubt
          ? { request_status: "IN_DOUBT" as const }
          : {})
    };
  }
  if (result.issue.code === "AUTHENTICATION_REQUIRED"
    || result.issue.code === "AUTHORIZATION_DENIED") {
    return { kind: "UNAUTHORIZED", http_status: result.issue.code === "AUTHENTICATION_REQUIRED" ? 401 : 403 };
  }
  return { kind: "API_UNAVAILABLE", http_status: 503 };
}

export function startSessionFromRecovery(
  result: RecoveryMutationResult,
  patientLanguage: PatientLanguage
): StartSessionResult {
  if (result.success) {
    const parsed = StartSessionSuccessEnvelopeSchema.safeParse(result.response);
    if (!parsed.success) return { success: false, kind: "API_UNAVAILABLE", http_status: 503 };
    return {
      success: true,
      projection: parsed.data.data.session,
      patient_language: patientLanguage,
      replayed: parsed.data.data.replayed
    };
  }
  const status = result.outcome?.status;
  if (status === "IN_DOUBT") return { success: false, kind: "IN_DOUBT" };
  if (status === "AUTHENTICATION_REQUIRED") {
    return { success: false, kind: "UNAUTHENTICATED", http_status: 401 };
  }
  if (status === "AUTHORIZATION_DENIED") {
    return { success: false, kind: "UNAUTHORIZED", http_status: 403 };
  }
  if (status === "STALE_NOT_EXECUTED" || status === "IDEMPOTENCY_CONFLICT") {
    return { success: false, kind: "CONFLICT", http_status: 409 };
  }
  if (status === "CONFIRMED_REJECTION") {
    const httpStatus = result.outcome?.http_status;
    return {
      success: false,
      kind: httpStatus === 404 ? "NOT_FOUND" : "INVALID",
      ...(httpStatus === undefined ? {} : { http_status: httpStatus })
    };
  }
  return { success: false, kind: "API_UNAVAILABLE", http_status: 503 };
}

export function createUnconfiguredStudentUiServices(): StudentUiServices {
  return Object.freeze({
    auth: Object.freeze({
      async resolve() {
        return { status: "UNAUTHENTICATED" as const };
      }
    }),
    sessions: Object.freeze({
      async load() {
        return { kind: "UNAUTHORIZED" as const, http_status: 401 };
      },
      async start(_request: StartSessionRequest) {
        return { success: false as const, kind: "UNAUTHENTICATED" as const, http_status: 401 };
      }
    }),
    actions: Object.freeze({
      async submit() {
        return {
          kind: "UNAUTHENTICATED" as const,
          requires_authoritative_sync: false
        };
      }
    }),
    clinical_interpreter: Object.freeze({
      async interpret() {
        return { kind: "UNAUTHENTICATED" as const, http_status: 401 };
      }
    }),
    timeline: Object.freeze({
      async load() {
        return { kind: "UNAUTHORIZED" as const, http_status: 401 };
      }
    }),
    assessment: Object.freeze({
      async load() {
        return { kind: "UNAUTHORIZED" as const, http_status: 401 };
      }
    }),
    patient_conversation: Object.freeze({
      async load() {
        return { kind: "UNAUTHORIZED" as const, http_status: 401 };
      },
      async submit() {
        return { kind: "UNAUTHENTICATED" as const, http_status: 401 };
      }
    }),
    finalization: Object.freeze({
      async end() {
        return {
          kind: "UNAUTHENTICATED" as const,
          requires_authoritative_sync: false
        };
      }
    })
  });
}
