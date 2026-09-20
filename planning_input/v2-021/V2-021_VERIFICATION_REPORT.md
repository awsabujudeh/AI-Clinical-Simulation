# V2-021 — integration verification and human-review handoff

Current status: **V2-021 Visual Patient Engine — CLOSED** for Expo scope.
See [final closeout](V2-021_CLOSEOUT.md); the report below is historical evidence.

Historical initial Visual Patient integration report. The subsequent authorized
Patient Conversation correction and its current verification status are recorded
in `V2-021_PATIENT_CONVERSATION_VERIFICATION.md`. Counts and limitations below
describe the earlier verified tree, not the later correction.

Verdict: **V2_021_STEMI_INTEGRATION — NEEDS_REFINEMENT**

Branch: `v2-development`
Unchanged HEAD: `1b115739987450157aa5ae4c4302a18cbbd3c0ca`
Implementation is local/uncommitted. No commit, push, deployment or new medical approval.

## Delivered and proven

- Actual Student Simulation workspace, native Three.js 0.180.0 integration; no iframe.
- Exact approved Physical Exam V02 asset selection (V02 reuses the V01 GLB/manifest), copied into V2. No production dependency on laboratory paths.
- One retained scene across presentation changes; no repeat GLB load. Approved breathing, face, living/gaze, hand/chest and position layers retained.
- Actual audio media-event subscription drives the independent speaking layer. `playing` enables it; `ended`, `pause`, `error`, cancellation/mute/unmount disable it. Text readiness does not enable it.
- Examination entry/exit, Supine/Semi-Fowler transitions, all six reveal/reset choices, camera autofocus, safe bounds and manual movement tested in the actual App at 1600×1080 and 1280×900.
- A real pointer raycast emits bounded intent; it opens the existing Case-owned Examination catalogue. No clinical action is automatically executed and no finding is created by the visual layer.
- Loading, missing asset, tampered manifest and unavailable WebGL fail to a usable clinical UI.

## Why this is not a full PASS

1. **Actual Patient TTS proof is blocked by existing Case policy.** The unchanged STEMI Case specifies `instructor_notes.patient_ai_access = FORBIDDEN`. The actual question route returns HTTP 422 / `DOMAIN_REQUEST_REJECTED`; the underlying context boundary returns `PATIENT_AI_FORBIDDEN`. No policy override, fabricated answer, synthesized audio or provider request was made. A Pain + Speaking screenshot from actual STEMI audio is therefore **not supplied**. The media-event tests and isolated visual-state test prove the hook, not a live STEMI conversation. An explicit Case-policy decision and authorized existing playback path are needed before this demonstration can pass.
2. The reachable modest-support state retains persistent pain (7/10). There is no reachable full-relief state to record honestly. Relieved/Neutral/Anxious layers are tested only as presentation contracts, not injected into clinical state.
3. Anchor-specific heart/lung audio and pupil-result contracts are absent. Existing composite examination actions remain available; the bridge never treats an anchor click as completion of a broader examination. No sounds, pupil findings or clinical text are invented.

## Verification

| Gate | Result |
|---|---|
| `npm run test:v2-021` | PASS, exit 0: typecheck; 9 Browser tests; 10 source/asset checks; 5 Playwright tests |
| Recheck on restarted final local review host | 5/5 V2-021 Playwright PASS, 48.0 seconds |
| Final `npm run verify` | **PASS, exit 0** |
| Full Browser suite | 872/872, 87 test files |
| Full Deno suite | 36/36 |
| Existing standard Playwright | 11/11 |
| Existing Voice Playwright | 3/3 |
| Persistence / RLS / atomicity / durability | 55 / 152 / 67 / 62 checks PASS |
| PostgreSQL API / Patient Conversation | 29 / 14 checks PASS |
| Typecheck, build, portability, UI/AI/Voice/PWA audits | PASS |
| Asset identity, source protection, secret-signature check | PASS |
| `git diff --check` | PASS |

The first full attempt was stopped by sandbox-only Windows `uv_os_get_passwd ENOMEM`; the same user-info diagnostic succeeded outside the sandbox. No test was weakened to handle this environment issue.

The next attempt exposed a binary-asset false positive in the existing Voice smoke isolation audit: bare ASCII `4183` in approved GLB numeric data was mistaken for an executable diagnostic port. The audit now validates the GLB header before treating those digits as data. All smoke-route, credential and endpoint signatures still scan every asset; executable text keeps the original bare-port check. Regression assertions cover both paths. The final full gate passed after this correction.

Non-fatal warnings: the lazy Three.js runtime chunk is approximately 617 kB minified; the approved GLB is 65,580,508 bytes. No geometry optimization was attempted. The GLB is not service-worker shell precache content. Test-run color/graphics warnings did not prevent the passing results. No Playwright process-termination workaround was needed on the final run.

## Human-review evidence

Actual local App: `http://127.0.0.1:4186/sessions/session.api.0003.idempotency-visual-review`
Start again with `cd v2` then `npm run dev:v2-021` if the local process is stopped.

