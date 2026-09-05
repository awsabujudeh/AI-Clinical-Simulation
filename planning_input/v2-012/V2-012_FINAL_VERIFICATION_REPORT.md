# V2-012 Final Verification Report

Status: **PASS — V2-012 closure gate complete locally**.

## Persistent atomicity evidence

- V2-012A native PostgreSQL transaction suite baseline: 67/67 PASS.
- V2-012B native PostgreSQL durability suite: 62/62 PASS.
- Maximum simultaneous same-base contenders: 32; exactly one winner.
- PostgreSQL: 16.14, default `READ COMMITTED`, `SELECT ... FOR UPDATE` serialization, CAS after lock acquisition.
- Restart cycles: 10/10 coherent.
- Sustained successful command series: 50/50 coherent, with periodic exact retries, stale attempts, and adapter restarts.
- Crash, rollback, lost-response replay, durable corruption, scheduler, Clinical-Time, review/production authority, cross-tenant, and RLS-under-contention checks: PASS.

## Scope and preservation

No migration or production persistence implementation changed in V2-012B. The final slice adds a native adversarial test harness, documentation, and its required npm command. It adds no remote Supabase project, region choice, API, UI, AI/RAG, media, Clinical Approval, published STEMI package, or V2-013 work.

## Complete project gate

The final `npm run verify` executed V2-012B as a mandatory native test and exited 0 on the exact working tree:

- TypeScript typecheck: PASS.
- Portability and determinism guard: PASS.
- V2-011A persistence: 55/55 PASS.
- Native V2-011B RLS: 151/151 PASS, including 28/28 RLS enabled and 28/28 FORCE RLS.
- Native V2-012A atomic persistence: 67/67 PASS.
- Native V2-012B concurrency/durability: 62/62 PASS.
- Vite build: PASS.
- Browser/Vitest: 423/423 PASS across 48 files.
- Deno: 16/16 PASS.
- Playwright: 1/1 PASS.
- `git diff --check`: PASS.

The Browser and Deno suites include Session, Clinical, Assessment, ReviewExecutionArtifact, Diagnostic Contract, Case Schema, contracts, and STEMI review-only deterministic regressions. Approved STEMI `review_subject_hash`, `review_execution_hash`, and golden-trace digest remain exact. V1, frozen Architecture, and accepted ADRs remain unchanged.
