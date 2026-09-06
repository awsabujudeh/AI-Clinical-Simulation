# V2-013 Error Model

Every failure uses the shared strict, versioned API error envelope: API schema version, safe request ID, machine code, localization key, correlation ID, HTTP status, and retryability. It never includes SQL, provider details, stack traces, paths, secrets, or hidden clinical truth.

| HTTP | Stable meaning | Representative code |
|---:|---|---|
| 400 | Invalid method/path parameter/header/schema/JSON, unsupported API schema version, or oversized body | `INVALID_REQUEST`, `API_VERSION_UNSUPPORTED`, `REQUEST_BODY_TOO_LARGE` |
| 401 | Missing, invalid, expired, incorrectly issued, or anonymous JWT | `AUTHENTICATION_REQUIRED` |
| 403 | Authenticated principal cannot perform a non-resource-enumerating operation | `NOT_AUTHORIZED` |
| 404 | Resource unavailable under the caller's authority | `RESOURCE_NOT_ACCESSIBLE`, `RESOURCE_NOT_FOUND` |
| 409 | Exact idempotency or optimistic Session conflict; no automatic medical retry | `IDEMPOTENCY_CONFLICT`, `SESSION_VERSION_CONFLICT` |
| 415 | Non-JSON mutating request | `CONTENT_TYPE_UNSUPPORTED` |
| 422 | Well-formed request rejected by domain or availability state | `DOMAIN_REQUEST_REJECTED`, `RESULT_PENDING`, `ASSESSMENT_PENDING` |
| 500 | Unexpected internal invariant failure | `INTERNAL_ERROR` |
| 503 | Trusted core/persistence unavailable or intentionally undelivered capability | `CORE_UNAVAILABLE`, `FEATURE_NOT_AVAILABLE` |

Persistence errors are collapsed at the API service boundary. A stale conflict is returned to the caller and is never automatically rerun against newer medical state.
