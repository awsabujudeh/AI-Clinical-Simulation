# V2-021 — STEMI Visual Patient integration

Status: **CLOSED for Expo scope**. See [final closeout](V2-021_CLOSEOUT.md).

## Ownership and integration

The actual `/sessions/:sessionId` Student Simulation workspace uses a native
`VisualPatient` component, not an iframe or the laboratory sidebar. The component
consumes the bounded `SafeSessionProjection.visual_patient` projection. Clinical
Engine, Session Engine, scoring, Patient/Interpreter models, provider policy,
medical case content, authentication and institution rules are unchanged. The
explicit conversation-enabled 2.0.1 review successor described below changes
Case identity/capability metadata, not medical content.

The API presentation adapter binds the approved asset to the exact STEMI review
execution hash, Case Package ID, Case Version ID and semantic version. It maps
the existing alert/persistent-pain baseline and modest-support states to the
approved active-pain display. It does not infer a diagnosis or appearance from
HR/BP thresholds. Unsupported states use a neutral unavailable-view panel;
the clinical monitor and actions remain accessible. This mapping is display
configuration, not a clinical rule or replacement observation policy.

The runtime has typed presentation, playback, position, examination, reveal and
camera controls. Animation time is local presentation time only. One scene is
retained per mounted Session, including across presentation/playback updates.
React StrictMode's discarded effect does not allocate another GLB. Both assets
are SHA-256 checked before parsing. Failure/context loss hides the 3D view.
Unmount aborts loading, removes handlers, disconnects observation, cancels the
frame loop and disposes scene resources, controls and WebGL resources.

## Approved source provenance

Read-only source: `visual-patient-lab/APPROVED_VISUAL_FOUNDATION.md` and
`viewer/stemi-physical-exam-v02/`. V02 explicitly reuses the V01 physical-exam
export (which includes the approved V04 identity/animation/gaze foundation).
There is no separate V02 GLB. Asset copies live under
`v2/apps/web/public/visual-patient/stemi/physical-exam-v02/`.

| Exact file | SHA-256 |
|---|---|
| visual_patient_stemi_physical_exam_runtime_v01.glb | 00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1 |
| visual_patient_stemi_physical_exam_runtime_v01.json | 5eab5851925ed57367d274e79ee818ce393460a5604671255fc751ca1cbb366c |

The approved shader, clip composition/masks, binocular gaze, living behavior,
position-aware chest contact, garment/linen reveal and camera bounds are ported
from the V02 viewer. Three.js is pinned to the same 0.180.0 version. The source
lab, Blender files, exported geometry, patient age and identity are not edited.
Only the DOM-bound review controls/global debug interface were replaced. Assets
are not precached as part of the service-worker application shell.

## Voice and examination boundaries

The existing ElevenLabs adapter now exposes a typed media-event subscription.
Actual HTML audio `playing` starts speaking; `ended`, `pause`, `error`, mute,
cancellation and unmount stop it. Text availability or provider buffering never
starts the visual layer. The independent layer retains the current clinical
face, scene identity, breathing time and chest-entry count. Provider protocol,
models, tokens, STT, request text and synthesis behavior are unchanged.

Exam entry moves the same patient to Supine. Chest, abdomen, left arm, right arm,
lower legs and cover/reset use the approved reveal data and camera controller.
Pointer requests carry method, region, anchor and position; the workspace binds
Session ID, pinned Case identity and current state version. A current request
opens the existing Examination catalogue. The learner must still select and
confirm the actual Case-owned action. A single anchor does not automatically
grant a broad composite examination. No visual code returns a finding or calls
the action API. Stale/cross-Session presentation selections are rejected.

## Explicit limits — no invented medical truth

- Original STEMI 2.0.0 retains `instructor_notes.patient_ai_access = FORBIDDEN`.
  Its actual question path still fails closed with `PATIENT_AI_FORBIDDEN` (API
  422). The explicitly requested 2.0.1 successor enables the existing V2-019
  capability through versioned, hash-bound Case content. No global guard is
  bypassed. Instructor notes themselves remain excluded from Patient context.
- Actual Patient/TTS proof requires trusted local provider configuration. Mock
  provider and media-event tests are not live TTS evidence. See the separate
  Patient Conversation verification report for current execution status.
- Modest fluid support retains persistent pain (7/10); no reachable full relief
  state exists. Relieved, Neutral and Anxious remain available typed visual
  layers and are tested in an isolated presentation-contract fixture, never
  injected as real clinical transitions in the STEMI recording.
- No anchor-specific auscultation audio or pupil-result contract exists. The
  existing composite cardiac/neurologic and lungs/JVP actions remain the only
  corresponding clinical pathway. Penlight/anchor interaction is intent only;
  no heart sound, lung sound, pupil result or text finding is fabricated.
