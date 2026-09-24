# V2-026 — Same-Dana body-complete owner-review candidate

Status: **READY_FOR_OWNER_VISUAL_REVIEW — YES**. Not CLOSED; no owner visual,
physician, publication, curriculum or distribution-rights approval is claimed.
This supersedes the source-torso blocker in the baseline-correction report only
because the owner explicitly authorized a new same-Dana body-complete mesh.

## Changes in this pass

- Independent v15–v18 candidates; current working file is
  `visual-patient-lab/blender/patient_anaphylaxis_dana_v18.blend`.
- `Dana_BodyComplete_Exam`: a clean silhouette-fitted volume, not the rejected
  shirt-derived surface. Neck/upper-arm joins share connected geometry, smooth
  normals and blended skin weights. Original head/face, hands, hair, jeans, shirt,
  footwear and normal-clothed body coordinates are preserved exactly.
- `Dana_Clinical_Bra`: opaque, neutral, breast-only coverage. Chest/clavicular
  region, shoulders and abdomen are visible. No underlying breast detail or
  unnecessary exposure was authored. Clothing and exam body are mutually
  exclusive; Cover/Reset returns the original clothing on the same loaded rig.
- Forearm and neck gestures use reach → held contact → four small strokes →
  release, with unequal pauses. Wrist translation and finger flexion occur during
  the plateau. Neck hand approaches across the lateral/anterior neck with elbow
  outboard, not through the shirt. Two-angle actual-app captures expose contact.
- `Lip_Swelling_Mild` is a lip-only additive shape (704 original-body vertices,
  maximum delta below 4 mm). It has no inherited editor expression. Existing
  blink, mouth, anxiety and calm shapes remain independently composable.
- Authoritative improvement still drives calm face, rash .06, swelling .05,
  RR28→20 and zero scratching. Rendering/speech never changes clinical truth.
- Exact Cotton/Blanket materials and texture bytes from approved STEMI physical
  exam v02 are reused, with valid UVs on the Dana-fitted bedding. Existing room,
  bed frame, cabinet, monitor and wall equipment remain. No shared architecture
  or device logic was replaced.

## Actual-app QA and boundaries

Offline review host only; all external requests blocked in the app fixture.
No conversation, token or TTD request was made. Previous live proof is reused.
Conversation unavailable in these screenshots is the intentional offline mode.

The initial app has one Dana model load and no BP/IV/tubing. Real committed
epinephrine, oxygen, IV/fluid actions and trusted review advancement produce the
existing clinical improvement; monitoring subsequently attaches the cuff.
The first stale command is correctly rejected with 409 and resynchronized.
The patient UUID remains unchanged across exam, Cover/Reset and treatment.

The final actual-app scenario passed, including two-angle neck contact, camera
orbit/zoom, clothing switch/reset, rash/swelling reduction, scratch shutdown,
committed devices and investigation result. Normal and chest views were also
inspected interactively in the actual app. No hidden runtime override was used
to manufacture a treated clinical state.

## Owner-review artifacts (local, intentionally ignored by Git)

Directory:
`v2/test-results/v2-026-body-complete-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/`

| Requested evidence | File |
| --- | --- |
| Normal untreated Dana; initial no-device state | `01-normal-untreated-no-devices.png` |
| Anxious face and mild lip swelling close-up | `02-untreated-face-lip-swelling.png` |
| Forearm active scratch contact | `04-forearm-contact-stroke.png` |
| Neck active contact | `05-neck-contact-stroke.png` |
| Neck contact from another angle | `05b-neck-contact-alternate-angle.png` |
| Chest full upper body | `06-chest-body-complete.png` |
| Neck/shoulder skin continuity and manual zoom | `07-chest-neck-shoulder-close.png` |
| Visible abdomen / opaque clinical coverage / stethoscope selection | `08-abdomen-and-clinical-coverage.png` |
| Improved Dana and action-driven devices | `11-improved-with-committed-devices.png` |
| Treated face and reduced swelling | `12-treated-face-swelling-reduced.png` |
| Rash improvement / same exam body | `13-rash-improvement.png` |
| Original clothing restored | `14-cover-reset.png` |
| Shared ED room/bed | `15-shared-ed-room.png` |
| Full app and deterministic improved observations | `dana-improved.png` |
| Silent offline actual-app motion / state sequence | `video.webm` |

