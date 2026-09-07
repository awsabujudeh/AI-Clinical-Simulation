import {
  SafeSessionProjectionSchema,
  type ApiDomainError,
  type SafeSessionProjection
} from "@ai-clinical-simulation/contracts";

import type {
  SessionLoadResult,
  SessionPresentationState,
  StudentShellLocale
} from "./types";

export type SafeApiErrorKind =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "NOT_FOUND"
  | "STATE_CHANGED"
  | "INVALID_REQUEST"
  | "SERVICE_ERROR"
  | "SERVICE_UNAVAILABLE";

export function mapHttpStatusToSafeError(status: number): SafeApiErrorKind {
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "AUTHORIZATION_DENIED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "STATE_CHANGED";
  if (status === 422) return "INVALID_REQUEST";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "SERVICE_ERROR";
}

export function mapApiDomainErrorToSafeError(error: ApiDomainError): SafeApiErrorKind {
  return mapHttpStatusToSafeError(error.http_status);
}

export function presentSessionLoad(
  result: SessionLoadResult
): SessionPresentationState | undefined {
  if (result.kind === "AUTHORITATIVE") {
    const parsed = SafeSessionProjectionSchema.safeParse(result.projection);
    if (!parsed.success) return undefined;
    return {
      kind: parsed.data.status === "ENDED"
        ? "ENDED"
        : result.connectivity === "RECOVERING"
          ? "RECOVERING"
          : result.connectivity === "SYNC_REQUIRED"
            ? "SYNC_REQUIRED"
            : "ACTIVE_ONLINE",
      projection: parsed.data,
      mutation_authority: "SERVER_ONLY",
      ...(result.request_status === undefined
        ? {}
        : { request_status: result.request_status })
    };
  }
  if (result.kind !== "STALE") return undefined;
  const parsed = SafeSessionProjectionSchema.safeParse(result.cached.projection);
  if (!parsed.success || parsed.data.session_id !== result.cached.session_id) {
    return undefined;
  }
  return {
    kind: parsed.data.status === "ENDED" ? "ENDED" : "ACTIVE_STALE",
    projection: parsed.data,
    mutation_authority: "NONE",
    ...(result.request_status === undefined
      ? {}
      : { request_status: result.request_status })
  };
}

export function formatClinicalTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function isSessionMutationEntryEnabled(
  state: SessionPresentationState
): boolean {
  return state.kind === "ACTIVE_ONLINE"
    && state.mutation_authority === "SERVER_ONLY"
    && state.projection.status === "ACTIVE";
}

export function patientLanguageDirection(
  locale: StudentShellLocale
): "ltr" | "rtl" {
  return locale === "ar-JO" ? "rtl" : "ltr";
}

export function disclosedSessionProjection(
  input: unknown
): SafeSessionProjection | undefined {
  const parsed = SafeSessionProjectionSchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}
