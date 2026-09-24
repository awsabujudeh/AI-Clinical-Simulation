# Dana v10 continuation — final micro-repair review

> Historical agent review. The owner subsequently rejected this torso approach.
> Current status and blocked chest-source requirement are recorded in
> [baseline correction QA](V2-026_BASELINE_CORRECTION_QA.md). This is not approval.

**V2_026_READY_FOR_OWNER_VISUAL_REVIEW — YES**

Owner visual approval is still required. V2-026 is NOT CLOSED. No medical,
publication, curriculum or rights approval is implied.

## Scope and causes

Continued the current uncommitted v10, saving independent v11 and v12 candidates.
No earlier Dana or approved STEMI file was overwritten.

1. **Shoulder / upper-arm join:** regularized the residual cuff-shaped contour.
   Exported normals match across both material boundaries. The right original
   body begins at |X| approximately 0.261 m, earlier than the left (0.282 m);
   the old material transition began too late on the right. Corrected that
   range after geometry repair. The original diffuse/normal texture contains
   baked clothing-cuff shadows; ordinary clothed Dana remains unchanged.
2. **Clavicle / neck:** found 22 non-manifold local edges and seven folded
   triangles in the previous angularly sorted collar connection. Replaced only
   that local band with actual boundary-edge walks and a smooth, skinned bridge.
   Current collar has zero non-manifold edges or folded faces under the focused
   geometry check. No face/head rebuild or new anatomy system.
3. **Coverage:** retained opaque existing coverage, gently shaped the upper
   border and added body-following shoulder straps so it reads as a neutral
   clinical longline examination top. Strap weights map by bone name, not group
   index. Breast tissue remains covered; upper chest remains visible.
4. **Hand:** mild relaxed finger flexion, bounded wrist flexion with palm
   pronation, and a finger-pad target on the forearm replace stiff wrist-first
   contact. A small receiving-arm lift clears the shirt at peak contact.
   Existing intermittent episode timing, pauses and return envelope are retained.

## Current assets

- Source continuation: `patient_anaphylaxis_dana_v10.blend`.
- Final independent file:
  `visual-patient-lab/blender/patient_anaphylaxis_dana_v12.blend`.
- Packaged GLB SHA-256:
  `f3fb08e9e3020e20a0dafedd93dd7dd58c7fc5d769287232a6671fcebafb7262`.
- Previous v10 GLB SHA-256:
  `11b86345ce84e09c847695eb3dcd08f6adaa8a184a3e6b9c21dd8f34acb8441f`.
- Existing normal-clothed fallback is unchanged; its v05 source and hash remain
  explicit in the media manifest.

## Actual-app review

Used the existing Dana V2 review host on `http://127.0.0.1:4194/` without asking
another question or playing/requesting audio. The visible prior conversation
is historical evidence, not a new live provider proof.

- Inspected front and both oblique chest/shoulder views, including zoomed joins.
  No discrete cuff-like join ridge remained at normal examination distance.
- Inspected contact and rest sequences from two manually controlled views.
  Finger posture reads as forearm rubbing; sampled final frames did not show
  the prior large forearm-through-shirt intersection.
- Cover/Reset restored everyday clothing; exit restored the normal patient view.
- Manual orbit/zoom held without snap-back. Camera implementation is unchanged.
- One Dana, existing bed contact, ED equipment, breathing and living state remain.
- No clinical examination/action was executed; displayed time stayed 00:00 and
  authored initial observations remained 126 / 82–48 / 28 / 93% / 36.7 C.

## Owner review screenshots

All are actual-app captures in the ignored local evidence directory. They are
not repository source assets and have not been staged.

1. [Front chest / clavicle](../../v2/test-results/v2-026-micro-repair/01-front-clavicle.png)
2. [Right shoulder / upper arm](../../v2/test-results/v2-026-micro-repair/02-right-shoulder-join.png)
3. [Left shoulder / upper arm](../../v2/test-results/v2-026-micro-repair/03-left-shoulder-join.png)
4. [Normal examination distance / coverage](../../v2/test-results/v2-026-micro-repair/04-normal-exam-coverage.png)
5. [Forearm contact](../../v2/test-results/v2-026-micro-repair/05-forearm-contact.png)
6. [Wrist / fingers close-up](../../v2/test-results/v2-026-micro-repair/06-wrist-finger-contact-close.png)
7. [Returned rest pose](../../v2/test-results/v2-026-micro-repair/07-returned-rest.png)
8. [Cover/Reset / ED room](../../v2/test-results/v2-026-micro-repair/08-cover-reset-ed-room.png)

## Focused verification

- 14/14 Browser tests, three files: motion, camera/cover/raycast/material
  behavior, exported join normals, finger-pad reach, bounded wrist flexion,
  exact non-accumulating rest return and input preservation — PASS.
- Read-only Blender v10/v12 comparison — PASS: only `Dana_Exam_Skin` and
  `Dana_Clinical_Exam_Top` mesh signatures differ; ordinary Dana, environment,
  authored pose and original facial keys preserved.
- Collar/arm geometry integrity, opaque coverage — PASS.
- Pinned GLB/fallback asset check — PASS.
- Typecheck — PASS, exit 0. Build — PASS, exit 0; existing large-chunk advisory.
- `git diff --check` — PASS. No staged files, commit or push.
- Dana clinical source hash remains
  `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`.
- V1 hashes, frozen Architecture/ADRs and tracked STEMI content/assets preserved.

## Honest limits

This is a low-complexity Expo presentation, not detailed anatomical sculpting,
cloth simulation, collision-certified contact or precision fingernail animation.
Subtle skin/material and low-poly detail can remain at extreme zoom. Coverage
intentionally limits exposure. No new auscultation findings or clinical state
are derived from the visual surface. Owner acceptance remains the next gate.

No Voice, Conversation, AI policy, clinical truth, scoring, camera architecture
or ED environment changes. No external-provider request, V2-027 or closure.
