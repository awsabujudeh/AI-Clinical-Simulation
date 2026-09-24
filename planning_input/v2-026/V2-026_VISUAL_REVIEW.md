# V2-026 Dana — owner-approved visual review record

Current status: **OWNER_VISUAL_APPROVAL = GRANTED; V2-026 — CLOSED**.
The accepted baseline is v25. See [final closeout](V2-026_CLOSEOUT.md).
Physician/rights review remain separate and pending. The candidate notes below
are historical evidence, not the current approval status.

Status: READY_FOR_OWNER_VISUAL_REVIEW. See [current micro-repair QA](V2-026_MICRO_REPAIR_QA.md)
for the current v12 candidate, actual-app close-up evidence and honest limitations.
The real Dana Conversation/ElevenLabs proof already PASSED before this repair;
it was not repeated. The previous artifacts/results below are historical.
No owner visual approval, physician approval, final voice selection or publication
is implied. No clinical case edits were made in this visual completion pass.

## Artifacts

New independent Blender working file:
`visual-patient-lab/blender/patient_anaphylaxis_dana_v03.blend`.
v01/v02 and STEMI files were not overwritten.

Review images (local, ignored test evidence):

- [Anxious face](../../v2/test-results/v2-026/dana-face-anxious.png)
- [Improved/calm face](../../v2/test-results/v2-026/dana-face-improved.png)
- [Closed blink](../../v2/test-results/v2-026/dana-face-blink.png)
- [Speaking shape](../../v2/test-results/v2-026/dana-face-speaking.png)
- [Initial actual V2 app](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-actual-app.png)
- [Scratching](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-scratching.png)
- [Arm/rash examination](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-exam-Left.png)
- [Covered chest examination](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-exam-top.png)
- [Face examination](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-exam-Face.png)
- [Neck examination](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-exam-Neck.png)
- [Treatment-driven improvement](../../v2/test-results/v2-026-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-improved.png)
- [Forced-failure fallback in V2](../../v2/test-results/v2-026-app/v2-026-e2e-dana-forced-Dan-2cd9a-d-retains-clinical-controls/dana-static-fallback-app.png)
- [Synthetic local-audio lifecycle only](../../v2/test-results/v2-026-app/v2-026-e2e-runtime-actual--d4a3b-ng-not-live-provider-proof-/dana-synthetic-playback-speaking.png)

The final image uses a local WAV fixture, NOT Terra/ElevenLabs speech. No live
answer, provider success, approved Dana voice or audible TTD proof is fabricated.
Blink, scratch and breathing motion can be reviewed at `http://127.0.0.1:4194/`
after starting `npm run dev:v2-026`. Offline mode truthfully shows conversation
unavailable. No credentials are loaded by the default host.

Packaged fallback:
`v2/apps/web/public/visual-patient/dana/review-v01/dana-static-anxious.png`.
It is derived from the exact Dana scene and clearly labeled as an initial-state
reference still. Clinical monitor/actions remain authoritative and usable.

## Verification

- 37 focused Browser tests: Dana clinical foundation, motion envelopes, static
  fallback, explicit two-way patient-context/asset isolation and affected STEMI
  visual/conversation/investigation/media regressions — PASS.
- 6 injected-I/O live-composition tests — PASS. No real provider calls.
- 4 focused Playwright scenarios — PASS: STEMI runtime regression; actual Dana
  app/exam/treatment/ECG; forced GLB failure; actual local WAV START/END with
  mouth movement, anxiety/breathing preservation and one loaded instance.
- Typecheck, production build and final `git diff --check` — PASS (exit 0).
  Build retains the existing >500 kB chunk warning; no new build failure.
- GLB/fallback hashes, required morphs, skeleton/base clip, textures, absence of
  male patient meshes and truthful review statuses — PASS.
- Blender deformation integrity checks — PASS: finite bounded deltas; both
  connected eye globes untouched. Appearance still requires owner acceptance.

Screenshot QA corrected supine arm transport/forearm framing. The new playback
test also caught and corrected Dana briefly inheriting the shared STEMI initial
face default; no test threshold was relaxed. Rash rendering is localized and
irregular rather than a full-body color shift. No severe respiratory deformation
or advanced lip-sync was introduced. Lip swelling is visually deferred.

The known Windows Playwright teardown delay is handled only after the tests
finish, by identifying and terminating their exact owned review-host process.
Generated evidence remains outside staged/committed content.

## Remaining gate

Finish the residual visual defects identified in the current repair QA, then
obtain owner visual acceptance. Do not repeat the already-passing live proof.
Keep UNDER_REVIEW / REVIEW_ONLY, unresolved rights and physician review truthful.
