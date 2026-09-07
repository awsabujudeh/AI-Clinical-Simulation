# V2-014B Adversarial Test Report

## Permanent evidence

The V2-014B suite adds deterministic, explicit-phase fault injection for pre-send loss, committed-response loss, uncommitted ambiguity, reconnect, reload, and exact delivery. The harness is under `tests/fixtures/` only; production recovery code has no failpoint.

Adversarial Browser tests cover:

- exact start/action/end ambiguity and replay;
- no autoexecution of `NOT_SENT` or stale intent;
- coordinator/process replacement and multi-tab same/different request interleavings;
- expired authentication, same-user reauthentication, changed users, disabled membership, and foreign Sessions;
- principal, institution, role, execution-authority, canonical-request, schema, identity, and malformed-record tampering;
- bounded journal capacity and retry attempts, journal-before-send ordering, storage failure, cleanup failure, and corrupted IndexedDB;
- wrong-Session safe projections/journal results, prolonged offline clock/diagnostic/Assessment safety, 24 connectivity transitions, ten recovery cycles, and a mixed action/finalization scenario;
- REVIEW_ONLY STEMI preservation and synthetic production authority pinning.

Playwright supplies actual Chromium IndexedDB, reload, multi-tab, offline-shell, service-worker-update, and Cache Storage evidence. Native PostgreSQL tests remain mandatory for durable lost-response replay, exactly-one-winner behavior, crash rollback, gap-free Events, and exactly-once finalization.

## Production hardening found by Slice B

The adversarial gate found and corrected narrow validation defects without changing authority semantics:

1. A stored journal ID is now re-derived from principal plus exact request.
2. Existing journal identity cannot be rewritten by changing its creation timestamp or regressing its attempt counter.
3. Storage adapter throws are converted to typed recovery failures before transport or result exposure.
4. Server and cached projections, and listed journal entries, must match the requested Session.
5. Principal cleanup removes even malformed records that still declare that principal.
6. Prototype-like identifiers grant no authority.
7. If cleanup fails after a known-unsent or definitive terminal response, the retained record is durably retry-suppressed; successful-response cleanup failures remain exactly replayable.

## Deterministic closure

`npm run test:v2-014b` builds the PWA, executes the focused Browser/Deno chaos suite, audits production boundaries, runs native PostgreSQL API replay tests, runs Playwright, and enforces portability. Full closure additionally requires `npm run verify` and `git diff --check` with all earlier V2 gates green.