This loopback-only review composition runs the actual React App and existing API/Session/Clinical/Assessment code with in-memory storage and a synthetic test principal. It is not production authentication or deployment. It loads no secret file and makes no provider request.

Evidence directory:
`C:/Users/ASUS/.codex/visualizations/2026/08/30/01a05380-aba6-7373-9a35-03e0c973da7a/v2-021/`

- `V2-021-STEMI-review.mp4`: 23.36 seconds, 1600×1080, H.264; decoded successfully after conversion. Actual App loading/examination/region/camera/intent recording. **Silent; not evidence of TTS or a relieved clinical transition.**
- `student-primary.png`
- `physical-exam-chest.png`
- `exposed-chest-close.png`
- `supine-examination.png`
- Pain + Speaking: intentionally absent because real audio proof is blocked.

Transient test screenshots/debug output were moved outside the repository into the evidence diagnostics folders, recoverably. They are not positive demo evidence or implementation files.

## File-change inventory

17 existing files modified:

```text
v2/README.md
v2/apps/web/package.json
v2/apps/web/src/features/actions/ClinicalActionsPanel.tsx
v2/apps/web/src/features/conversation/PatientConversationPanel.tsx
v2/apps/web/src/features/simulation/SimulationWorkspace.tsx
v2/apps/web/src/features/voice/PatientSpeech.tsx
v2/apps/web/src/features/voice/elevenlabs-speech-adapter.ts
v2/apps/web/src/features/voice/voice-services.ts
v2/package-lock.json
v2/package.json
v2/packages/api-core/src/service/secure-api-service.ts
v2/packages/contracts/src/api-v1.ts
v2/packages/contracts/src/index.ts
v2/scripts/v2-015-ui-audit.mjs
v2/scripts/v2-020b2a-smoke-audit.mjs
v2/tests/browser/student-ui/clinical-actions.browser.test.tsx
v2/tests/browser/voice/elevenlabs-adapter.browser.test.ts
```

25 files added:

```text
planning_input/v2-021/V2-021_INTEGRATION.md
planning_input/v2-021/V2-021_VERIFICATION_REPORT.md
v2/apps/web/public/visual-patient/stemi/physical-exam-v02/visual_patient_stemi_physical_exam_runtime_v01.glb
v2/apps/web/public/visual-patient/stemi/physical-exam-v02/visual_patient_stemi_physical_exam_runtime_v01.json
v2/apps/web/src/features/visual-patient/VisualPatient.tsx
v2/apps/web/src/features/visual-patient/exam-intent.ts
v2/apps/web/src/features/visual-patient/runtime/camera-navigation.js
v2/apps/web/src/features/visual-patient/runtime/exam.js
v2/apps/web/src/features/visual-patient/runtime/living.js
v2/apps/web/src/features/visual-patient/runtime/runtime.d.ts
v2/apps/web/src/features/visual-patient/runtime/runtime.js
v2/apps/web/src/features/visual-patient/visual-patient.css
v2/apps/web/src/features/voice/patient-audio-playback.ts
v2/packages/api-core/src/service/visual-patient-projection.ts
v2/packages/contracts/src/visual-patient.ts
v2/playwright.v2-021.config.mjs
v2/scripts/v2-021-review-host.mjs
v2/scripts/v2-021-visual-audit.mjs
v2/tests/browser/v2-021-e2e/app.tsx
v2/tests/browser/v2-021-e2e/runtime-harness.html
v2/tests/browser/v2-021-e2e/runtime-harness.ts
v2/tests/browser/v2-021-e2e/runtime.spec.ts
v2/tests/browser/v2-021-e2e/visual.spec.ts
v2/tests/browser/visual-patient/speaking-bridge.browser.test.tsx
v2/tests/browser/visual-patient/visual-patient.browser.test.ts
```

The pre-existing untracked `visual-patient-lab/` is not part of this change inventory. Nothing is staged. Only this verification documentation and relocation of generated diagnostics occurred after the final executable-tree verification.

## Preservation

`VISUAL_PATIENT_LAB_SOURCE_MODIFIED = NO`

Approved GLB/manifest and V04 Blender hashes match the initial inspection. The V02 app, examination, living and camera source texts match the initial read byte-for-byte after line-ending normalization. No laboratory file was edited.

V1 SHA-256 unchanged:

- README: `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`
- HTML: `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`

Frozen Architecture and all ADRs have zero Git diff. Canonical committed hashes:

- Logical: `5190DA35B24E8A45BA50ACDF91279454199F8FF6B4558340CC019DEFB1CDD0DE`
- Physical: `7C27F0D2318A82039E1747EF70B02CB31731A1BEC16D3E74B7EC80C87662FDCA`

Windows checkout uses CRLF because `core.autocrlf=true`; line-ending notices are not content changes.

STEMI remains UNDER_REVIEW / REVIEW_ONLY; medical content and review/golden identities remain unchanged:

- Review subject: `46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`
- Review execution: `a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`
- Golden trace: `14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`

No Clinical Engine/scoring changes, model-policy changes, provider-configuration changes, new synthesis, clinical approval, Anaphylaxis work, remote Supabase, production deployment, commit or push.

Stop for human review; V2-021 is not declared closed.
