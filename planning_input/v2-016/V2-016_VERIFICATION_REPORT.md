# V2-016 Verification Report

## Scope gates

The permanent V2-016 gate covers strict shared catalogue contracts, server-side safe projection, API authorization and action membership, recovery-backed request construction, action-model validation, component behavior, Browser/Deno serialization equality, real-browser interaction, native PostgreSQL durable action/idempotency regression, and a 61-check static adversarial audit.

The required command is:

```powershell
npm run test:v2-016
```

Full closure additionally runs V2-015, V2-014A/B, V2-013, V2-012A/B, V2-011A/B, domain suites, the complete Playwright suite, and `npm run verify`.

## Invariants under test

- safe catalogue data contains no hidden rubric, rule/effect, fact, scheduler, hash, or governance data
- raw Case Packages and engine packages are absent from browser imports
- ActionRequest rejects client authority and clinical-state injection
- journal-before-transport and exact-key reconciliation remain intact
- known offline, `NOT_SENT`, `IN_DOUBT`, stale, and idempotency-conflict outcomes remain fail-closed
- no optimistic medical state or Clinical-Time mutation
- post-commit and recovery resynchronization use authoritative Session loads
- Arabic/English direction, form semantics, keyboard behavior, and required viewport sizes work in Chromium
- STEMI review-only authority and all protected architecture/content hashes remain unchanged

Exact closure counts and preservation hashes are reported with the final V2-016 task result after the complete gate succeeds.
