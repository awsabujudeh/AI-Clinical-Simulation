# V2-013 Verification Report

Status: **PASS**. The final V2-013 tree passed the complete local closure gate on 2026-09-06.

Permanent V2-013 coverage includes strict contracts, verified JWT behavior, database-derived authority, tenant/session ownership, real STEMI review-only denial, safe projections, Clinical Action Coordinator integration, start/action/end idempotency, stale conflicts, concurrency, atomic rollback, diagnostic milestones, future-capability behavior, CORS, body limits, Browser/Deno equality, and native PostgreSQL execution.

Required closure commands:

```text
npm run typecheck
npm run build
npm run test:v2-013
npm run test:portability-guard
npm run test:playwright
npm run test:v2-011a
npm run test:v2-011b
npm run test:v2-012a
npm run test:v2-012b
npm run verify
git diff --check
```

Final results:

- focused API Browser: 46/46
- focused API Deno: 2/2; Browser and Deno bind the same exact serialized API snapshot bytes
- native PostgreSQL/API: 25/25
- V2-011A persistence: 55/55
- V2-011B native RLS: 151/151; all 28 application tables retain RLS and FORCE RLS
- V2-012A atomic persistence: 67/67
- V2-012B durability/concurrency: 62/62
- complete Browser: 469/469
- complete Deno: 18/18
- Playwright: 1/1
- typecheck, build, portability guard, and `git diff --check`: PASS
- `npm run verify`: PASS, exit code 0

Native integration exposed and permanently corrected an append-only finalization defect. The rejected behavior attempted to update a historical checkpoint. Final behavior uses the existing V2-012 atomic Session commit authority for any synchronized pre-terminal state, appends the terminal Event, appends a new terminal checkpoint, and updates the Session terminal aggregate in one PostgreSQL transaction. Native failure injection proves complete rollback if terminal Event insertion, terminal checkpoint insertion, or final Session update fails; prior checkpoint bytes remain unchanged. No clinical rule, score, outcome, or medical decision moved into SQL, so no architecture change or ADR was required.

The V2-012A/B regression scripts now deliberately select the migration horizon ending at V2-012A. This preserves their original 67/62 proofs after the additive V2-013 migration; V2-013 migration behavior is covered separately by the 25 native API tests.

No remote Supabase project, deployment, production region, real secret, medical content change, Clinical Approval, or V2-014 work is part of this gate.
