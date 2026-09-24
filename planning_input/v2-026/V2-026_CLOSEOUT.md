# V2-026 — CLOSED

Owner visual approval was explicitly granted on 2026-09-24 for the current Dana
v25 Expo implementation and its accepted limitations. This closes the second-case
technical/visual milestone, not medical review or publication.

- SECOND_CASE_TECHNICAL_VISUAL_IMPLEMENTATION = COMPLETE
- OWNER_VISUAL_APPROVAL = GRANTED
- ANAPHYLAXIS_CASE_MEDICAL_REVIEW = PENDING_PHYSICIAN_REVIEW
- STEMI_MEDICAL_REVIEW = PENDING_PHYSICIAN_REVIEW
- EXECUTION_AUTHORITY = REVIEW_ONLY; source cases remain UNDER_REVIEW
- RIGHTS_REVIEW = REQUIRED; no distribution permission or curriculum approval invented
- STEMI_KHALID_PRESERVED = YES
- DANA_SECOND_PATIENT_ADDED = YES

## Accepted capabilities

Dana is the independent second patient, with a deterministic food-triggered
Anaphylaxis case on the existing Case/Clinical/Session/Assessment architecture.
The approved baseline includes everyday clothing, same-Dana body-complete exam
surface, opaque modest chest coverage, chest/abdomen access, contour/navel,
forearm and neck pruritus with variable pauses, repaired elbow, anxious and
improved faces, mouth/jaw articulation, blink, tachypneic and improved breathing,
rash/swelling changes, static fallback, manual camera and Cover/Reset.

Investigation scheduling/text results, management, diagnosis, observation,
education and unsafe-disposition handling reuse existing contracts. Diagnostic
images remain MEDIA_ASSET_PENDING; authored text is not physician approval.
Grounded Dana Conversation and real ElevenLabs playback were previously proven.
Closeout reuses that evidence and sends no provider requests. Live voice IDs and
credentials remain local, not source/configuration committed to Git.

Shared ED room, bedding, equipment, renderer lifecycle, camera/exam framework and
speaking integration are reused. Case facts, patient assets, rig behavior and
conversation context remain separate. The STEMI GLB and clinical package were
not replaced. The shared equipment layer is the intentional V2-026 addition:
attached cuff/IV/tubing start absent and reflect committed verified executions;
tubing requires earlier established access. This does not change STEMI medical
truth or its patient-specific motion/face behavior.

## Authoritative treatment-response boundary

Valid learner action -> Session/Clinical Engine execution -> authoritative
PatientState -> server VisualPatient projection -> presentation-only Dana rig.

The exact pinned Dana review hash is checked by `projectVisualPatient`. It uses
the Clinical Engine's `outcome.dana.improved` flag, not numeric-vital inference,
AI text, wall time, elapsed renderer time or a button's uncommitted intent.
The Case-owned response rule requires epinephrine readiness, oxygen and fluid
readiness; both authored delayed responses take 180 Clinical seconds. No
clinical rule/effect or medical timing was changed during closeout.

| Authoritative state | Observations | Downstream visuals |
| --- | --- | --- |
| Initial/untreated | HR126; BP82/48; RR28; SpO2 93%; T36.7 | Anxious, itchy, rash/swelling visible, faster breathing |
| Improved after valid treatment and due settlement | HR98; BP104/66; RR20; SpO2 98% with support | Calm, scratching off, rash 6%/swelling 5% presentation weight, slower/shallower breathing |

Renderer time animates approved cycles only. It cannot change the improvement
flag, vitals, investigation truth or scoring. AI/Voice have no direct clinical
mutation authority; the existing action confirmation/Session boundary remains.
Exam mode may pause scratching for access; that is not clinical improvement.

## Final focused verification

- V2-026 Browser: **42/42 PASS**, five files, exit 0. Added a direct regression
  across Clinical Engine -> projection -> motion: renderer time, rejected fluid
  intent without IV, and untreated Clinical-Time passage do not improve Dana;
  valid treatment plus due settlement does. Exact initial/improved observations,
  rash, scratching, swelling, calm face, RR28/RR20 and immutable state checked.
