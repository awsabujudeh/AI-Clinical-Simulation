# Dana final micro-fix — v25 owner-review candidate

**V2_026_READY_FOR_OWNER_VISUAL_REVIEW — YES**. V2-026 remains OPEN.
Owner visual approval is NOT granted. No clinical/publication/rights approval is implied.

## Three scoped outcomes

1. **Neck-scratch elbow:** the upper-arm hinge plane did not follow the actual
   elbow bend while the forearm was pronated towards the neck. The neck-only
   overlay now aligns that hinge, then restores the forearm world orientation
   before applying the existing pronation. The accepted elbow pole, hand target,
   wrist/finger strokes, gesture timing and forearm rubbing are unchanged. App
   contact/release frames show a continuous rounded elbow instead of the cut-off
   silhouette. No mesh replacement or global skin-weight modification was needed.
2. **Treatment relief:** independent `patient_anaphylaxis_dana_v25.blend` adds a
   small upward/outward mouth-corner and cheek cue to `Improved_Calm_v01` only.
   It complements the existing relaxed brow; the treated face is softer, not
   cheerful. Total deformation stays below 6 mm. Original anxious, blink,
   mouth-open, lip-swelling and accepted thoracic-breath keys are exact.
3. **Visible speaking:** the actual Student App's Play patient audio control,
   PatientSpeech callbacks and `observePatientAudio` drive the unchanged visual
   speaking lifecycle. A labelled test-only transcript/audio adapter supplies a
   12-second quiet synthetic tone. No token, provider, real speech generation,
   question submission or clinical write occurs. Mouth/jaw cycles, blink and
   anxious expression coexist; audio END returns articulation to zero. Patient
   state, one model UUID/load and breathing are preserved. Prior live Dana proof
   is reused, not repeated. This is **LOCAL ACTUAL-APP PLAYBACK PROOF**, not a new
   ElevenLabs or conversation-quality proof and not phoneme-synchronized speech.

The offline fixture is selected only by a Playwright-intercepted bootstrap marker
in the test/review entry, with no real voice profile present. No host emits that
marker. Production entry, Voice/Conversation code and trusted provider policy are
unchanged. The on-screen banner explicitly identifies the synthetic fixture.

## Owner evidence

Open `v2/test-results/v2-026-elbow-face-speaking-review.html` for labelled matched
comparisons and links to the original motion recordings. All media below are
ignored local review artifacts; they are not source files to stage.

Actual-app treatment/contact directory:
`v2/test-results/v2-026-elbow-face-speaking-app/v2-026-e2e-dana-Dana-uses--d1e9d-nce-and-review-only-actions/`

- `23-untreated-face-lips.png` / `24-treated-face-lips.png`: matched anxious/calm.
- `20-neck-wrist-contact-a.png`, `21-neck-wrist-contact-b.png`,
  `22-neck-wrist-contact-c.png`: repaired contact/release/rest.
- `05b-neck-contact-alternate-angle.png`: second arm angle.
- `04-forearm-contact-stroke.png`: retained accepted forearm scratching.
- `01-normal-untreated-no-devices.png`, `06-chest-body-complete.png`,
  `14-cover-reset.png`, `15-shared-ed-room.png`: preserved accepted presentation.
- `video.webm`: continuous actual-app neck motion and authored treatment response.

Actual-app speaking directory:
`v2/test-results/v2-026-speaking-app-proof/v2-026-e2e-speaking-app-ac-01976-ovider-or-clinical-mutation/`

- `01-anxious-before-speaking.png`: before audio.
- `02-speaking-open.png`, `03-speaking-narrow.png`,
  `04-speaking-open-again.png`: changing mouth/jaw during playback.
- `05-after-audio-end.png`: articulation stopped, same anxious patient.
- `video.webm`: **28.40 seconds**, continuous actual-app local speaking proof.
  Playwright records the picture only; the recording is silent. It does NOT
  contain synthesized patient speech. The visible banner and playback UI identify
  the test. Installed FFmpeg decoded a frame successfully, exit 0.

The raw recordings include viewport changes during screenshot capture; they are
review evidence, not a polished demo. Use a local WebM-capable player if Codex's
embedded player cannot play them. Original images remain available separately.

## Focused verification

- **26/26 Browser tests PASS**, exit 0: motion 10, contact 11, repair/camera 5.
  Includes bend-plane alignment, fixed neck hand target, unchanged forearm/rest,
  bounded calm cue and composition with speech/blink.
- **2 actual-app scenarios PASS**: existing full Dana treatment/contact scenario
  (2.2 minutes), then isolated local speaking scenario (29 seconds, runner exit 0).
  The first combined run's speaking fixture was rejected for an invalid test
  profile ID. The fixture ID was corrected to the existing contract and only that
  scenario reran. No application guard/schema was weakened.
- Speaking proof blocks external requests and asserts none occurred, no browser
  errors, unchanged authoritative state, one model load and matching model UUID.
- **Blender integrity PASS**, exit 0: all 391 mesh bases/weights exact versus v24;
  all non-calm keys exact; only the two original/exam-body calm keys changed;
  one armature. Prior v24 file hash unchanged.
- **Asset/export/hash check PASS**, exit 0; normalized skinning, required morphs,
  opaque coverage, male exclusion, exact shared linen and fallback checked.
- **Typecheck PASS**, exit 0. **Build PASS**, exit 0. Existing large-chunk warning.
- `git diff --check`: PASS. No broad unrelated suites or live provider requests.
- Windows test teardown required stopping only the exact logged test-owned Node
  PID after the passing isolated scenario. Owner review/trusted hosts untouched.

## Preservation and delta

GLB old: `745c2d1bb958dc055f46b81410684f1212f96217786d36a37ebed6543da5c5b9`.
GLB new: `17f578e1813b4d96a365c50c498ad8251fcb39b805119ce7c030611c96e7bc65`.
v25 blend: `ebb8ea3f831d52bcf1a4cf6bde0047b30084e4f6ec897866f722a1be2d0b8062`.

Rechecked unchanged: v24 blend, Dana source FBX, Dana clinical source, STEMI GLB
and approved Blender file, V1 README/HTML. Frozen Architecture and ADRs have zero
Git diff. No changes to STEMI-specific behavior, Voice/Conversation source,
clinical truth, device logic, coverage, camera or accepted breathing.

Pass-specific edits: Dana rig, GLB/manifest, contact tests, test/review playback
composition and handoff. Added one independent blend, reproducible calm authoring
and integrity scripts, two read-only elbow investigation scripts, local speaking
fixture/scenario, this report and ignored review artifacts. Existing uncommitted
V2-026 work is preserved. No staging, commit, push or V2-027.

## Remaining visual limitations

Expo-grade linear skinning retains some ordinary inner-elbow crease at deep flex;
this is not a muscle/soft-tissue simulator. The visible cut-off joint is repaired.
Facial relief is a restrained clinical expression, not a large smile. Speaking
uses bounded jaw/mouth oscillation, not phoneme lip sync. Owner review is still
required for the final appearance. V2-026 is NOT CLOSED.
