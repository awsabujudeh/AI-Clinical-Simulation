# BALSIM selective-salvage classification

Prepared BEFORE implementation changes. Baseline: `589b8f33fe0e0d8663c63a27d837514d25beafa5` on `v2-development`.

70 scoped WIP files: initial classification **33 SALVAGE / 35 REVERT / 2 AUDIT_DOCUMENT**. File categories are exclusive; SALVAGE can contain rejected hunks, as explicitly bounded below. Untracked `visual-patient-lab/` is UNRELATED_PREEXISTING (not counted or edited). No functional-audit gap is authorized in this cleanup.

Before the focused-test compatibility changes: reclassify clinical-actions.browser.test.tsx, patient-conversation.browser.test.tsx and speaking-bridge.browser.test.tsx as SALVAGE (baseline assertions adapted only for retained accessible copy/LocalizationProvider). Investigation-renderer.browser.test.tsx needs no adaptation and is fully REVERT. **Final classification: 35 SALVAGE / 33 REVERT / 2 AUDIT_DOCUMENT.** These narrowly scoped test changes do not retain any redesign selectors.

The functional audit remains byte-identical. Official brand image bytes and provenance are preserved; BRAND_ASSETS.md is corrected only to remove obsolete Home/style-placement claims. Superseded redesign reports and screenshot galleries are removed from the working baseline, not accepted as current readiness evidence. A recovery copy is kept outside the repository.

