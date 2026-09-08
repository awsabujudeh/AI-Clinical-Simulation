# V2-017 Verification Report

## Scope

This report covers the Clinical Monitor, learner-safe committed timeline, Assessment disclosure/finalization, and deterministic debrief presentation. It also covers the strict shared timeline/final Assessment contracts and secure API projection required by those surfaces.

## Permanent gates

- `npm run test:v2-017:browser` — shared contract, secure API, monitor/timeline/Assessment UI, and Browser parity tests.
- `npm run test:v2-017:deno` — exact safe-projection serialization parity.
- `npm run test:v2-017:audit` — static authority, disclosure, privacy, localization, dependency, and scope checks.
- `npm run test:api:postgres` — native PostgreSQL authorization and persisted-event/Assessment projection checks.
- `npm run test:v2-017:playwright` — active Practice, active Assessment withholding, action refresh, finalization/debrief, reload, Arabic RTL, stale state, and responsive browser flows.
- `npm run test:v2-017` — focused aggregate gate.
- `npm run verify` — full V2 regression gate.

## Authority assertions

The monitor consumes only committed safe observations. No waveform or threshold logic is fabricated. Timeline output is a bounded safe projection over committed sequence. Active Assessment remains withheld. Final scores and findings originate only in Assessment Engine output. React performs presentation formatting but no scoring, penalty, cap, unsafe, or medical calculation.

## Excluded scope

No Visual Engine, media ingestion, Three.js, React Three Fiber, Meshy, Patient AI, Tutor AI, RAG, Case Builder, remote Supabase project, production-region configuration, deployment, or V2-018 implementation is included.

Final command results and preservation hashes are recorded in the task completion report after all gates run.
