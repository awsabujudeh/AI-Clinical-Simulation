# V2-018 Structured Output and Failure Model

Every trusted capability supplies one strict Zod output schema. The gateway derives its JSON Schema for the provider request and requires a strict top-level object. Provider Structured Outputs use `text.format.type = json_schema` with `strict = true`; completed text is then parsed as JSON and validated again with the original local Zod schema. Unknown fields, missing fields, invalid enums, malformed JSON, unsupported versions, refusal, incomplete content, and partial/multiple output fail closed.

The normalized provider-neutral Result contains either validated JSON data plus safe metadata or a stable error. It never exposes a raw provider body. Stable categories distinguish invalid requests, disabled capability, missing configuration, timeout, rate limit, provider unavailability/rejection, incomplete/refused output, malformed output, local schema mismatch, budget denial, and unexpected failure.

The timeout uses `AbortController`. Attempts are capability-owned and limited to one or two. Only transport failures, HTTP 429, and selected 500/502/503/504 responses may receive the one bounded retry. HTTP 4xx policy/authentication errors, refusal, malformed output, and local schema failures are not retried. No retry has clinical side effects because the gateway has no clinical mutation authority.