- Unsupported deteriorated presentations use fallback, rather than depicting
  the approved alert patient as if it represented every possible state.

## Local proof and tests

`npm run dev:v2-021` starts the existing actual React App with a loopback-only
review API composition at `http://127.0.0.1:4186/`. It uses real API, Case, Session,
Clinical and Assessment code with the existing in-memory/test-principal adapter.
It is not production authentication, persistence or deployment. Default offline
mode uses the original 2.0.0 review artifact, no credentials and no provider
requests. The authoritative Clinical Clock is deterministic
in this review fixture; no medical time is inferred from rendering frames.

`npm run test:v2-021` covers shared contracts, pinning/fallback, playback events,
exam-context safety, asset hashes, actual-application WebGL/exam behavior and an
isolated Pain → Speaking → Relieved presentation-contract test. The latter is
not a clinical case trace. The local WebGL suite uses installed Edge/Chromium:
the full downloaded Chromium binary cannot start on this host and software
headless-shell rendering was too slow for reliable frame observations.

The existing UI guard now permits only the exact Three.js version and the
isolated visual-patient source tree; clinical authority, provider, randomness,
and media-generation restrictions elsewhere remain enforced.

## Explicit conversation-enabled STEMI review successor

`content/cases/stemi/v2-conversation/stemi-conversation-case.ts` derives a strict
2.0.1 successor using the existing Case Schema / Review Execution Artifact
mechanism. It does not edit the original `v2-draft` source. Changes are limited
to Case/package/version IDs, the initial state's semantic version,
`patient_ai_access = ALLOWED`, and regenerated exact-version reachability
evidence. Clinical facts, observation policy, dialogue policy, rules, action
catalogue, timelines and assessment rubric are unchanged. Both versions remain
UNDER_REVIEW / REVIEW_ONLY, without Clinical Approval or publication.

The old 422 is enforced by the current V2-019 context guard, not by V1 code.
The flag's location in `instructor_notes` is awkward; this task does not
reinterpret the approved guard or expose the notes. The context projector still
selects only allowlisted dialogue facts, bounded prior conversation and explicit
patient manifestations. Full Patient State, hidden diagnosis/results, rubric,
rules and governance are not passed to the provider.

New review subject hash:
`6a707cdb7e19b01084c68a40ab86b5e48ef6140959b5ba96aa1db96c1137f18e`

New review execution hash:
`90b8bfa625ff217edaefd2f235deacf396f9a9d8af86268c0acf411f939046f1`

The asset adapter accepts complete exact identity/hash tuples for both versions;
cross-version tuple mixing fails closed. The original hashes and golden trace
are not replaced. This is not a mutable runtime capability sidecar.

## Opt-in one-question live proof

The same loopback review host optionally composes the existing Secure AI Gateway
and ElevenLabs token broker. It reuses the approved Terra Patient model policy
and `eleven_v3_conversational` TTS model. No new question endpoint, provider
protocol, STT policy or credential mechanism is introduced.

Trusted launch-process variables (never Vite/browser variables):

- `V2_ALLOW_LIVE_V2_021_VOICE_PROOF=1`
- `OPENAI_API_KEY=<configured through existing trusted local procedure>`
- `ELEVENLABS_API_KEY=<configured through existing hidden-key prompt procedure>`
- `ELEVENLABS_SMOKE_VOICE_IDS=<one approved non-secret voice ID>`

No dotenv/secret file is read or written. Do not put real keys in command-line
arguments, chat, repository files or logs. Start the host from the already
configured trusted process with `npm run dev:v2-021`. Restart is required to
change its inherited configuration. Missing credentials or an ambiguous voice
profile fail before provider I/O.

Live mode loads only the new 2.0.1 artifact. It accepts one fixed history question,
with explicit ar-JO bootstrap/request language independent of shell localization:
`متى بلش وجع صدرك؟`, in ar-JO, backed by existing
`fact.stemi.symptom-onset` (55 minutes before arrival). Only that first question's
idempotency key can be replayed. It permits one Patient invocation with the
existing policy's at-most-two transport attempts, and one TTD token mint attempt.
Other mutations/actions and STT issuance are unavailable in this local proof.
Patient context selection, local answer validation and exact committed answer
text → TTS remain the existing application path. `store:false` and no tools are
preserved. Browser receives only the existing single-use TTD token, never a key.

`test:v2-021:live-config` uses synthetic credentials and injected transport only;
it proves preparation has no I/O and limits/failures fail closed. It does not
contact either provider. Live results must be documented separately.
