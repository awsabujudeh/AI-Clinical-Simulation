# Dana breathing / wrist / face — v24 owner-review candidate

**V2_026_READY_FOR_OWNER_VISUAL_REVIEW — YES**. V2-026 remains OPEN.
No owner visual approval, medical approval, publication or rights approval is implied.

## Scoped repairs

- **Breathing:** added `Thoracic_Breath` to the existing exam body, everyday shirt
  and opaque bra. The same smooth field gives up to 9 mm anterior / 2 mm lateral
  ribcage excursion, excluding neck, face, shoulder joins and lower abdomen/navel.
  Existing bounded Spine2 motion remains. Both use the same RR28 phase; improved
  RR20 uses 38% chest excursion (62% reduction), not head rocking alone. Disabled
  breathing has zero excursion; speech does not alter it. No physiology changes.
- **Neck wrist:** neck-only axial forearm pronation now shares the palm turn,
  rather than putting all the rotation at the wrist. Contact targets, finger
  strokes, accepted forearm rub, 40.9-second schedule, unequal pauses and return
  to rest are unchanged. Actual-app contact/release frames show the hand outside
  the shirt/neck, with a straighter wrist. No new full-body animation system.
- **Face evidence:** original anxiety and calm deformation deltas modestly scaled
  by 1.30 and 1.60 respectively, remaining below 6 mm. Untreated inner-brow tension
  and concerned mouth contrast with the treated relaxed expression. Lip swelling
  geometry is unchanged; existing authoritative improvement reduces its weight
  from 1 to .05. Original blink and speaking shapes are exact. No euphoric smile.

Independent new file: `visual-patient-lab/blender/patient_anaphylaxis_dana_v24.blend`.
v23 and all earlier candidates/source assets are preserved, not overwritten.
No changes to accepted coverage, camera, device logic, case/treatment logic or ED layout.

## Actual V2 app evidence

Gallery: `v2/test-results/v2-026-breath-wrist-face-review.html`.
Directory: `v2/test-results/v2-026-breath-wrist-face-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/`.
All are ignored local review artifacts, not repository source to stage.

| Evidence | Original app capture |
| --- | --- |
| Untreated anxious face / lips | `23-untreated-face-lips.png` |
| Treated calm face / reduced swelling | `24-treated-face-lips.png` |
| Neck contact / release / rest | `20-neck-wrist-contact-a.png`, `21-neck-wrist-contact-b.png`, `22-neck-wrist-contact-c.png` |
| Forearm scratch retained | `04-forearm-contact-stroke.png` |
| Untreated RR28 chest phases | `18-untreated-breathing-inhale.png`, `18-untreated-breathing-exhale.png` |
| Treated RR20 chest phases | `19-treated-breathing-inhale.png`, `19-treated-breathing-exhale.png` |
| Normal / reset / shared ED | `01-normal-untreated-no-devices.png`, `14-cover-reset.png`, `15-shared-ed-room.png` |
| Continuous motion / real local treatment | `video.webm` (silent, no provider audio/request) |

The app scenario observes real renderer time, never a hidden animation-state
override. It executes the existing epinephrine/oxygen/IV/fluid actions, trusted
offline clinical advancement and version-conflict refresh. Improvement comes from
the authored Clinical Engine path. One model UUID and one model load persist.
Initial no-device state and action-driven IV/tubing/cuff remain intact. Original
shirt returns on Cover/Reset. Manual camera input remains available after focus.
The separate 4195 actual app was also inspected interactively.

Review-player limitation: Codex's embedded browser crashed when playing the
saved WebM (the Dana app tab remained available). Untreated and treated video
frames decoded successfully with the installed Playwright FFmpeg, exit 0. Use an
external/local WebM player; the gallery keeps original screenshot sequences
available independently. The raw test recording includes temporary viewport
resizing during screenshot capture; it is not a polished demo film.

## Verification

- Focused Browser tests: **24/24 PASS** (motion 10, contact 9, repair/camera 5).
- Actual Student App Dana scenario: **1/1 PASS**, exit **0**. Includes untreated /
  treated phases and facial states, scratch/contact/release, exam/reset, authored
  response, devices and single-instance preservation. External network blocked.
- Read-only Blender v23/v24 integrity: **PASS**. Base coordinates exact for body,
  exam, clothes, hair, lashes, mattress, pillow and blanket. Original blink,
  mouth and lip shapes exact. Thoracic displacement <9.22 mm total, one armature.
- Asset/hash/export check: **PASS**. Hash pin, morphs, opaque coverage, normalized
  weights, male exclusion, exact shared linen materials/textures and fallback.
- `npm run typecheck`: **PASS, exit 0**.
- `npm run build`: **PASS, exit 0**; existing >500 kB chunk warning retained.
- `git diff --check`: **PASS**. No broad unrelated suites or live requests.

Two test-tool corrections were necessary: the asset audit now selects the exact
original body node instead of accidentally selecting the newly seven-morph exam
mesh; the contact assertion is made during contact rather than after several
screenshots, when the gesture has correctly returned to rest. No runtime guard
was weakened. Windows teardown required stopping only the exact logged test-owned
Node PID after the passing scenario; owner review hosts were untouched.

## Preservation / hashes

New GLB: `745c2d1bb958dc055f46b81410684f1212f96217786d36a37ebed6543da5c5b9`.
Prior GLB: `35221a6e86aebd940af81a9aa8f4252375c79f76024a357e2ea059ac34649328`.
v24 blend: `d13355fd20dce36a1e83954372a1595ef32d3218799af8e3b46c976757181b9b`.

Unchanged:

- v23 blend: `1f6c1bae3a38ea5174f5e7394ccd8af1366365a3b44ff70b9d96ab84a8a35b4a`.
- Dana clinical source: `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`.
- Dana original FBX: `3e337766adc1f5067e6a6f522a22d0a05fa74ec016f360b61734221c9c8752c1`.
- STEMI GLB: `00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1`.
- STEMI blend: `93934bbae40e4657d9fac15568d5e7b5a6dfb307fba2a74ea2a189af75ec37d6`.
- V1 README/HTML match established SHA-256 baselines; frozen Architecture/ADRs have zero diff.

This pass changes Dana-only motion/rig/types, GLB/manifest, focused tests and asset
audit; adds two reproducible authoring/integrity scripts, one independent blend,
and this handoff. Existing V2-026 WIP is retained and unstaged. The tracked overall
diff remains 11 files, +124/-32; Dana-specific work is still untracked pending
eventual review, so `git diff --stat` alone does not count it.

## Remaining limitations / review

This is bounded Expo deformation, not a generalized muscle/cloth/soft-tissue
simulation. Source-mesh elbow creasing remains visible at the bent arm; the
wrist/contact correction does not promise perfect anatomy from every orbit angle.
Facial changes and lip-swelling reduction are intentionally mild and best judged
in the paired close-ups. Owner acceptance of breathing readability and neck-hand
appearance is still required. Prior successful Dana live voice proof is reused;
no credentials inspected and no provider requests. No commit, push, closure or V2-027.
