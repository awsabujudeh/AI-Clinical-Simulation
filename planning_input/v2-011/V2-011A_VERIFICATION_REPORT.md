# V2-011A Verification Report

## Classification target

V2-011A persistence foundation is locally verifiable. V2-011 remains open.

**RLS SECURITY GATE: PENDING V2-011B**

## Environment

- Repository branch: `v2-development`
- Baseline HEAD: `6ec2eb0e1087f3c8ed0aac4b5c0ff101e9dd680a`
- Node.js: 24.x
- PostgreSQL execution harness: exact-pinned `@electric-sql/pglite` 0.5.8
- Docker, `psql`, Podman, and Supabase CLI: unavailable in the execution environment
- Remote Supabase: not contacted or configured

PGlite executes the versioned SQL against PostgreSQL WASM. The harness creates only the minimal `auth.users` relation supplied by Supabase, applies migrations to two independent empty databases, and then executes real constraints/triggers and contract-object round trips.

## Permanent focused gate

Command:

```powershell
cd v2
npm run test:v2-011a
```

Covered areas:

- empty apply and reset/reapply;
- 28-table catalogue and RLS-enabled/no-policy Slice-A posture;
- canonical JU/JUST metadata and no `UJ` seed;
- Auth/profile/membership separation and FK enforcement;
- exact 16-module Case persistence;
- review artifact versus published package structural authority;
- application-owned module/review/artifact/package hashes;
- exact review and Approval binding, including stale/mismatched rejection;
- production versus review Session authority;
- lossless Session, Patient State, scheduler, clock, event, Assessment, and debrief JSONB;
- Event UUID/sequence uniqueness and immutable history;
- committed-only idempotency substrate and Session-scoped uniqueness;
- integer/fixed-point time and integer score representation;
- diagnostic provenance/hash/fallback metadata without media;
- conservative `RESTRICT` deletion;
- no SQL disease logic, clinical timer, cron, or delete cascade.

Focused result: **55 passed, 0 failed**.

## Round-trip objects

The gate constructs objects through the existing Case Schema, Session Engine, and Assessment Engine, then verifies semantic equality after JSONB readback for:

1. authored Case identity/version and full source payload;
2. `ReviewExecutionArtifact` metadata and full artifact payload;
3. compiled published Case Package payload;
4. complete Session aggregate, Patient State, and pending Scheduler state;
5. canonical committed Event envelope;
6. deterministic production Assessment result and debrief evidence;
7. review Assessment authority.

Database JSON key order is not compared to hash bytes. Canonical hashing remains application-owned.

## Full regression gate

The final run must record:

- `npm ci`: PASS; 0 vulnerabilities
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run test:portability-guard`: PASS
- `npm run test:browser`: PASS; 48 files, 422 tests
- `npm run test:deno`: PASS; 16 tests
- `npm run test:playwright`: PASS; 1/1 test
- `npm run verify`: PASS; exit code 0
- `git diff --check`: PASS

The known Windows Playwright web-server teardown delay occurred after the test completed. Only the Playwright-reported web-server PID was terminated; the runner then exited successfully with the 1/1 PASS summary.

## Security and production status

RLS is only fail-closed scaffolding: every application table has RLS enabled and no client policy exists. V2-011B must implement and adversarially prove the policy/grant matrix with local Supabase roles. No production region has been selected and no production project exists.

The real STEMI Case is not inserted by this test. Its source remains `UNDER_REVIEW` and its executable artifact remains `REVIEW_ONLY`; the test uses medically neutral synthetic fixtures only.
