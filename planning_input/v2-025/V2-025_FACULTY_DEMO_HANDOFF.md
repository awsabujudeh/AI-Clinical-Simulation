# V2-025 — Constrained Faculty case-management demo

Status: V2-025 Faculty Case Management Demo — CLOSED, for the local Expo sandbox scope.

Delivered: Faculty catalogue, case detail inspection, metadata-only DRAFT creation/editing, refresh-safe demo persistence, and authorization/review safeguards.

- AI_CASE_BUILDER = DEFERRED_POST_EXPO
- ADVANCED_FACULTY_ANALYTICS = DEFERRED_POST_EXPO
- COHORT / ASSIGNMENT MANAGEMENT = DEFERRED_POST_EXPO
- PRODUCTION_PERSISTENCE = NOT_PART_OF_EXPO_DEMO_SCOPE

## Run and demonstrate

From `v2`, run `npm run dev:v2-025`, then open `http://127.0.0.1:4193/expo`.
Choose **Faculty demo — case management** → catalogue → STEMI details → New Case Draft → Save DRAFT. Edit its metadata and refresh: the saved revision remains in the catalogue/details while the host runs.

This is the real V2 App/router/components, composed with an explicit local Faculty service. Normal production App composition has no Faculty service and displays unavailable, not an invented production login. No AI/provider/environment credentials are needed.

## Contract and authority reuse

- Inspected existing contracts: no implemented FacultyProfile/CaseManagement service exists to reuse. Case identity/version/lifecycle, classification codes, localization text, patient language, curriculum mappings, source references and API membership roles are reused.
- `case-schema/src/faculty-metadata.ts` derives a small strict metadata editing surface and read projection from those existing schemas. It is NOT a second clinical Case Package schema.
- New records are explicitly metadata-only DRAFT shells: title, specialty, difficulty, language and educational description. Their generated IDs/version do not make them playable. No patient facts, effects, rules, rubric, sources or approvals are synthesized. They cannot pass DraftCasePackageSchema or any production compile/start boundary.
- Catalogue/detail seed is projected server-side from the real validated STEMI 2.0.1 ReviewExecutionArtifact and matching V2-022 media manifest. No Case fixture, internal prompt or credential is shipped to the browser. Full medical authoring is deferred.
- STEMI remains UNDER_REVIEW / REVIEW_ONLY, NOT MEDICALLY APPROVED, read-only. Sources remain UNRESOLVED; JU/JUST UNKNOWN mapping IDs remain explicitly unapproved, not official alignment. Existing authored competencies and critical-action summary are visible.
- Media status preserves the pending ECG/CXR physician review, right-sided ECG/echo media pending, and the documented ECG report 84 bpm vs Case 112 bpm discrepancy. No medical or rights review was performed here.

## Persistence and authorization

- Separate loopback fixture-host boundary, following V2-021/024 local review hosts. In-memory Map, maximum 100 total entries; refresh/reload persists while that process runs. Host restart intentionally loses drafts. No database, localStorage or production persistence is claimed.
- The local host fixes one explicitly labeled demo Faculty membership/institution. It is a sandbox persona, NOT production authentication. Browser role/institution overrides are not accepted. Store operations check Faculty role and institution; null, learner, reviewer and cross-institution access fail closed.
- Only list/create/update-metadata operations exist. All seeded non-shell Case versions are read-only. DRAFT is assigned server-side, and strict input rejects status/identity/clinical writes. Revision compare-and-swap rejects stale metadata edits. Inputs/results are copied; failed writes do not alter stored records.
- Host checks exact loopback Host/Origin, rejects cross-site requests, requires same-origin JSON writes, bounds body size and has no production API forwarding. No review/approve/publish endpoints. This host must not be exposed as an institutional production service.
- AI-assisted Case Builder is clearly labeled planned/deferred. No provider request or fake generation exists.

## Focused evidence

- `npm run typecheck`: PASS.
- `npm run test:v2-025`: 8 Browser tests PASS (real source projection; role/institution matrix; DRAFT-only shell/reload/reset; injection rejection; update/revision conflict; review/published read-only; invalid/prototype IDs; reference isolation/no publish API).
- `npm run test:v2-025:playwright`: 1 actual-App scenario PASS: entry/catalogue, STEMI details/status, form/create, edit, refresh, catalogue, forbidden payload, absent review/publish endpoints, cross-origin rejection.
- `npm run build`: PASS. Existing >500 kB chunk warning retained. No build configuration weakened.
- `git diff --check`: PASS. No broad suite or live provider testing.
- Initial typecheck caught the wrong source-list property; corrected to existing `validation.sources`. Initial host run caught the JSON import attribute; corrected for Node. Final focused checks cover the corrected tree.
- Windows Playwright teardown required terminating only verified test-owned PID 69268 after its test passed.

Actual-App screenshots (ignored disposable proof, not intended for commit):

- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-catalogue.png`
- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-stemi-details.png`
- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-new-draft.png`
- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-created-draft.png`

## Deliberate limits / preservation

Functional English Faculty demo with existing shared language navigation; a full bilingual Faculty translation pass and visual polish are not claimed. No analytics, cohorts, assignments, permission administration, AI authoring or publication redesign. A shell is intentionally incomplete and non-executable. Normal student services/routes and simulation truth remain unchanged.

V1, frozen Architecture, ADRs, STEMI content, V2-022 manifest and Visual Patient Lab are unchanged. Medical Review Gate Closure remains independent. Owner-authorized closeout creates one scoped V2-025 commit; no push, deployment or V2-026 work.
