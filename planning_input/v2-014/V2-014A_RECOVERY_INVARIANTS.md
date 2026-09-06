# V2-014A Recovery Invariants

1. The server remains the only medical and Session authority.
2. The browser never runs Clinical Engine rules or scheduler work offline.
3. Clinical Time and observations freeze in a stale safe projection while unreachable.
4. There is no offline clinical-action queue.
5. `NOT_SENT` intent is not automatically executed after reconnect.
6. `IN_DOUBT` means a send was attempted without a definitive response.
7. Exact reconciliation preserves the original canonical request and idempotency key.
8. Mutation attempts and safe-read retries are bounded.
9. A stale command is never reconstructed or reexecuted against refreshed state.
10. Only authoritative `/v1` responses establish confirmed execution or rejection.
11. Rapid-request coalescing is a UX optimization, not correctness authority.
12. Local data grants no identity, membership, role, institution, Session ownership, or execution authority.
13. Reconciliation requires a verified current principal matching the journal scope; the API reauthorizes the Session.
14. Changed users, disabled memberships, foreign Sessions, malformed records, and canonical mismatches fail closed.
15. Last-known projections are strict, user/session scoped, stale, and mutation-incapable.
16. Workbox caches only the application shell and approved static resources; private `/v1` responses and authorization material are not generically cached.
17. Service-worker cache versioning is independent of Case versions and recovery storage.
18. Start, action, and finalization response loss resolve through existing durable server replay without duplicate Session creation, Event/state advance, or terminal finalization.
19. No remote Supabase project, production region, offline medical mode, media ingestion, Visual Patient, or deployment is introduced.
20. V2-014 is not closed until Slice B completes the dedicated chaos/adversarial recovery gate.