Several images intentionally cover two requested evidence items; they are not
duplicate or fabricated captures. A local gallery is in
`v2/test-results/v2-026-body-complete-review.html`.

## Focused verification

- **41 distinct Browser tests PASS** across Dana motion (8), rig/contact/morphs
  (6), camera/exam repair (5), shared equipment (4), Dana clinical fixture (11),
  and existing visual patient contracts (7).
- After the final neck-path correction: affected motion/contact **14/14 PASS**.
- Actual app + forced fallback: **2/2 PASS** on the v18 asset. After the final
  neck-path correction, the affected full app scenario was rerun: **1/1 PASS**.
  Unchanged fallback behavior was not redundantly rerun.
- Read-only Blender integrity: **PASS**. Exact identity mesh coordinates,
  single armature, closed torso joins, valid skin weights, six morphs, bounded
  lip-only deformation, opaque abdomen-free coverage and shared linen UVs.
- Export audit: **PASS**. GLB hash, normalized runtime weights, shared skeleton,
  rejected geometry exclusion, male exclusion, exact shared material/texture
  comparison to STEMI, fallback hash and truthful review labels.
- `npm run typecheck`: **PASS, exit 0**.
- `npm run build`: **PASS, exit 0**. Existing >500 kB chunk warning remains.
- `git diff --check`: **PASS**. No full-project suite or live provider repeat.
- Windows Playwright teardown hung only after successful tests. Only each
  reported Playwright-owned web-server PID was terminated; owner host untouched.

## Preservation / hashes

Current Dana GLB:
`f1a0ba6954a7568a6e16fa2a7028e383c6613e2530c44a2d2c6453208983978f`.
Before this pass:
`ef35b75d4dbf972e4a2beedcc923ccd38bd1e022a34b2f9cbdb264026f434056`.
Change is intentional: body completion, coverage, lip morph and exact shared linen.
The original Dana fallback remains an explicitly labeled initial-reference still.

Unchanged:

- Dana clinical source SHA-256:
  `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`.
- Dana FBX: `3e337766adc1f5067e6a6f522a22d0a05fa74ec016f360b61734221c9c8752c1`.
- STEMI GLB: `00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1`.
- Original V1 README/HTML hashes match the required preserved baseline.
- Frozen Logical/Physical Architecture, ADRs and STEMI clinical content have
  zero Git diff. Prior Dana/approved STEMI Blender files were not overwritten.
- Shared equipment projection/attachment logic, Voice and Conversation unchanged.

## Remaining limits / handoff

Owner visual approval is pending. This remains a lightweight Expo review asset,
not a detailed anatomical atlas or generalized collision/cloth simulator. Contact
is authored for the supported resting pose; targeted exam disables scratching.
Facial and edema differences are intentionally mild. The case remains
UNDER_REVIEW / REVIEW_ONLY and rights remain RIGHTS_REVIEW_REQUIRED.

No newly observed major seam or neck-through-shirt defect remains in the final
captured states. Human acceptance must still judge expression and motion quality.
No clinical findings are inferred from this model or from stethoscope placement.

Git remains on `v2-development` at `bfb1ae3423f104cc873ec22a5f05ac2e07ac2901`.
All existing V2-026 WIP is preserved and unstaged. This pass changes Dana assets,
presentation adapter/envelopes, focused tests, asset audits and handoff docs;
it does not add clinical/provider behavior. The broad untracked Lab directory
predates this pass; do not stage it indiscriminately.

No commit, push, deployment, V2-027 work or V2-026 closure.
