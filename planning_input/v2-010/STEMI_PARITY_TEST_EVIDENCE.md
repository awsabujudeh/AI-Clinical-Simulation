# V2-010 STEMI Parity Test Evidence

Status: **DETERMINISTIC REVIEW EVIDENCE**

## Permanent focused gate

Run from `v2/`:

```powershell
npm run test:v2-010
```

The command runs:

1. Automated 346/346 inventory-ledger accounting.
2. V2-010 Browser parity tests against the real V2-009 Case and `REVIEW_ONLY` execution path.
3. The complete existing V2-009 Browser and Deno gate.
4. The portability guard.

## Required proof map

| # | Required parity proof | Permanent evidence |
|---:|---|---|
| 1 | Deterministic start | V2-009 initial-state/projection and repeatability tests |
| 2 | History facts | V2-010 structured bilingual truth test |
| 3 | Examination facts | V2-010 structured bilingual truth test |
| 4 | Future Patient Agent has structured truth | V2-010 dialogue-policy test |
| 5 | Standard ECG executes/is executable | V2-009 diagnostic authoring and golden-trace tests |
| 6 | Right-sided ECG executes/is executable | V2-009 diagnostic authoring and Excellent trace; V2-010 journey test |
| 7 | Labs execute | V2-009 Delayed trace and diagnostic contract tests |
| 8 | Investigations complete independently | V2-010 nine-diagnostic structure test and V2 diagnostic/session suites |
| 9 | Medication actions use Session | V2-009 clinical probes/golden traces and V2-010 journey test |
| 10 | Rejected/unsafe intent differs from execution | V2-009 nitrate/assessment tests and Session Engine authority suite |
| 11 | Nitrate harm | V2-009 nitrate-harm test |
| 12 | Deterioration | V2-009 T=10/T=18 test |
| 13 | State-dependent oxygen | V2-009 oxygen/fluid test |
| 14 | Diagnosis submission | V2-009 golden traces and V2-010 journey test |
| 15 | Disposition/Cath action | V2-009 Cath/no-cure and golden-trace tests |
| 16 | Committed action evidence | V2-010 journey/evidence test |
| 17 | Assessment scores committed evidence | V2-009 scoring tests and V2-010 journey/evidence test |
| 18 | Exactly six domains | V2-009 rubric and V2-010 journey tests |
| 19 | Unsafe flags | V2-009 critical-effect and V2-010 unsafe-trace tests |
| 20 | Deterministic final/debrief evidence | Assessment Engine finalization/debrief suites; V2-009 review scoring stays non-production |
| 21 | No direct vital mutation | V2-010 Patient State authority test |
| 22 | Explicit rhythm | V2-009 initial-state/deterioration and V2-010 Patient State authority tests |
| 23 | No AI required for Clinical truth | V2-010 dialogue/authority tests and portability guard |
| 24 | No media required for Clinical truth | V2-010 fallback-truth test |
| 25 | Repeated run deterministic | V2-009 Browser/Deno exact snapshot test |

The Case test uses no `PUBLISHED` package. Generic final-assessment/debrief tests prove the deterministic platform capability; the STEMI review artifact correctly remains unable to claim a production finalization boundary.

## Hash invariants

- `review_subject_hash`: `46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`
- `review_execution_hash`: `a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`
- Browser/Deno golden-trace digest: `14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`

The V2-010 focused Browser test asserts these exact values. Any drift fails the gate rather than silently accepting altered reviewed content.

## Audit boundary

The parity matrix and tests prove Case/engine readiness. They do not claim Clinical Approval, final media, Patient AI, UI, API, persistence, deployment, or published-package readiness.
