# Dana micro-polish — owner review candidate v23

**V2_026_READY_FOR_OWNER_VISUAL_REVIEW — YES**. Not CLOSED. Final owner visual
approval remains pending; no clinical/rights/publication approval is implied.

This continues v18 without rebuilding the patient. The owner accepted the
forearm/neck scratching, pauses/strokes/targets, device logic, body-complete
examination approach, modest coverage/reset, treatment response and camera.
Those systems are preserved, not newly redesigned in this pass.

## Four requested refinements

1. **Covered chest contour:** broad paired shallow contours and a small central
   relaxation, confined to the existing exam torso and corresponding opaque bra.
   Maximum displacement below 1.5 cm; unchanged identity, proportions, neck/arm
   joins and coverage boundary. No breast detail or additional exposure added.
2. **Navel:** centered shallow indentation (under 3.1 mm) and continuous localized
   crease tone. Actual-app QA caught two visibility problems: the collar seam
   mask extended to the abdomen, and an intermediate glTF export assigned color
   to an unused channel. The mask now only covers the collar; the final export
   uses a directly supported COLOR_0 material. Both have regression coverage.
3. **Breathing:** the same Spine2/RR-driven layer uses a bounded 0.016-radian
   untreated amplitude and 0.010-radian improved amplitude (both below one degree).
   RR28 -> RR20 and authoritative improvement semantics remain unchanged. The
   result is deliberately modest, visible in the close examination view and
   continuous recording; no new physiology, breathless TTS or new motion system.
4. **Bed/pillow:** donor metal supports were at 42 degrees, protruding through the
   accepted 35-degree white Dana mattress. They now sit beneath that mattress.
   A fitted copy of the approved STEMI rectangular/compressed pillow and piping
   replaces the round disc. An intermediate retained donor transform animation
   was caught in the app and removed from these static bedding copies only.
   Room/equipment layout, fitted sheet, lower blanket and patient pose are intact.

Current independent file:
`visual-patient-lab/blender/patient_anaphylaxis_dana_v23.blend`.
v19–v22 are intermediate authoring/export candidates, not final review assets.
All v01–v18 and approved STEMI files remain preserved. No original FBX edit.

## Actual-app evidence

Gallery: `v2/test-results/v2-026-micro-polish-review.html`.
Artifacts are local review evidence, intentionally ignored by Git.

Directory:
`v2/test-results/v2-026-micro-polish-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/`.

| Requested view | Screenshot |
| --- | --- |
| Normal untreated Dana | `01-normal-untreated-no-devices.png` |
| Chest medium | `06-chest-body-complete.png` |
| Close contour / neck / shoulders | `07-chest-neck-shoulder-close.png` |
| Abdomen / navel | `17-abdomen-navel.png` |
| Untreated breathing | `18-untreated-breathing-inhale.png`, `18-untreated-breathing-exhale.png` |
| Treated calmer breathing | `19-treated-breathing-inhale.png`, `19-treated-breathing-exhale.png` |
| Bed/pillow | `16-white-bed-pillow.png` |
| Cover/Reset | `14-cover-reset.png` |
| Accepted scratching unchanged | `04-forearm-contact-stroke.png`, `05-neck-contact-stroke.png` |
| Continuous app motion / treatment | `video.webm` (silent) |

The final app scenario uses the real existing actions/coordinator and authored
delayed improvement, not hidden patient-state writes. It preserves one model UUID
and one load; committed IV/fluid/monitoring devices; clinical observations;
calm face, rash/swelling reduction and scratching shutdown. Cover/Reset restores
the original shirt. Manual camera control remains available after autofocus.
The separate 4195 offline app was also inspected interactively. No provider call
or credential access occurred; previous Dana live-voice evidence is reused.

## Focused verification

- **43 distinct focused Browser tests PASS**: 42 passed before the final navel
  export correction; final affected motion/contact tests **16/16 PASS**, including
  the additional exported crease/mask regression. Unchanged case/equipment/camera
  tests were not repeatedly rerun. Prior motion/contact count was 15, now 16.
- Final actual-app Dana scenario: **1/1 PASS**, exit 0. It includes observed
  untreated/treated breathing phases, exam/reset, scratching, single-instance
  preservation, real local treatment and devices. No external provider access.
- Asset/hash/export audit: **PASS**. Original fallback unchanged, shared Cotton/
  Blanket materials and texture bytes match STEMI, one rig, valid normalized
  runtime weights, original six facial morphs, opaque coverage, no male patient.
- Read-only Blender micro-polish integrity: **PASS**. Original face/body, hair,
  eyelashes, shirt, jeans, shoes, fitted sheet and blanket coordinates exact;
  existing morph deltas preserved; closed joins; bounded contour/navel; supports
  below sheet; no donor pillow-transform animation.
- Final `npm run typecheck` and `npm run build`: **PASS, exit 0**. Existing
  >500 kB build chunk warning remains. No broad unrelated verification campaign.
- Windows test-host teardown hung after success. Only the exact reported
  Playwright-owned Node PID was inspected and stopped; owner host untouched.
- `git diff --check`: **PASS**.

## Preservation and scope

New Dana GLB SHA-256:
`35221a6e86aebd940af81a9aa8f4252375c79f76024a357e2ea059ac34649328`.
Previous v18 GLB:
`f1a0ba6954a7568a6e16fa2a7028e383c6613e2530c44a2d2c6453208983978f`.
Manifest hash change is intentional presentation-only packaging.

Unchanged hashes:

- Dana clinical source: `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`.
- Dana source FBX: `3e337766adc1f5067e6a6f522a22d0a05fa74ec016f360b61734221c9c8752c1`.
- STEMI runtime GLB: `00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1`.
- Approved STEMI blend: `93934bbae40e4657d9fac15568d5e7b5a6dfb307fba2a74ea2a189af75ec37d6`.
- V1 README/HTML match their established SHA-256 baselines.

No clinical source, provider, conversation, accepted hand target/stroke/schedule,
camera, device projection, V1, frozen Architecture or ADR edit. Lab changes are
new independent Dana candidates only; no approved donor/source overwrite.

This pass changes the Dana GLB/manifest, breathing amplitude, collar-mask bound,
two focused test files, app evidence capture and handoff; adds reproducible
authoring/integrity scripts and this QA record. Existing broad V2-026 WIP remains
unstaged. Local screenshots/video/logs are not deliverable source files to stage.

Limits: contour/navel/breathing remain subtle Expo presentation, not a detailed
anatomical model or generalized cloth simulator. Owner visual acceptance of these
four refinements is still required. No commit, push, closure or V2-027 work.
