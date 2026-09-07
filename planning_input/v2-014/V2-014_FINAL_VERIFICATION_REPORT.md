# V2-014 Final Verification Report

## Closure scope

V2-014 consists of the committed Slice A recovery foundation plus the Slice B chaos/adversarial gate. It establishes safe application-shell resilience and exact reconciliation of already-sent ambiguous mutations. It does not provide offline clinical execution.

## Verified invariants

- The server remains the sole Session and medical authority.
- `NOT_SENT` work is not queued or automatically sent after reconnect.
- `IN_DOUBT` reconciliation reuses only the exact canonical request and idempotency identity.
- Committed lost responses replay; uncommitted ambiguity cannot fabricate success.
- Refresh, process restart, repeated reconnect, multi-tab contention, stale state, authentication changes, local tampering, storage faults, and service-worker updates fail safely.
- Journal persistence occurs before mutation transport and both journal size and retry attempts are bounded.
- Browser-local Clinical Time, scheduler, diagnostics, Assessment, and cached projections remain non-authoritative.
- Private `/v1` responses and Authorization material are absent from the generic service-worker cache.
- REVIEW_ONLY STEMI remains `UNDER_REVIEW`; no Clinical Approval, Approval Record, or published STEMI package is created.

## Required closure commands

Run from `v2/`:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:v2-014a
npm run test:v2-014b
npm run test:v2-013
npm run test:v2-012a
npm run test:v2-012b
npm run test:v2-011a
npm run test:v2-011b
npm run test:portability-guard
npm run test:playwright
npm run verify
```

Then run `git diff --check` from the repository root. A CLEAN classification requires exit code zero for the full verification, Browser/Deno deterministic equality, native PostgreSQL evidence, real-browser evidence, protected-content hashes, and the final 77-point durability audit.

## Deferred and excluded

There is no remote Supabase project, production-region decision, deployment, Visual Patient implementation, diagnostic-media ingestion, V2-015 work, or fully offline clinical mode. Any future offline medical execution would require a separate explicit architecture decision and task.
