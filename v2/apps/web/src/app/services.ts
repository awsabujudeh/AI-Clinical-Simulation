import {
  StartSessionResponseDataSchema,
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
  StartSessionResult,
  StudentUiServices
} from "./types";

const StartSessionSuccessEnvelopeSchema = createApiV1SuccessEnvelopeSchema(
  StartSessionResponseDataSchema
);

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
    })
  });
}
