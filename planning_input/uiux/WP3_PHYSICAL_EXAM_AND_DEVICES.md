# WP3 — Physical examination and bedside devices

Status: **BALSIM_WP3 — CLOSED** (2026-09-25).
Baseline: `d157f99e3b79a15cfb5af36f84d26ce369e62d21`.
Owner-authorized scoped closeout commit; no push, WP4 or final UI design.
Verification is recorded below.

## Authority and version boundary

The existing Session Coordinator, command validation, due-work draining, atomic
event commit, replay protection and Clinical Time advancement execute exams.
There is no parallel examination engine or mutable findings store. The new typed
`PinnedExam` / `ExamOption` / `ExamReceipt` delivery contract is version 1.0.0.

`case-schema/src/examination-runtime.ts` derives a closed runtime delivery binding
only for the exact approved Khalid 2.4.0 and Dana 1.5.0 execution hashes. It reads
their approved `after_exam` facts and localization; it does not rewrite Case bytes
or replace their approval hashes. Historical REVIEW_ONLY and production packages
do not acquire these Expo bindings. Already-created Sessions remain pinned; restart
the trusted review host to create a Session with the new runtime binding.

Shared catalogue `catalogue.balsim.expo-clinical@1.1.0` remains 33 concepts. The
separate **examination delivery options** are the same nine identities, labels,
tools and durations for both patients. They become pinned generic EXAMINATION
actions; existing clinical actions, medications, rubrics and effects are not
normalized, replaced or duplicated. New exam IDs record evidence but do not
automatically satisfy composite legacy scored actions or introduce score weights.

Every request uses the existing `/actions/propose` path. Only the action identity
and ordinary request/idempotency envelope are accepted. Region, tool, finding,
duration, Case binding and clinical effects cannot be supplied by the learner.
The server resolves the exact option, applies 30 seconds through the existing
central Session time path, then commits an `EXAM_PERFORMED` receipt containing
region/tool, duration and the selected findings. **30 seconds is an Expo compressed
simulation fixture, not a universal real-world examination duration.**
Timing classification: `SIMULATION_TIMING_FIXTURE`.

All exams are explicitly repeatable; a new command creates a new timed sample,
while the same idempotency key replays the original result without re-examination.
Receipts bind Session, CaseVersion, action, region/tool, Event ID, sequence and
Clinical Time. They survive browser reload through the existing Session store.
ActionLog/timeline gets the exam label/time; future assessment policy can consume
the recorded evidence. No correctness feedback is introduced.

## Shared examination set — 9 actions

| Action suffix (`examination.expo.*`) | Region/tool | Khalid approved source | Dana approved source |
| --- | --- | --- | --- |
| general | General / inspection | general-appearance | author.exam.general |
| airway | Airway / inspection | speaking-in-short-sentences excerpt only | author.exam.airway |
| respiratory | Chest / inspection | increased-work-of-breathing excerpt only | increased-work-of-breathing excerpt only |
| auscultation | Chest / stethoscope | clear lungs / no crackles or wheeze excerpt | bilateral wheeze excerpt |
| cardiovascular | Chest / clinical examination | regular tachycardia excerpt | author.exam.cardiovascular |
| abdomen | Abdomen / clinical examination | abdominal clause of other-exam | author.exam.abdomen |
| skin | Skin / inspection | pale/clammy excerpt | author.exam.skin-mucosa |
| perfusion | Extremities / clinical examination | perfusion-exam | author.exam.extremities-perfusion |
| neurological | Neurological / clinical examination | no focal deficit clause | author.exam.neurological |

Source prefixes are `fact.stemi.*` and `fact.dana.*`. Each English/Arabic excerpt
must exist in the approved source text, or binding fails closed. Khalid's
neurological extraction retains the explicit negation while removing the unrelated
chest-wall clause; it does not reveal the abdomen or chest-wall finding. Respiratory
inspection does not reveal wheeze/clear lungs; auscultation is separately acquired.
No normal pupil response, new heart sounds, diagnosis or examination result is
inferred. Dana has no authored heart-sound auscultation finding; no such extra
option was added. General naturally visible appearance does not unlock other
structured domains.

### Temporal scope — important

These approved texts describe the baseline presentation, not a complete dynamic
post-treatment examination model. The binding captures baseline clinical phase,
consciousness, respiratory/hemodynamic/pain states and complications. At exam
completion, a mismatch returns `CURRENT_STATE_NOT_AUTHORED` with **zero findings**,
while preserving the performed-exam/time evidence. It never repeats baseline wheeze,
rash or hypotension as if newly confirmed after improvement. Previously acquired
receipts remain timestamped historical samples. Adding state-specific follow-up
findings requires explicit clinical authoring/review, not UI or shader inference.

`FOLLOW_UP_EXAM_FINDING_EXPANSION = FINAL_UX_OR_POST_EXPO_SCOPE`.
The later encounter/UI package must translate `CURRENT_STATE_NOT_AUTHORED` into
appropriate human-facing behavior; the raw code must not be shown to normal
learners in final UI. This must never invent a medical finding. No new follow-up
findings are authored by this closeout.

## Learner/API boundaries

Fresh projection: options only, no facts/values/hidden mapping. Finding receipts
appear only after verified committed learner exams in that Session/CaseVersion,
at or before current Clinical Time. Foreign, future, incorrect-region/tool or
altered-finding receipts are excluded. Existing ownership, institution, role,
state-version, replay and approval-integrity checks remain in force. Student
payloads cannot select another Case's binding or supply a finding. Findings never
enter Patient Conversation merely because the examination UI exists.

