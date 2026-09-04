# V2-012A Verification Report

Status: implementation slice complete locally; V2-012 is **not closed** pending V2-012B.

The focused native suite uses exact-pinned PostgreSQL 16.14 through `embedded-postgres@16.14.0-beta.17`. Its final result is **67 passed, 0 failed**. It applies the complete migration chain to empty and reset databases, exercises trusted `service_role` RPC access, and confirms anonymous/authenticated callers retain no authority.

Coverage includes production and real STEMI review-session rehydration, exact Patient State/Clinical Time/clock/scheduler/Event/replay/checkpoint round trips, stale CAS rejection, Event identity and sequence preservation, durable exact replay, conflicting idempotency reuse, duplicate Event and invalid sequence rejection, a real late Event-sequence uniqueness violation after an earlier tentative Event insert, and forced failures at replay insert, checkpoint insert, and final Session update. Every late failure is checked for zero partial Session, Event, checkpoint, or replay persistence.

The real STEMI evidence is structural and remains `UNDER_REVIEW` / `REVIEW_ONLY`; its approved review-subject and review-execution hashes are asserted unchanged. No Clinical Approval or published STEMI package is created.

The final `npm run verify` gate exits 0: V2-011A is 55/55, native V2-011B is 151/151, Browser is 423/423, Deno is 16/16, Playwright is 1/1, and typecheck, portability, build, Session, Clinical, Assessment, diagnostic, and review-artifact regressions pass. Slice B remains responsible for the dedicated concurrency race, crash/failure, and recovery adversarial closure gate.
