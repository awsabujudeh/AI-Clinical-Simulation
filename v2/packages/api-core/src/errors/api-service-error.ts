import type { ApiErrorResponse } from "../../../contracts/src/index.ts";

export type ApiServiceError = Readonly<{
  code: string;
  http_status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 500 | 503;
  message_key: string;
  retryable: boolean;
}>;

export type ApiServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiServiceError };

export function apiError(input: ApiServiceError): ApiServiceError {
  return Object.freeze(input);
}

export function apiErrorResponse(input: {
  error: ApiServiceError;
  request_id: string;
  correlation_id: string;
}): ApiErrorResponse {
  return {
    api_schema_version: "1.0" as ApiErrorResponse["api_schema_version"],
    request_id: input.request_id as ApiErrorResponse["request_id"],
    error: {
      code: input.error.code as ApiErrorResponse["error"]["code"],
      message_key: input.error.message_key as ApiErrorResponse["error"]["message_key"],
      correlation_id: input.correlation_id as ApiErrorResponse["error"]["correlation_id"],
      http_status: input.error.http_status,
      retryable: input.error.retryable
    }
  };
}

export const ERRORS = Object.freeze({
  malformed: apiError({ code: "INVALID_REQUEST", http_status: 400, message_key: "api.error.invalid-request", retryable: false }),
  unsupportedVersion: apiError({ code: "API_VERSION_UNSUPPORTED", http_status: 400, message_key: "api.error.unsupported-version", retryable: false }),
  contentType: apiError({ code: "CONTENT_TYPE_UNSUPPORTED", http_status: 415, message_key: "api.error.content-type", retryable: false }),
  bodyTooLarge: apiError({ code: "REQUEST_BODY_TOO_LARGE", http_status: 400, message_key: "api.error.body-too-large", retryable: false }),
  authentication: apiError({ code: "AUTHENTICATION_REQUIRED", http_status: 401, message_key: "api.error.authentication-required", retryable: false }),
  authorization: apiError({ code: "RESOURCE_NOT_ACCESSIBLE", http_status: 404, message_key: "api.error.resource-not-accessible", retryable: false }),
  forbidden: apiError({ code: "NOT_AUTHORIZED", http_status: 403, message_key: "api.error.not-authorized", retryable: false }),
  notFound: apiError({ code: "RESOURCE_NOT_FOUND", http_status: 404, message_key: "api.error.resource-not-found", retryable: false }),
  idempotency: apiError({ code: "IDEMPOTENCY_CONFLICT", http_status: 409, message_key: "api.error.idempotency-conflict", retryable: false }),
  stale: apiError({ code: "SESSION_VERSION_CONFLICT", http_status: 409, message_key: "api.error.session-version-conflict", retryable: true }),
  ended: apiError({ code: "SESSION_ENDED", http_status: 409, message_key: "api.error.session-ended", retryable: false }),
  domainRejected: apiError({ code: "DOMAIN_REQUEST_REJECTED", http_status: 422, message_key: "api.error.domain-rejected", retryable: false }),
  resultPending: apiError({ code: "RESULT_PENDING", http_status: 422, message_key: "api.error.result-pending", retryable: true }),
  conversationInProgress: apiError({ code: "PATIENT_RESPONSE_PENDING", http_status: 409, message_key: "api.error.patient-response-pending", retryable: true }),
  patientConversationUnavailable: apiError({ code: "PATIENT_CONVERSATION_UNAVAILABLE", http_status: 503, message_key: "api.error.patient-conversation-unavailable", retryable: true }),
  clinicalInterpreterUnavailable: apiError({ code: "CLINICAL_INTERPRETER_UNAVAILABLE", http_status: 503, message_key: "api.error.clinical-interpreter-unavailable", retryable: true }),
  assessmentPending: apiError({ code: "ASSESSMENT_PENDING", http_status: 422, message_key: "api.error.assessment-pending", retryable: true }),
  unavailable: apiError({ code: "FEATURE_NOT_AVAILABLE", http_status: 503, message_key: "api.error.feature-not-available", retryable: false }),
  persistence: apiError({ code: "CORE_UNAVAILABLE", http_status: 503, message_key: "api.error.core-unavailable", retryable: true }),
  internal: apiError({ code: "INTERNAL_ERROR", http_status: 500, message_key: "api.error.internal", retryable: false })
});
