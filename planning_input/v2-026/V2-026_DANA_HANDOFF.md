# V2-026 — Dana / Anaphylaxis implementation checkpoint

Status: **V2-026 — CLOSED**. Owner visual approval granted for the current v25 Expo baseline.
Technical implementation complete; prior live Dana provider proof remains passed.
Physician review and formal rights review remain pending; no publication approval.
The [final closeout](V2-026_CLOSEOUT.md) is the current status authority.
Baseline: `bfb1ae3423f104cc873ec22a5f05ac2e07ac2901` (`v2-development`).

The following continuation/QA notes record historical review stages; their pending
owner-review language is superseded by the owner-approved closeout above.

Latest continuation: [elbow / treated face / actual-app speaking QA](V2-026_ELBOW_FACE_SPEAKING_QA.md).
v25 adds a bounded gentle treated mouth-corner cue. A neck-only hinge alignment
repairs the elbow silhouette without changing the accepted hand target or timing.
Local HTMLAudio playback through the actual Student App proves mouth/jaw motion,
START/END, blink/anxiety/breathing coexistence and one-instance preservation.
This new speaking proof uses a labelled synthetic tone, NOT another provider call.
Accepted breathing, exam coverage, camera, room, case and STEMI assets remain unchanged.

Previous continuation: [breathing / wrist / face QA](V2-026_BREATH_WRIST_FACE_QA.md).
v24 adds bounded skin/clothing ribcage breathing, neck-only shared forearm
pronation and modest anxiety/calm refinement. Actual-app facial comparisons,
untreated/treated breath phases and contact/release motion are linked there.
Clinical content, accepted forearm schedule, camera, coverage, devices and STEMI
assets are preserved. Owner visual approval is still required; V2-026 stays OPEN.

Previous continuation: [four-item micro-polish QA](V2-026_MICRO_POLISH_QA.md).
The owner's accepted scratching, device logic, coverage/reset, response and camera
are preserved. v23 adds subtle covered chest contour, a shallow visible navel,
readable bounded breathing and a correctly fitted white bed/pillow. Actual-app
screenshots and continuous offline motion evidence are in the linked report.
No live voice repeat. Final owner visual approval is still pending.

Previous continuation: [body-complete / pruritus / shared-room QA](V2-026_BODY_COMPLETE_QA.md).
The owner explicitly authorized same-Dana body-complete modeling after the
[baseline correction](V2-026_BASELINE_CORRECTION_QA.md) confirmed absent source
torso skin. The rejected shirt-derived geometry is NOT restored: v15–v18 add a
clean fitted torso joined to a copy of the original head/arms, breast-only opaque
coverage, additive lip swelling, and the exact STEMI linen material assets.
Current independent working file: `patient_anaphylaxis_dana_v25.blend`.
v01–v24, the original FBX, and approved STEMI sources remain preserved.
The actual app was inspected: chest/abdomen access, Cover/Reset, held forearm
and lateral-neck scratching, initial no-device state, and committed treatment
response. A rejected intermediate neck reach was corrected after two-angle app
inspection; the final contact stays outside the shirt. No live provider request
was repeated. Owner visual approval is still required; this is not closure.

The following delivered-foundation notes are historical unless superseded above.

## Delivered foundation

- Independent sixteen-module Case Schema V2 package: `v2/content/cases/anaphylaxis/dana-case.ts`.
- `UNDER_REVIEW` source, immutable `REVIEW_ONLY` execution artifact. No reviews,
  approvals, official curriculum mappings or approved diagnostic images invented.
- Owner-locked food/nut exposure history, initial 126 / 82–48 / 28 / 93% / 36.7 C,
  and improved 98 / 104–66 / 20 / 98% observations.
- Existing Clinical Engine, Scheduler, Session API and six-domain Assessment;
  no new physiological engine or case-specific engine code.
- Catalogue: help, ABCDE, history/examination, oxygen, IM epinephrine 0.5 mg into
  the anterolateral thigh, IV access, crystalloid 500 mL, monitoring, a bounded
  repeat-epinephrine action, adjunct options, diagnosis, monitored observation,
  unsafe early discharge and allergy follow-up/avoidance/auto-injector education.
- Fixed-dose catalogue actions use the same executable confirmation policy as
  STEMI. The unimplemented separate two-stage administration flow is not enabled
  or bypassed. An explicit learner submission still passes Session validation.