- Asset/export audit: **PASS**, GLB hash, morphs, weights, one Dana skeleton,
  original-male exclusion, modest opaque exam layer, shared linen and fallback.
- Injected-I/O provider-composition tests: **6/6 PASS**, exit 0. All synthetic;
  no real OpenAI/ElevenLabs calls or credential reads.
- Affected Visual Patient/STEMI Browser regressions: **26/26 PASS**, seven files,
  exit 0; pinning, conversation/bootstrap, media, investigations and speech bridge.
- Final focused actual-app/runtime checks: **5/5 PASS**, exit 0: Khaled/STEMI
  continuous runtime, actual Dana app/exam/treatment/device/ECG flow, forced
  Dana fallback, local audio lifecycle, and actual-App speaking preservation.
  One test-only closeout correction was required: the speaking scenario assumed
  untreated anxiety even when the prior scenario had improved the shared Session.
  It now checks the authoritative server-projected face/body before and after
  playback, supporting both valid states without weakening any runtime guard.
  The complete five-scenario focused group then passed. No accepted visual,
  clinical or provider implementation changed. Only exact test-owned Node hosts
  were stopped after results for Windows teardown; owner hosts were untouched.
- `npm run typecheck`: **PASS**, exit 0.
- `npm run build`: **PASS**, exit 0. Existing >500 kB chunk warning only.
- `git diff --check` and staged whitespace/scope/secret-pattern checks: **PASS**.
  81 intended files; no laboratory sources, local recordings, credentials,
  actual local voice IDs, V1, frozen Architecture or ADR files staged.
- Previous v24/v25 Blender integrity and owner-approved actual-app imagery reused;
  no visual asset rebuilt, no new visual R&D and no broad historical suite.

## Accepted Expo limitations and independent review gates

Linear skinning has simplified deep-flex elbow/hand deformation, not a high-end
collision/muscle rig. Speaking is visible bounded articulation, not phoneme-perfect
lip sync. Anatomy is Expo-grade educational presentation, not precision anatomy.
These limitations were accepted by the owner and are not technical blockers.
The static still is labelled an initial-state reference, not a live examination.
Physician review, diagnostic-media/source/rights review and formal curriculum
approval remain external, truthful gates before any applicable Expo release.

## Repository boundary / preservation

Only intended V2 runtime copies, source, focused tests, reusable authoring/audit
scripts and planning documentation belong in this commit. The independent local
Visual Patient Lab (including all Blender/FBX sources, exports and vendor code)
is left untouched and untracked, following the V2-021 isolation convention.
Ignored `test-results` captures, recordings, local host logs and live-provider
artifacts are excluded. No keys, actual local voice IDs or tokens are included.

Closeout preserved hashes:

- Dana v25 GLB: `17f578e1813b4d96a365c50c498ad8251fcb39b805119ce7c030611c96e7bc65`
- Dana source: `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`
- Dana FBX: `3e337766adc1f5067e6a6f522a22d0a05fa74ec016f360b61734221c9c8752c1`
- Local v25 blend: `ebb8ea3f831d52bcf1a4cf6bde0047b30084e4f6ec897866f722a1be2d0b8062`
- STEMI GLB: `00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1`
- STEMI blend: `93934bbae40e4657d9fac15568d5e7b5a6dfb307fba2a74ea2a189af75ec37d6`
- V1 README: `e1f5884a448e1cbd9125d1780a1236105d7e74db2e3dd304f9a51f54857fcee8`
- V1 HTML: `2fe2732792eb1642909e53f42db1a6455f9c72ef8088a0303f1e8857eca2d512`

V1, frozen Logical/Physical Architecture, accepted ADRs, STEMI content/public
assets and approved laboratory sources have no closeout changes. Approval-only
media-manifest metadata changed; the accepted GLB/fallback bytes did not.

Next authorized milestone, **not started here**: V2-027 security/privacy/budget
hardening. Start with the two-case review/API/AI/Faculty boundary inventory,
secret-in-bundle checks, role-abuse, budget-kill, CORS/CSP and log-redaction gates.
No push, merge, deployment or V2-027 implementation is part of this closeout.
