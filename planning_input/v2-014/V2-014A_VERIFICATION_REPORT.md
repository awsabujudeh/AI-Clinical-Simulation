# V2-014A Verification Report

## Scope

This record covers the Offline/Recovery Foundation only: shared recovery contracts, portable coordination, browser IndexedDB storage, authenticated network transport, Workbox application-shell policy, deterministic Browser/Deno fixtures, and integration with the existing secure API/durable idempotency boundary.

## Permanent proof

- Strict contracts prove version rejection, bounded journal records, stale/non-authoritative projections, and JSON serialization.
- Portable recovery tests prove connectivity, canonical exact retry, bounded reads/mutations, identity scoping, tamper failure, no offline enqueue, and deterministic Browser/Deno output.
- API-backed tests prove lost start/action/end responses resolve through durable replay, stale commands do not autoexecute, changed/disabled principals fail closed, authoritative rehydration wins, and rapid duplicate calls execute once.
- Chromium IndexedDB tests prove reload persistence, same-key conflict protection, scoped safe projections, and principal cleanup.
- Generated-PWA audit proves application-shell precache/offline fallback, prompt-controlled update policy, `/v1` runtime-cache exclusion, and no authorization caching.
- Existing native PostgreSQL V2-013 integration supplies the real durable start/action/end replay proof; V2-011/V2-012 suites preserve RLS, CAS, concurrency, rollback, and crash/replay guarantees.

## Required commands

Run from `v2/`:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:v2-014a
npm run test:v2-013
npm run test:v2-012a
npm run test:v2-012b
npm run test:v2-011a
npm run test:v2-011b
npm run test:portability-guard
npm run test:playwright
npm run verify
```

Then run `git diff --check` from the repository root. Exact final counts and preservation hashes are reported in the task checkpoint; this file intentionally contains no transient machine paths or secrets.

## Deferred to V2-014B

Dedicated service interruption, refresh-during-mutation, process crash/restart, simultaneous-tab interleavings, stale-cache, service-worker update, prolonged-offline, request/response ambiguity, and recovery-chaos matrices remain explicitly deferred. No Slice B implementation is included here.