- Improvement requires the authored epinephrine/oxygen/fluid path and delayed
  readiness flags (180 clinical seconds), not a visual toggle. Five-minute
  epinephrine delay and too-early repeat are recorded; no invented collapse.
  Repeat is bounded to one repeat in this initial Expo proposal. No home-discharge
  success is authored. Clinical timing/rubric/lab values require physician review.
- ECG, CXR, VBG, basic ED panel and tryptase use the existing pending/result/report
  system. Text-only diagnostics; no images are misrepresented as approved.
  Tryptase text states the sample was sent and the analytical result remains
  pending beyond the simulation. Investigations are not treatment prerequisites.
- Patient Conversation context exposes only patient-disclosable history. A
  clearly synthetic provider test proves the existing question API can return a
  grounded Arabic answer without changing Patient State. This is NOT live AI/TTS.

## Exact Dana asset and preservation

Source: `visual-patient-lab/assets/characters/Dana.fbx` (owner-selected Mixamo).
Import audit found six skinned meshes, a compatible Mixamo armature, packed
diffuse/normal/material textures and measurable deformation under a forearm pose.
The FBX contains **no facial shape keys**. No replacement character was sought.
Formal license/distribution evidence remains `RIGHTS_REVIEW_REQUIRED`.

The requested v01 blend already existed and contained the male environment
foundation, not an imported Dana. It was preserved. New independent work:
`visual-patient-lab/blender/patient_anaphylaxis_dana_v02.blend`.
Source v01 SHA-256 before/after:
`36b57044739942043da09eec94549febf36846ec7711f42a9c2cdd5e37188c8a`.
No approved STEMI Blender/GLB or original FBX was saved over.

The new scene reuses room/bed/lighting/camera reference geometry, excludes male
patient objects, imports Dana in everyday clothing and adds an always-covering
exam top. Export is `v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb`.
`v2/content/media/dana/manifest.json` pins its hash and review provenance.
The export explicitly includes one base-pose clip: exporting rest pose without
that clip produced a bad browser pose and was corrected, not accepted as proof.

## Visual completion pass — owner review candidate

The existing VisualPatient component/renderer/loader/speaking lifecycle is reused.
An asset-specific `DanaRig` adapter supplies the different skeleton behavior.
The server maps only the exact Dana review artifact to that asset; it does not
infer diagnosis or treatment from vitals. STEMI mapping remains unchanged.

New independent facial working file:
`visual-patient-lab/blender/patient_anaphylaxis_dana_v03.blend`.
v01, v02, the original FBX and approved STEMI assets remain preserved. v02 hash:
`0f572adc00352f107a0bda818bac16e9042c241db30395d1e58efe6741a28e5e`.

- Five purpose-built shapes: Blink_Left, Blink_Right, Mouth_Open,
  Anxious_Foundation_v01 and Improved_Calm_v01. Eyelashes follow eyelids.
  Connectivity-based masks exclude both eye globes from all deformation.
  Finite, bounded vertex displacements are checked during authoring/export.
- Unequal blink pauses, playback-only mouth articulation, smooth anxious/calm
  blending, subtle RR28/RR20 breathing and living head motion compose on one
  loaded patient. No phoneme-perfect lip sync is claimed.
- Bounded two-bone forearm rub/scratch overlay, variable resting intervals,
  no scratching during focused examination, and no scratching after the
  Case-owned improvement projection disables that layer.
- Irregular localized erythematous patches on arm/neck/upper-torso skin, with
  reduced intensity after improvement. This is presentation, not diagnosis.
- Supine arm transport and region-camera tracking corrected after screenshot
  inspection. Face/neck/arm/chest views, opaque exam top and Cover/Reset are
  captured. No unnecessary exposure or new clinical examination finding.
- Mild lip swelling remains visually DEFERRED; its authored finding is unchanged.
- Static Dana reference still rendered from v03, locally packaged and hashed.
  It is explicitly labeled as the INITIAL presentation, not a live examination
  or a substitute for current monitor values. The shared V2-022 failure-only
  resolver uses it only after Dana 3D fails, including an improved Session.

All visual artifacts are **READY_FOR_OWNER_VISUAL_REVIEW**, not OWNER_APPROVED.
Human acceptance of expression, contact and rash appearance remains required.