| Path | Classification | Hunk decision |
|---|---|---|
| `v2/apps/web/index.html` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/apps/web/src/App.tsx` | SALVAGE | Keep theme provider and route-change focus; restore all V2-028 routes/props. Remove case library and redesign routing. |
| `v2/apps/web/src/app/localization.tsx` | SALVAGE | Keep official BALSIM name only; restore baseline copy, locale persistence and RTL. |
| `v2/apps/web/src/components/AppFrame.tsx` | SALVAGE | Keep official branding, theme control and language ARIA group; restore baseline header/navigation/layout. |
| `v2/apps/web/src/features/actions/ClinicalActionsPanel.tsx` | SALVAGE | Keep keyboard tab navigation only; restore baseline actions layout/copy/clinical data. |
| `v2/apps/web/src/features/actions/ClinicalInterpreterPanel.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/assessment/AssessmentDebriefPanel.tsx` | SALVAGE | Keep intentional confirmation for existing production End only; remove local review-completion semantics and redesign. |
| `v2/apps/web/src/features/assessment/TutorDebriefPanel.tsx` | SALVAGE | Keep duplicate in-flight guard and domain labels; restore baseline manual Tutor load, evidence and layout. |
| `v2/apps/web/src/features/assessment/assessment-model.ts` | SALVAGE | Keep presentation-only domain labels; deterministic score unchanged. |
| `v2/apps/web/src/features/conversation/PatientConversationPanel.tsx` | SALVAGE | Keep loading/ended/availability copy and bidi semantics; restore baseline structure. |
| `v2/apps/web/src/features/faculty/FacultyPage.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/investigations/InvestigationResults.tsx` | SALVAGE | Keep display-only label/unit formatting; restore baseline result layout, timing, review labels and images. |
| `v2/apps/web/src/features/monitor/ClinicalMonitor.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/monitor/monitor-model.ts` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/public/ExpoLanding.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/public/PublicLanding.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/simulation/ConnectionBanner.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/simulation/SessionPage.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/simulation/SimulationWorkspace.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/visual-patient/VisualPatient.tsx` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/visual-patient/visual-patient.css` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/apps/web/src/features/voice/PatientSpeech.tsx` | SALVAGE | Keep localized accessible phase/failure labels; restore baseline structure and all Voice behavior. |
| `v2/apps/web/src/features/voice/VoiceCapture.tsx` | SALVAGE | Keep localized accessible phase/failure labels and bidi; restore baseline structure and all Voice behavior. |
| `v2/apps/web/vite.config.mjs` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/package.json` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `v2/tests/browser/student-ui/clinical-actions.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/student-ui/monitor-timeline-assessment.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/student-ui/patient-conversation.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/student-ui/student-shell.browser.test.tsx` | REVERT | Restore entire baseline test; no redesign assertions retained. |
| `v2/tests/browser/v2-025-e2e/faculty.spec.ts` | REVERT | Restore entire baseline test; no redesign assertions retained. |
| `v2/tests/browser/visual-patient/investigation-renderer.browser.test.tsx` | REVERT | Restore entire baseline test; no redesign assertions retained. |
| `v2/tests/browser/visual-patient/speaking-bridge.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/voice/voice-ui.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tsconfig.json` | REVERT | Restore entire file to V2-028; rejected redesign/test wiring only. |
| `planning_input/uiux/BALSIM_SIMULATION_FUNCTIONAL_AUDIT.md` | AUDIT_DOCUMENT | Preserve byte-identical. |
| `planning_input/uiux/BRAND_ASSETS.md` | AUDIT_DOCUMENT | Preserve provenance; correct obsolete layout claims after salvage. |
| `planning_input/uiux/FACULTY_UX_AUDIT.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `planning_input/uiux/HOST_UX_AUDIT.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `planning_input/uiux/STUDENT_UX_AUDIT.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `planning_input/uiux/UIUX_AUDIT.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `planning_input/uiux/UIUX_OWNER_REVIEW_HANDOFF.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `planning_input/uiux/UIUX_VERIFICATION.md` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/apps/web/public/brand/balsim-bright.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-dark.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-mark-bright.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-mark-dark.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-official-reference.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-wordmark-bright.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/public/brand/balsim-wordmark-dark.png` | SALVAGE | Preserve official image bytes; no new artwork. |
| `v2/apps/web/src/app/theme.tsx` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/apps/web/src/components/Brand.tsx` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/apps/web/src/components/Icon.tsx` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/apps/web/src/design-system.css` | SALVAGE | Reconstruct color-mode and focus/brand support only; remove layout, typography, hero/card/grid and decorative redesign rules. |
| `v2/apps/web/src/features/assessment/debrief.css` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/apps/web/src/features/faculty/faculty.css` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/apps/web/src/features/investigations/diagnostic-presentation.ts` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/apps/web/src/features/public/ExpoCaseLibrary.tsx` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/apps/web/src/features/simulation/student-experience.css` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/playwright.uiux.config.mjs` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/runtime/uiux-review-composition.ts` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/runtime/uiux-review-entry.tsx` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/scripts/uiux-brand-assets.ps1` | SALVAGE | Preserve separable brand/theme/accessibility/display utility or associated tests only. |
| `v2/scripts/uiux-review-host-test.mjs` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/scripts/uiux-review-host.mjs` | REVERT | Remove rejected redesign-only file/report; recovery copy outside repository. |
| `v2/tests/browser/uiux-e2e/ux.spec.ts` | REVERT | Restore entire baseline test; no redesign assertions retained. |
| `v2/tests/browser/uiux/assessment-presentation.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/uiux/contrast.browser.test.tsx` | REVERT | Restore entire baseline test; no redesign assertions retained. |
| `v2/tests/browser/uiux/investigation-values.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/uiux/shell.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |
| `v2/tests/browser/uiux/student-presentation.browser.test.tsx` | SALVAGE | Keep tests for accepted accessibility/display behavior; baseline selectors, status copy and locale-provider wrapping only. Remove rejected-layout assertions. |

## Protected scope

No edits to packages, case content, frozen Architecture/ADRs, V1, closed runtime hosts, Voice adapters, clinical/assessment rules, Visual Patient runtime, GLBs/manifests/animations or Visual Patient Lab. No provider requests, commit, push or V2-029.

## Completion result

**BALSIM_UI_WIP_BASELINE_READY — YES**

Final input disposition: **70 files = 35 SALVAGE + 33 REVERT + 2 AUDIT_DOCUMENT**.
The matrix categories above reflect the final narrowly scoped test adaptations.
**20 mixed files reconstructed:** 15 tracked files (all retained tracked files except index.html, vite.config.mjs and assessment-model.ts) plus design-system.css and the four uiux Browser-test files. The remaining 15 salvaged files were retained as separable foundations/assets.

### Retained capabilities

