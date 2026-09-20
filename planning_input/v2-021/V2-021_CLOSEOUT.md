# V2-021 Visual Patient Engine — CLOSED

Status: **CLOSED — human-approved for Expo scope**, 2026-09-20.
This is the current status record; earlier handoff reports retain historical
results and limitations, not outstanding closure blockers.

## Approved integrated capabilities

- Native 3D STEMI patient inside V2, with one retained patient instance.
- Semi-Fowler and Supine positions, smooth transitions and visible breathing.
- Pain, Anxious and Relieved facial presentation states; independent Speaking layer.
- Blink, gaze and living behavior, hand-to-chest and chest-contact behavior.
- Physical Examination runtime, region reveals, camera auto-focus and bounds.
- Semantic examination requests, not automatically executed clinical actions or findings.
- Live grounded Patient Conversation and real ElevenLabs TTD playback-driven speaking.

Presentation capability does not imply a clinical transition. The current STEMI
case retains pain; no relief transition, examination finding or medical approval
was invented. Both case versions remain UNDER_REVIEW / REVIEW_ONLY. Original
2.0.0 remains Patient-AI FORBIDDEN; only the hash-bound 2.0.1 successor is ALLOWED.

## Final live acceptance evidence

After a fresh owner-configured `dev:v2-021` restart, the UI showed Patient
available. The review bootstrap and question builder explicitly use ar-JO,
independent of the English shell default. Before this correction, the shell
sent en-US and the unchanged Arabic-only live-proof guard returned 403.
The trusted live case was already 2.0.1; no medical source correction was needed.

Question: «متى بلش وجع صدرك؟»

Grounded response observed: «بلّش قبل حوالي 55 دقيقة، ولسّه مستمر ما وقف.»

- Patient question: HTTP 200; ar-JO; grounded; no fallback.
- Voice token: HTTP 200; unchanged ElevenLabs TTD implementation and trusted profile.
- Actual unmuted HTML audio playback: START and END observed, duration 5.06775 seconds.
- Speaking ON during playback; Speaking OFF at END.
- Pain, breathing, blinking and hand behavior remained active afterward.
- Semi-Fowler position preserved; same patient instance before/during/after; one model load.
- Owner approved the final live result and Expo closure.

No raw provider frames, credentials, single-use tokens or local voice IDs are
included. Prior silent/failed-attempt recordings are not relabeled as successful
audio evidence. Final acceptance is based on observed live events and owner review.

## Verification and preservation

Reuse the recorded passing full verification and focused Voice evidence; no new
broad campaign is required. The final locale correction passed typecheck, all
five focused STEMI conversation/bootstrap tests and seven live-configuration
tests. Closeout reruns only focused V2-021 checks/build and Git whitespace safety.
Closeout results: 14/14 V2-021 Browser tests, 10/10 source/asset checks and build
PASS (exit 0). The existing approximately 617 kB lazy-runtime chunk warning is
non-fatal. Staged whitespace review removed only historical Markdown trailing
spaces and an extra EOF blank line in the runtime copy; behavior is unchanged.
The review-only one-question/one-token limits remain intact.

The laboratory source was not edited and is excluded from the commit. Only the
approved V2 runtime asset copies belong to the implementation. V1, frozen
Architecture and accepted ADRs remain unchanged. No deployment or push is part
of closeout.

## Final DEV review-session delta after ac3231

V2-021 Visual Patient Engine remains **CLOSED**. The ar-JO bootstrap correction
was already included in baseline `ac3231b37fd955bc4ef9b654e669675f72fd8123`.
The follow-up delta adds a fresh review Session per trusted host boot and
boot/page-scoped request identities. Old review URLs resolve to the current
boot's Session. The consumed DEV admission guard now returns safe
`REVIEW_PROOF_ALREADY_CONSUMED`; a page reload does not reset its budget.
Production authorization, idempotency/replay, provider limits and voice policy
are unchanged. STEMI 2.0.1 remains UNDER_REVIEW / REVIEW_ONLY.

Two independent owner-restarted fresh-session live proofs passed with the same
approved ar-JO history question: question HTTP 200, grounded answer, voice token
HTTP 200 and actual unmuted ElevenLabs TTD playback through END. Audio durations
were 4.284063 and 4.440813 seconds. Both proved Speaking ON then OFF, preserved
Pain, breathing, blinking, chest contact and position, and the same patient
instance with one model load. A consumed-session negative check returned the
safe 403 without another provider invocation.

Focused verification: typecheck PASS; 16/16 V2-021 Browser tests and 9/9 live
configuration tests PASS. Reuse this unchanged-code evidence for delta closeout;
only documentation is updated here, with a final `git diff --check`. No live
recordings, keys, local voice IDs or tokens are included. Visual Patient and lab
source remain untouched. No new broad test campaign is required.

## POST-EXPO / deferred polish — not blockers

- Patient age appearance refinement.
- Fine finger/knuckle detail.
- Advanced cloth compression.
- Additional physical-exam tools/findings.
- Additional patient positions and characters.
- Anaphylaxis visual patient.

## Next backlog entry — not started

V2-022: Produce and integrate the STEMI approved media package. Begin with an
inventory and rights/approval review of the required pre-generated diagnostic
media and static fallbacks, preserving disclosure and Case-owned references.
Do not reopen V2-021 or introduce in-platform media generation.
