# V2-014 Local Storage and Cache Boundaries

## IndexedDB recovery database

The browser adapter uses `idb` with database `ai-clinical-simulation-v2-recovery`, schema version `1`, and two stores:

- `recovery_journal`: at most 64 strict version-`1.0` in-doubt mutation records, keyed by deterministic principal/operation/idempotency identity and indexed by non-secret principal ID.
- `safe_projections`: minimized API-safe Session projections scoped by principal and Session and always marked `STALE_LAST_KNOWN` / `mutation_authority: NONE` when read offline.

Journal records contain the API/recovery schema versions, principal/session lookup scope, operation, existing request/correlation/idempotency identifiers, exact validated mutation payload, canonical representation, bounded attempt count, and operational UTC timestamps. They do not contain JWTs, authorization headers, service credentials, complete Session aggregates, hidden Case content, rubrics, scheduler authority, or Assessment answers.

Every recovered object is untrusted input and is revalidated with strict shared Zod schemas. Unknown/incompatible versions, unknown fields, canonical mismatches, changed principals, and malformed values fail closed. Current server authentication, membership, Session authorization, Case execution authority, CAS, and idempotency are always rechecked.

Logout/account cleanup is principal-scoped. Storage operations are transactional where a same-key conflict matters, so two browser contexts cannot overwrite the same journal identity with different canonical content.

## Workbox/PWA boundary

`vite-plugin-pwa` generates a versioned application-shell precache for HTML, hashed JavaScript/CSS, the manifest, and approved static resources. The cache identity follows the application build and is independent of Case semantic versions and API schema versions.

There is no generic runtime cache. `/v1` is excluded from navigation fallback; authenticated API responses, mutation responses, raw Session data, review artifacts, and authorization headers are network/application-state managed. The only persisted Session representation is the explicitly minimized, user/session-scoped safe projection above.

Service-worker updates are prompt-controlled with `skipWaiting: false` and `clientsClaim: false`. A new static shell does not erase IndexedDB recovery metadata or force-reload an in-flight mutation. V2-014B will adversarially exercise update timing and stale-cache behavior.