- Official raster images and crop provenance, compact header mark, favicon/PWA naming; no new Home composition.
- Bright/Dark preference infrastructure, storage-denial fallback, color-only substitutions; baseline typography/layout remains in styles.css.
- Existing English default and Arabic RTL retained. Accessible language grouping and localized Voice state/failure labels.
- Route-change main-content focus and keyboard/RTL action-tab navigation; neither executes an action.
- Explicit confirmation before the existing production End action; REVIEW_ONLY remains unable to finalize production.
- Existing manual Tutor snapshot with in-flight duplicate guard; no automatic review-completion or new assessment placement.
- Presentation-only exact domain/diagnostic labels and units, numeric bidi isolation; no value conversion, score calculation or clinical inference.
- Conversation loading/ended/online-unavailable copy and bidi isolation, without changing service/provider contracts.

### Removed rejected work

- Rejected Public/Home/Expo Hero, case-library cards/orientation routes, simulation page and Assessment/Faculty redesign.
- New layout CSS, typography/grid/card hierarchy, cosmetic Visual Patient wrapper changes and redesigned Interpreter placement.
- Local reviewComplete/onReviewComplete and automatic Tutor loading; no invented local finalization semantics.
- Redesign-only host/composition/config/package wiring, gallery and obsolete readiness reports.
- No fixed-shell design or any of the ten functional work packages was begun.

### Verification

- Focused Browser suite: **260 distinct tests in 29 files PASS** across final per-file runs. Initial 9 failures were stale test integration expectations after reconstruction (removed summary/layout selectors, retained status copy, and standalone LocalizationProvider); these were corrected without restoring redesign behavior. Only failing files were rerun. Final runs: 24 initially passing files (213 tests) + 3 corrected passing files (29 tests) + 2 corrected passing files (18 tests).
- Browser scope: student-ui, uiux accepted foundations, voice, visual-patient, faculty, tutor, preflight, security.
- **5 actual-app scenarios PASS**: Khalid current-case review route, Dana review route, STEMI Tutor test-double/evidence/outage, Faculty catalogue/details/DRAFT/edit/reload/review guards, operator Preflight/degradation/injected failure/origin guards.
- Both patient-route checks: one model load; stable model identity through chest examination/Cover Reset; medication form/catalogue and investigation panels; configured conversation boundary and assessment access. No question/token/provider POST sent.
- Khalid's first diagnostic test used the old default offline V2-021 fixture, which correctly withheld media for its different pinned version. The same check passed with the existing V2-024 host's current STEMI 2.0.1 REVIEW_ONLY artifact. No production/source code was altered to bypass the version gate.
- `npm run test:v2-028:node`: **12/12 PASS** (review-host security, asset hashes, fallback, stale hosts, bounded probes, redacted readiness, pending sources).
- `npm run typecheck`: PASS, exit 0.
- `npm run build`: PASS, exit 0. Existing >500 kB bundle warning remains non-blocking.
- `npm run test:portability-guard`: PASS, exit 0.
- V2-027 source/bundle/diagnostic secret scan: PASS. No environment values read or printed.
- `git diff --check`: PASS.
- Windows Playwright teardown required stopping only exact verified task-owned server PIDs after scenarios finished. No owner host was stopped. One concurrent dev-HMR port warning did not affect HTTP/app proofs.

### Preservation

- Functional audit SHA-256 unchanged: `E64BD4DFD24FA4BF72F5F343F650D6C9D7BE753E8164C8DF52B42F8B3F4B4E00`.
- V1 README SHA-256: `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`.
- V1 er_sim_10.html SHA-256: `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`.
- Zero Git content diff for packages, case/media content, runtime, approved patient assets, frozen Architecture and prior ADRs. Visual Patient Lab not edited.
- V2-027 ownership, role/institution/cross-case boundaries, provider budgets, replay guards, private no-cache and sanitized logging unchanged; focused security tests pass.
- V2-028 READY/DEGRADED/BLOCKED, stale-host and redacted diagnostic logic unchanged; Browser/Node/actual-app checks pass.
- Both cases remain UNDER_REVIEW / REVIEW_ONLY. No clinical or media approval asserted.

### Exact remaining content changes

**A. Functional audit** (preserved, intentionally untracked):

- `planning_input/uiux/BALSIM_SIMULATION_FUNCTIONAL_AUDIT.md`

**B. Salvaged foundations, tests, brand provenance and cleanup record**:

