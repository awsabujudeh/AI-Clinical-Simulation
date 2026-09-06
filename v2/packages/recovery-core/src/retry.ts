export const READ_RETRY_MAX_ATTEMPTS = 3 as const;
export const READ_RETRY_BACKOFF_MILLISECONDS = Object.freeze([0, 250, 1_000] as const);

export type ApiResponseClassification =
  | "SUCCESS"
  | "AUTHENTICATION_EXPIRED"
  | "AUTHORIZATION_FAILURE"
  | "STALE_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "DEPENDENCY_UNAVAILABLE"
  | "DEFINITIVE_REJECTION"
  | "INVALID_RESPONSE";

export function classifyApiResponse(
  status: number,
  errorCode: string | undefined
): ApiResponseClassification {
  if (status >= 200 && status < 300) return "SUCCESS";
  if (status === 401) return "AUTHENTICATION_EXPIRED";
  if (status === 403 || status === 404) return "AUTHORIZATION_FAILURE";
  if (status === 409 && errorCode === "SESSION_VERSION_CONFLICT") return "STALE_CONFLICT";
  if (status === 409 && errorCode === "IDEMPOTENCY_CONFLICT") return "IDEMPOTENCY_CONFLICT";
  if (status === 500 || status === 503) return "DEPENDENCY_UNAVAILABLE";
  if ([400, 409, 415, 422].includes(status)) return "DEFINITIVE_REJECTION";
  return "INVALID_RESPONSE";
}

export function shouldRetrySafeRead(input: {
  attempt: number;
  result: "NETWORK_FAILURE" | "DEPENDENCY_UNAVAILABLE" | "SEMANTIC_RESPONSE";
}): boolean {
  return Number.isInteger(input.attempt)
    && input.attempt >= 1
    && input.attempt < READ_RETRY_MAX_ATTEMPTS
    && input.result !== "SEMANTIC_RESPONSE";
}

export function readRetryDelayMilliseconds(attempt: number): number | undefined {
  return Number.isInteger(attempt) && attempt >= 1 && attempt <= READ_RETRY_MAX_ATTEMPTS
    ? READ_RETRY_BACKOFF_MILLISECONDS[attempt - 1]
    : undefined;
}
