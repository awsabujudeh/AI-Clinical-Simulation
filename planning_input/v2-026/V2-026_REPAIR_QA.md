# Dana chest/contact repair continuation

Historical v10 checkpoint. Superseded by the [v12 micro-repair review](V2-026_MICRO_REPAIR_QA.md).
The following result accurately records the earlier pass, not current readiness.

Result: **V2_026_READY_FOR_OWNER_VISUAL_REVIEW — NO**.
V2-026 is not closed and owner visual approval has not been granted.

## Current candidate / continuation

- Continued the interrupted v04 working scene, without resetting prior work.
- Independent candidates v05–v10 preserve v01–v04. Current file:
  `visual-patient-lab/blender/patient_anaphylaxis_dana_v10.blend`.
- Current packaged GLB SHA-256:
  `11b86345ce84e09c847695eb3dcd08f6adaa8a184a3e6b9c21dd8f34acb8441f`.
- Static fallback is the normal-clothed v05 scene still; later versions change
  examination-only geometry. Its hash is recorded in the existing manifest.
- No new live Conversation, token, TTD or other external-provider request.
  The owner-confirmed earlier successful Dana live proof remains valid evidence.

## Repairs and actual-app checks

1. Examination-only skin is connected to a copy of Dana's original head/limbs,
   with original facial morph deltas and the same skeleton. It is mutually
   exclusive with the ordinary body, not a second visible patient.
2. Removed dark clothing-baked collar/cuff shading from examination joins;
   relaxed contours and skin-weight gradients. Material and normal correction
   now includes glTF multi-material descendants rather than relying on names.
3. Opaque neutral coverage remains over breast tissue; real upper-chest skin is
   visible. Cover/Reset restores the original everyday shirt and body.
4. Existing stethoscope selection plus clicking upper-chest skin reaches the
   semantic examination-action panel. No examination was submitted; no finding
   was invented and Clinical Time/vitals stayed unchanged.
5. Normal and alternate camera views show head/pillow, back, pelvis and legs
   resting on the clean articulated bedding. No male patient/donor blanket is
   exported. Restored ED cabinet, monitor, IV stand and wall services remain.
6. Forearm rub target moved away from the other hand toward the forearm shaft.
   Actual rendered sequence shows rest, crossing/rub, return and pauses. It is
   still a simple procedural overlay, not precision finger/contact animation.
7. Region autofocus is bounded; manual zoom/orbit holds without snap-back;
   Reset Camera and Cover/Reset were exercised in the actual V2 app.

## Remaining visual defects — do not hide behind test results

- Close-up still shows a contour/shading ridge around the proximal upper arm
  and uneven clavicular detail. The dark rings improved substantially, but the
  requested seamless anatomical result is not fully achieved.
- The rubbing target is improved, but wrist/finger articulation remains stiff;
  full natural-contact acceptance is not claimed. Sampled views did not show
  the earlier large arm-through-torso traversal. This is not a collision proof.
- No precision auscultation-site anatomy, new finding or lip-swelling visual
  was introduced. Chest coverage intentionally limits exposure.

## Actual-app evidence (local ignored screenshots, not staged)

Root: `v2/test-results/v2-026-repair-final/`.

- [Normal Dana on bed](../../v2/test-results/v2-026-repair-final/01-normal-dana-bed.png)
- [Chest examination](../../v2/test-results/v2-026-repair-final/02-chest-examination.png)
- [Close neck/shoulder/arm joins](../../v2/test-results/v2-026-repair-final/03-neck-shoulder-close.png)
- [Stethoscope request and action-panel handoff](../../v2/test-results/v2-026-repair-final/04-stethoscope-access.png)
- [Forearm rub](../../v2/test-results/v2-026-repair-final/05-forearm-rub.png)
- [ED room / manual camera](../../v2/test-results/v2-026-repair-final/06-ed-room-manual-camera.png)
- [Cover/Reset normal clothing](../../v2/test-results/v2-026-repair-final/07-cover-reset-normal.png)
- [Manual camera held](../../v2/test-results/v2-026-repair-final/08-manual-camera-held.png)

## Focused verification

- 10 focused Browser tests: motion composition, failure-only fallback, bounded
  camera/manual cancellation, exclusive clothing/body reset, visible exam
  raycasts and glTF-descendant seam shading — PASS.
- Pinned GLB/fallback, one skeleton, face morphs, opaque coverage and finite
  accessor bounds — PASS.
- Typecheck/build — PASS, exit 0. Existing >500 kB chunk warning remains.
- `git diff --check` — PASS; no staged files. Scoped literal-secret scan of
  changed runtime/test/manifest/handoff content found no matches.
- Actual V2 host `http://127.0.0.1:4194/`: visual QA and semantic exam handoff
  performed without live-provider calls or clinical submissions.
- V1 hashes unchanged; Dana clinical file hash unchanged:
  `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`.
- Frozen Architecture/ADRs and tracked STEMI case/public assets: zero diff.
- No commit, push, V2-027, clinical approval or publication.

Authoring scripts for this continuation are `v2-026-dana-seams.py`,
`v2-026-seam-topology.py`, `v2-026-seam-finish.py`, `v2-026-seam-polish.py`,
`v2-026-seam-weights.py` and `v2-026-seam-contours.py` under `v2/scripts`.
Each opens the preceding candidate and saves a new independent file. Do not
rerun the earlier v03→v04 repair as a replacement for the current candidate.
