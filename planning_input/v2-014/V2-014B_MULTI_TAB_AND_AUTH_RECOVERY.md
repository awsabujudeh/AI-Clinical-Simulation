# V2-014B Multi-Tab and Authentication Recovery

## Multi-context rules

- Concurrent identical submissions share the same canonical request and idempotency identity; only one authoritative execution can result.
- Different requests from the same stale base are independent contenders. The loser receives the server's stale-version outcome and is never rewritten or autoexecuted.
- The in-memory in-flight registry is an optimization only. Correctness survives reload, coordinator replacement, and process restart through local journal metadata plus durable server idempotency.
- Journal identity is re-derived from the principal and exact request. Prototype-like values, changed timestamps, regressed attempt counters, and canonical or identity tampering fail closed.
- Event order, Patient State, Clinical Time, scheduler state, diagnostic readiness, and Assessment truth are always loaded from the server.

## Principal and institution isolation

Recovery records are scoped to the authenticated principal and Session. Local data cannot grant membership, role, institution, ownership, Case authority, or review/production authority.

- Expired or missing authentication blocks reconciliation without consuming the record.
- The same principal may reauthenticate and retry the exact unresolved identity.
- A changed user, disabled membership, foreign Session, or cross-institution request is denied by the current server authorization context.
- Logout deletes only the current principal's local journal and safe projections. Other principals' records are not exposed or deleted.
- Browser and fake-IndexedDB tests cover persistence, competing access, corruption, cleanup, reload, and principal isolation; Playwright covers actual Chromium IndexedDB survival across reload and tabs.

## Disclosure

Last-known projections are explicitly stale and mutation-incapable. Recovery records contain no authorization tokens, rubric answer keys, future scores, hidden debrief content, or authority to unlock a future investigation result.
