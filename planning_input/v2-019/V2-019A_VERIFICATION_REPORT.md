# V2-019A Verification Report

## Scope

This report covers the Patient Conversation Core only. It uses synthetic, medically neutral fixtures and a mock provider; it performs no real OpenAI call and changes no STEMI content.

## Required gates

- TypeScript typecheck and Vite build
- focused Browser contracts, Case Schema, context/grounding, API, and UI tests
- project-local Deno parity
- native PostgreSQL two-phase/idempotency/RLS tests
- Patient safety and hallucination audit
- focused Playwright learner flow
- V2-018 and older regression gates
- portability guard, full `npm run verify`, and `git diff --check`

## Evidence policy

Final counts and exit codes are reported by the V2-019A recovery completion response after the stable working tree completes all gates. The tracked implementation and permanent commands are the reproducible evidence; this document does not claim a production model winner, medical approval, remote deployment, or V2-019 closure.