No AI, Voice, RAG or Tutor dependency. Deterministic exam results continue with
the existing static patient fallback when WebGL/GLB fails. Ended/offline/stale
Sessions retain the existing mutation guards. AI-generated findings are forbidden.

## Tools, camera and accepted patient assets

- Inspection: supported, region selection plus explicit clinical execution.
- Stethoscope: supported at deterministic text level. The shared local chestpiece
  follows the selected live skin triangle (barycentric skinned-vertex attachment),
  not a fixed floating world coordinate. It is a site visualization, not an audio
  or physiological simulator; no clinician-hand or full stethoscope-tubing system.
- `AUSCULTATION_AUDIO = NOT_AVAILABLE`: no packaged reviewed/project-controlled
  heart/lung recording found in the V2 content/public inventory; none synthesized.
- `PENLIGHT_EXPO_SUPPORTED = NO`: hidden in the approved Expo examination controls;
  no authored useful pupil finding exists in either current case.
- Existing examination entry/exit uses accepted Semi-Fowler/Supine transitions.
  Selecting an exam focuses its region once; manual camera control and reset stay
  available. No clinical position/effect is inferred from a visual pose change.
- Dana abdomen gets a covered regional focus only; no new mesh or exposure.
  Her accepted modest chest skin/opaque underlayer, Cover/Reset and original
  garments remain unchanged. Khalid reveal logic and all patient asset bytes are
  unchanged. Visual Patient Lab is untouched.

## Devices and monitoring

- Fresh Session: no cuff, IV access, tubing or pulse-ox clip attached.
- BP: committed acquisition attaches one shared cuff; repeat acquisition produces
  another point sample, not another mesh and not continuous BP.
- Pulse ox: committed SpO2 acquisition also samples HR. A small project-created
  clip (two shells and hinge, no fabricated display/waveform) follows the distal
  index-finger skeleton in both approved Expo patients. Missing anchor hides it.
  Legacy WP1 review versions retain their prior pending-visual contract.
- IV cannula: existing bone-following shared access/tape/hub layer preserved.
- IV fluids/medications: prerequisites are still server-authoritative. Tubing
  activates only after access and a subsequent supported infusion/IV-medication
  receipt. Dana's existing cross-case IV UFH order now also drives the same tubing
  layer; this is visualization, not a new medication benefit/effect.
- `OXYGEN_VISUAL = FUNCTIONAL_ONLY`: oxygen action/effect remains authoritative;
  no reliable accepted mask/cannula was added or falsely claimed.
- Monitoring: only authored HR/SpO2/rhythm channels continuously refresh. BP stays
  a point sample. An environment monitor is furniture, not proof of patient
  connection. Acquired monitor-channel status remains the operational authority.
- No new ECG waveform, infusion pump or removal/clinical-detachment semantics.
  Presentation Cover/Reset does not erase committed equipment or observations.

## Verification / actual-app evidence

Implementation readiness was **BALSIM_WP3_READY_TO_CLOSE — YES**. Owner-authorized
closeout records WP3 as CLOSED. WP4 has not begun.

Verification completed on 2026-09-25:

- Browser regression run: **205/205**, 17 files (WP3, WP1, WP2 and visual/device
  regressions).
- Additional affected Browser run: **147/147**, 19 files (WP3, Dana, Session
  engine and API projections). These runs overlap; counts are not additive.
- Final chestpiece/device tests: **4/4** after skin-occlusion correction.
- Deno: **6/6** across WP3, WP1, WP2 and medical-approval boundaries.
- Node security/preflight: **12/12**.
- Final actual-app Playwright: **2/2**, exit 0, after the last relevant-tool
  visibility change. Khalid and Dana each exercised fresh-device absence,
  authored examination acquisition, chest auscultation/contact, abdomen,
  skin/perfusion, BP/pulse-ox/IV, manual camera, Cover/Reset, single patient
  instance, and new examination acquisition with forced GLB/static fallback.
- Typecheck, build, portability, secret scan and `git diff --check`: PASS.
  Existing large-bundle warning remains non-blocking.
- Both approved execution hashes recomputed and approval verification passed:
  Khalid `e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7`;
  Dana `0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65`.
  Case content, medical review records and public patient assets have no diff.

Local app proofs use the existing `dev:wp2` hosts on 4216 (Khalid) / 4217
(Dana), with external traffic blocked. Only the test-owned lingering Vite
processes were stopped after both assertions completed to finish runner teardown.
No live provider calls were made.

Screenshots are ignored review artifacts, never source assets:

- Khalid: `v2/test-results/wp3-app/exam-khalid-actual-app-exa-c1f92-devices-and-static-fallback/`
- Dana: `v2/test-results/wp3-app/exam-dana-actual-app-exami-d5036-devices-and-static-fallback/`

Each folder contains patient-prefixed `chest-exam.png`, `finding.png`,
`devices.png`, `manual-camera.png` and `fallback-exam.png`. Final chest/device
captures were visually inspected, including Dana's opaque modest coverage and
chestpiece on exposed skin, and each patient's finger-mounted pulse-ox clip.

Scoped delta: 12 modified tracked files and 11 new implementation/test/handoff
files. Pre-existing untracked `visual-patient-lab/` is excluded and untouched.
Closeout stages only these 23 scoped files for one WP3 commit. No push,
clinical-content authoring or patient-asset changes. Existing passing suites are
reused; closeout repeats only secret/staging sanity and diff checks.

## Post-Expo / explicit limitations

State-specific post-treatment examination findings require authored review.
Pupil testing, auscultation audio, full instrument/clinician-hand animation,
oxygen hardware and validated ECG waveforms are not claimed. Medical source,
media-rights and publication gates retain WP2 status. WP3 does not close those
independent gates or change scoring/disclosure mode policy.