The clinical case file is unchanged in this completion pass (SHA-256
`82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`).
Review execution hash remains
`caab9211b2277341226e652e69b78a2fe2b6f7d11e8237ed5645f5e34ba90b8c`.

## Review host and evidence

`npm run dev:v2-026` → `http://127.0.0.1:4194/` uses the actual Student App, existing
API/coordinator, local faculty review fixture and server memory. It is not a
production authentication/persistence service. Offline by default, with no
external network dependency.
Its development advancement endpoint calls the existing coordinator; it does not
write arbitrary Patient State. Stale-version rejection is surfaced as STALE by
the shared local review transport so the existing UI can refresh truthfully.

Focused commands: `npm run test:v2-026`, `npm run test:v2-026:playwright`,
`npm run typecheck`, `npm run build`, `git diff --check`.
Disposable renders/screenshots/audits are under `v2/test-results/v2-026*`.

The previous clinical foundation verification is retained below. Updated focused
completion-pass results and artifact links are in `V2-026_VISUAL_REVIEW.md`.

Previous verified foundation checkpoint:

- 10 Dana Browser tests plus 12 directly affected STEMI/visual/conversation
  regression tests: **22/22 PASS**.
- Existing investigation renderer/media regressions: **9/9 PASS**.
- Actual-App Dana scenario: **1/1 PASS** (loading, breathing, cover/top/reset,
  same-instance preservation, catalogue treatment, typed stale refresh, improved
  body state and scheduled ECG text). This is deliberately not facial/live-voice
  acceptance. Shader compilation errors are checked, not silently accepted.
- Typecheck, build, pinned-asset check: **PASS**, exit 0.
- Build retains the existing large-chunk warning. Windows Playwright teardown
  required stopping only the inspected test-owned host PID after completion.
- Failed-test PNGs were moved into ignored `test-results`; no review recordings
  or screenshots are staged. No full unrelated test campaign was run.
- V1 SHA-256 matches the established baseline; frozen Architecture, ADRs, STEMI
  Case sources and approved STEMI public assets have zero Git diff.

Clinical reference cross-check (not ingested into RAG, not source approval):
[Resuscitation Council UK — emergency anaphylaxis treatment](https://www.resus.org.uk/library/additional-guidance/guidance-anaphylaxis/emergency-treatment-anaphylactic-reactions).
All Case source references remain unresolved owner-scenario proposals. Synthetic
laboratory values and response timing are not falsely attributed to that guideline.

No commit, push, deployment, new provider/model, new patient generation, new
clinical engine, physician approval or changes to prior milestone status.

## Bounded real-provider proof — completed before this repair

The owner confirmed that the authorized real Dana Conversation/ElevenLabs proof
passed. The following describes the existing trusted composition, not a request
to run it again. No provider call was made during the chest/contact repair.

`runtime/v2-026-live-proof.mjs` composes existing Terra Responses and ElevenLabs
TTD providers; it does not implement another provider. The host's default mode
does not consult credentials. In a trusted owner-configured terminal, live mode
requires `V2_ALLOW_LIVE_V2_026_VOICE_PROOF=1` and
`V2_DANA_REVIEW_VOICE_APPROVED=1`. The second flag is explicit owner attestation
that the one existing `ELEVENLABS_SMOKE_VOICE_IDS` entry is an authorized female
REVIEW voice; it does not finalize Dana's voice selection. Never reuse the
STEMI profile by assumption or send credentials/voice IDs in chat.

Existing server-only provider configuration is reused; no Vite secret or env-file
loading is added. Start `npm run dev:v2-026` in that trusted terminal. Each host
boot has a fresh Session/request namespace. Only the approved question
`شو صار معك قبل ما تبلش الأعراض؟` in ar-JO is admitted. One provider HTTP request
and one TTD token mint are permitted. Duplicate question identities still pass
through existing replay protection; another identity receives the safe consumed
code. Live mode rejects clinical command writes and the development time jump.

The browser uses the existing Patient Conversation and exact-approved-answer TTD
path. Model remains gpt-5.6-terra; TTD remains eleven_v3_conversational with
ttd_websocket. No real credentials were inspected and no live request was sent
in the visual completion pass. A local WAV playback regression is explicitly
synthetic and is NOT claimed as the required live Terra/ElevenLabs proof.
