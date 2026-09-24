# V2-026 — baseline correction / source-body blocker

**V2_026_READY_FOR_OWNER_VISUAL_REVIEW — NO**

Not CLOSED. Owner visual approval is absent. Clinical, curriculum, publication
and distribution-rights gates remain unchanged. No provider requests were made.

## Six requested areas

1. **Chest examination — BLOCKED, rejected reconstruction disabled.** A fresh
   read-only import of the exact original Dana.fbx found six meshes. Ch22_Body
   has 9,692 vertices but **zero** in the central torso region
   `abs(x)<17, 100<y<140` (source centimetres). Ch22_Shirt has 2,703 vertices in
   that region. The original skin mesh contains head/limbs, not hidden torso
   anatomy. Removing the shirt cannot reveal an original abdomen/chest. No new
   torso was sculpted, no substitute patient used, and no body proportions changed.
   The old candidate remains preserved in prior files and hidden in runtime.
   Chest focus keeps ordinary clothing and an explicit source-missing notice.
   Breast-only coverage/visible abdomen is therefore **not delivered**. A
   same-Dana body-complete source or an explicit revised modeling scope is needed.
2. **Shared device logic.** Cuff/IV/line props copied from a donor scene were
   always visible; exported underscore names also defeated space-based matching.
   The shared PatientEquipment layer suppresses those fixed props and attaches
   devices to the live skeleton. It starts empty. Server projection requires
   exact Case pin, matching catalogue/event type, COMMITTED learner execution,
   VERIFIED catalogue membership and EXECUTED payload. Raw intent never counts.
   Dana monitoring / IV / fluid and corresponding existing STEMI actions are
   explicit presentation bindings. Tubing requires prior committed IV access.
   Stand-side arm selection avoids routing across the patient's face/bed.
   Optional strict equipment booleans are display-only, not clinical authority.
3. **Room/bed.** Existing ED room, monitor/cabinet, bed, sheet and pillow retained.
   Independent v13 then v14 add/refit opaque blue lower-leg cover, clear of hands
   and feet; no donor-body blanket impression restored. One Dana remains loaded.
4. **Scratching.** Existing base-plus-overlay adapter now alternates forearm and
   lower-neck/collar rub episodes, with finger flexion strokes and unequal pauses.
   Neck target/elbow path was corrected after actual-app inspection showed the
   first attempt behind the visible neck. This is a modest low-poly approximation,
   not collision-certified fingernail simulation. It pauses in focused examination.
5. **Treatment response.** Existing authored clinical improvement signal controls
   calm face, RR20 breathing, scratch stop and rash fade to 6% of initial intensity.
   Initial localized rash is more visible. No vitals thresholds, shader-derived
   diagnosis, new clinical effects, swelling model or medical edits were introduced.
6. **Shared-runtime consistency.** Same loader, instance, camera, playback and
   examination framework retained. Devices use one shared class for both patients;
   asset-specific skeletal anchors remain adapters. No Voice/Conversation changes.

## Actual-app evidence

Offline review host: `node scripts/v2-026-review-host.mjs --port=4195` with live
proof disabled. The owner's host on 4194 was not stopped or reconfigured.
Test-owned host 4196 used the existing Student App and authoritative action path.
No external provider access; synthetic local actions only.

Screenshots (ignored local evidence, not staged):

- `v2/test-results/v2-026-baseline-review/01-untreated-room.png`
- `v2/test-results/v2-026-baseline-review/02-chest-source-blocked.png`
- `v2/test-results/v2-026-baseline-review/03-cover-reset.png`
- `v2/test-results/v2-026-baseline-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/dana-scratching.png`
- same directory: `dana-neck-scratching.png`, `dana-improved.png`.

The app scenario uses the existing epinephrine/oxygen/IV/fluid path, then advances
180 clinical seconds through the coordinator. It checks initial absent devices,
post-access infusion, committed monitoring/cuff, calm face, reduced rash, stopped
itching, unchanged instance UUID and one model load. It does not bypass clinical
state, scoring or review gates. Chest assertions now verify truthful unavailability,
not successful exposed-skin examination. Cover/Reset and camera remain usable.

## Verification and integrity

- 38 distinct focused Browser tests passed across Dana motion/contact/camera,
  equipment, clinical-case foundation and STEMI visual-contract regression.
  Changed subsets were rerun after corrections; counts are not added per rerun.
- Actual-app treatment/review scenario and forced static fallback: 2/2 PASS.
- Typecheck and build: exit 0. Existing >500 kB bundle advisory remains.
- GLB/fallback pinned hash and asset integrity: PASS. `git diff --check`: PASS.
- A stale development module initially invalidated test diagnostics; a fresh test
  host resolved it. The device assertion now awaits presentation after HTTP commit
  rather than reading before the next render. No assertion was removed.
- Windows test teardown needed stopping only the exact test-owned Node PID after
  tests finished; the owner's trusted host was untouched.
- Source continuation v14:
  `visual-patient-lab/blender/patient_anaphylaxis_dana_v14.blend`.
- GLB: `ef35b75d4dbf972e4a2beedcc923ccd38bd1e022a34b2f9cbdb264026f434056`.
  Earlier v12: `f3fb08e9e3020e20a0dafedd93dd7dd58c7fc5d769287232a6671fcebafb7262`.
  Hash change is the fitted blanket, not clinical content or patient anatomy.
- Dana clinical source remains
  `82be2316b8f792d4a63821bd93b943c73cd11a7d0bacdd989301aeb05f88fc64`;
  review execution hash is unchanged. V1 hashes and approved STEMI GLB preserved.
  Frozen Architecture, accepted ADRs and STEMI clinical sources have no Git diff.
- Earlier Dana/approved STEMI Lab sources were not overwritten. Lab work in this
  pass consists of new independent Dana files only. No credentials were accessed.

No commit, push, closure, V2-027, live provider request, clinical approval or
architecture redesign. The chest-body source decision is the remaining blocker;
the visual refinements still require owner review, not automatic approval.