- `v2/apps/web/index.html`
- `v2/apps/web/src/App.tsx`
- `v2/apps/web/src/app/localization.tsx`
- `v2/apps/web/src/components/AppFrame.tsx`
- `v2/apps/web/src/features/actions/ClinicalActionsPanel.tsx`
- `v2/apps/web/src/features/assessment/AssessmentDebriefPanel.tsx`
- `v2/apps/web/src/features/assessment/TutorDebriefPanel.tsx`
- `v2/apps/web/src/features/assessment/assessment-model.ts`
- `v2/apps/web/src/features/conversation/PatientConversationPanel.tsx`
- `v2/apps/web/src/features/investigations/InvestigationResults.tsx`
- `v2/apps/web/src/features/voice/PatientSpeech.tsx`
- `v2/apps/web/src/features/voice/VoiceCapture.tsx`
- `v2/apps/web/vite.config.mjs`
- `v2/tests/browser/student-ui/clinical-actions.browser.test.tsx`
- `v2/tests/browser/student-ui/monitor-timeline-assessment.browser.test.tsx`
- `v2/tests/browser/student-ui/patient-conversation.browser.test.tsx`
- `v2/tests/browser/visual-patient/speaking-bridge.browser.test.tsx`
- `v2/tests/browser/voice/voice-ui.browser.test.tsx`
- `v2/apps/web/public/brand/balsim-bright.png`
- `v2/apps/web/public/brand/balsim-dark.png`
- `v2/apps/web/public/brand/balsim-mark-bright.png`
- `v2/apps/web/public/brand/balsim-mark-dark.png`
- `v2/apps/web/public/brand/balsim-official-reference.png`
- `v2/apps/web/public/brand/balsim-wordmark-bright.png`
- `v2/apps/web/public/brand/balsim-wordmark-dark.png`
- `v2/apps/web/src/app/theme.tsx`
- `v2/apps/web/src/components/Brand.tsx`
- `v2/apps/web/src/components/Icon.tsx`
- `v2/apps/web/src/design-system.css`
- `v2/apps/web/src/features/investigations/diagnostic-presentation.ts`
- `v2/scripts/uiux-brand-assets.ps1`
- `v2/tests/browser/uiux/assessment-presentation.browser.test.tsx`
- `v2/tests/browser/uiux/investigation-values.browser.test.tsx`
- `v2/tests/browser/uiux/shell.browser.test.tsx`
- `v2/tests/browser/uiux/student-presentation.browser.test.tsx`
- `planning_input/uiux/BRAND_ASSETS.md` — provenance retained; obsolete Home/style-placement claims removed.
- `planning_input/uiux/BALSIM_SELECTIVE_SALVAGE.md` — this classification and completion record.

That is **38 scoped files with content changes/untracked content**: 18 tracked deltas, 17 new foundation/asset/test files, the preserved audit, brand provenance, and this new record.
Tracked delta: **+189 / -53 lines**. New/untracked file lines are not included in Git's tracked diff-stat.
A stale tsconfig status marker was repaired only after proving HEAD/index/worktree canonical blob identity; the file has zero Git content diff and the index still matches HEAD.

**C. UNRELATED_PREEXISTING**:

- `visual-patient-lab/` remains intentionally untracked and untouched.

**D. Unexpected content**: NONE. Zero rejected visual-layout WIP remains. Test-only smoke tooling/results remain in ignored test-results, not source or candidate commit content.

### Local diagnostic evidence / recovery

- Khalid: `v2/test-results/baseline-salvage/khalid-results/routes-Khalid-restored-Stu-a1c72-l-exam-catalogue-disclosure/Khalid-baseline.png`.
- Dana: `v2/test-results/baseline-salvage/results/routes-Dana-restored-Stude-814b5-l-exam-catalogue-disclosure/Dana-baseline.png`.
- Full rejected WIP/reports/gallery and transient failure screenshots are recoverable outside the repository at `C:/Users/ASUS/AppData/Local/Temp/balsim-uiux-salvage-5db14ec3177548b49ecc3eacd539016c/`. Only exact scoped files/artifact directories were moved or reverted; no blanket clean/reset.
- Source remains uncommitted; nothing staged; branch/HEAD unchanged. No push, provider requests, functional work package, final mockup or V2-029.
- Remaining blocker: NONE for this selective-salvage baseline. This is not approval of a final UI and does not resolve the preserved audit's functional gaps.
