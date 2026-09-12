# V2-020 — Final ElevenLabs Voice closure report

Repository baseline: `c76deb3ede79cfc9e988164f18eba24e189aacde`, `v2-development`.
This checkpoint preserves the reviewed C2/C2A correction. No further Voice
implementation change, live provider request or quality comparison is required
by this closure pass.

## Decision and closure authority

Voice provider: **ELEVENLABS — FINAL / APPROVED / CLOSED**.
STT: `scribe_v2_realtime`. TTS: `eleven_v3_conversational`.
[ADR-VOICE-PROVIDER-001](../adr/ADR-VOICE-PROVIDER-001.md) remains ACCEPTED.
Azure Speech is RETIRED / SUPERSEDED: no active runtime, dependency, hybrid or
fallback. Historical Azure observations remain labeled history, not active policy.
No ElevenAgents or provider-owned clinical/LLM orchestration is introduced.

Both required live integration samples are **PASS**, attributed to the product
owner below. Overall **V2-020 is CLOSED only when this final authored tree also
passes local verification, one normal Git checkpoint/push, and exact-SHA CI**.
The final task report and the GitHub Actions run for that commit are the release
evidence; this pre-commit document does not invent its own future SHA/CI result.

## Live STT integration — PASS

Product-owner report from the actual browser smoke:

| Field | Observed result |
| --- | --- |
| Microphone permission | GRANTED |
| Single-use STT token | RECEIVED; `realtime_scribe` |
| Provider/model | ElevenLabs / `scribe_v2_realtime` |
| Product locale | `ar-JO` |
| Provider language hints | primary `ar`, secondary `en` |
| Recognition outcome | `READY_TO_REVIEW` |
| Safe error | NONE |
| Committed transcript | Produced and remained editable |
| Preserved meaning | Pain, approximately one hour, pressure/tightness, chest |
| Listening callback → first partial | Approximately 2455.4 ms |
| Explicit Stop → final settlement | 347.5 ms |

These are **one integration sample**, not population latency statistics or a
physical microphone-onset measurement. No automatic transcript submission,
Patient/Interpreter request or clinical execution occurred in this smoke.

## Live TTS integration — PASS

The token defect was confirmed by the owner's live browser evidence: close `1008`,
provider code `invalid_token_type`, expected `ttd_websocket`, received
`tts_websocket`. The earlier C1/C1A assumption that ordinary TTS authorization
also covered Text-to-Dialogue is explicitly superseded. C2 diagnostic/framing
improvements are preserved; the C2A correction changes the trusted token scope.

After correction, the owner reran **exactly one browser TTS integration smoke**
with the same approved configured Voice ID and `eleven_v3_conversational`.
Audio generated and became playable: **PASS**.
User-perceived generation/playback readiness was **approximately 1–2 seconds**.
No precise first-audio telemetry value or population statistic is inferred.
Human result: **EXCELLENT / APPROVED** — natural, clear, high fidelity, distinctly
Jordanian and appropriate for the immersive Patient experience. This confirms
integration; it does not reopen provider selection or add a quality competition.

## Final token and protocol contracts

| Trusted capability | Single-use type | Trusted server mint |
| --- | --- | --- |
| STT | `realtime_scribe` | `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe` |
| TTS / Text-to-Dialogue | `ttd_websocket` | `POST https://api.elevenlabs.io/v1/single-use-token/ttd_websocket` |

`ELEVENLABS_API_KEY` remains server-only. The browser receives capability-bound
single-use authorization, never the permanent secret or a `VITE_*` secret.
Callers cannot override raw provider token type, provider, model or actual voice.
Each connection requires one fresh token/issuance key; no token reuse, probe/reuse
or automatic reconnect exists. Duplicate, in-flight and failed issuance identities
remain fail-closed. Bounded broker tombstones are not replayable credential caches.

TTD URL:

```text
wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v3_conversational&output_format=mp3_44100_128
```

Separate ordered frames, with placeholders only:

```json
{"voices":["<trustedVoiceId>"],"single_use_token":"<server-minted-ttd-token>"}
{"inputs":[{"text":"<exact approved Patient text>","voice_id":"<trustedVoiceId>"}]}
{"close_socket":true}
```

Exactly one trusted voice is registered. Whitespace and approved text are unchanged;
no expressive tags, rewriting or clinical context are added. Ordered base64 chunks
remain bounded to 4 MB and require full `is_final`, not merely turn-final, before
playback. MP3 output uses `audio/mpeg`; replay is local, mute/unmount revoke the
Blob URL, and autoplay rejection permits manual replay. Text/manual fallback remains
available. Only allowlisted diagnostics/numeric close codes are exposed; no raw
provider messages, credential-bearing frames or tokens enter application telemetry.
Raw/generated audio is not persisted by the application.

## Clinical and AI authority

- Patient input: microphone → STT → committed editable transcript → learner
  review → existing `submitQuestion` → Terra Patient Agent.
- Clinical-action input: microphone → STT → committed editable transcript →
  learner review → Luna Interpreter candidate → catalogue reconciliation →
  confirmation → existing `/actions/propose` boundary.
- Patient playback: Terra → approved Patient text → ElevenLabs TTD → presentation.

Partial transcripts are display-only. Voice is never direct clinical execution
and cannot mutate Patient State, Clinical Time, Clinical Engine, Assessment or
action outcomes. Patient remains `gpt-5.6-terra`; Interpreter remains
`gpt-5.6-luna`. ADR-AI-MODEL-001 is unchanged. No Tutor, RAG or Case Builder work.

## Regression evidence and final checkpoint requirements

The 52 unchanged definitions remain **SAFETY / INTEGRATION REGRESSION CORPUS**,
not model/provider selection evidence. No full 52-live qualification, Azure
comparison or additional provider-quality evaluation is required.

The reviewed C2A tree already passed 113 Voice Browser tests, 2 Voice Deno tests,
9 mock-host tests and typecheck; full verification exited 0 with 863 Browser,
36 Deno, 11 workspace Playwright and 3 Voice Playwright tests, and Voice safety
24/24. This closure pass reruns focused Voice/token/provider/host/audit/portability
checks and **one final `npm run verify` after documentation is stable**, followed
by `git diff --check`. Its actual outcomes and exact-SHA CI belong in the final
checkpoint report. Tests/CI use mocks/local services, not live provider calls.
Browser/provider-bundle audits enforce permanent-key exclusion, no retired runtime,
no ElevenAgents, exact-text playback and DEV-only smoke isolation.

Only authored corrections, permanent tests/audits and closure documentation may be
staged. Generated build/test output, recordings, screenshots, environment files,
secrets and local smoke outputs are excluded. No production data or PHI is included.
No implementation changes were needed in Patient, Interpreter or AI Gateway for
this closure pass; their existing full-suite regressions remain required.

## Privacy and preservation

Current development/Expo use is **synthetic educational content only**, not real
patient data or PHI. **Zero Retention is not claimed or verified.** No local audio
persistence does not imply provider non-retention. Institutional production still
requires review of retention, account/plan settings, institutional policy, data
residency and BAA/HIPAA where applicable. Multi-instance deployment also needs the
previously documented shared issuance quotas/tombstones. These future production
requirements do not block synthetic Expo V2-020 closure and are not implemented here.

V1 hashes remain:

- `README.md`: `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`
- `er_sim_10.html`: `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`

STEMI remains **UNDER_REVIEW / REVIEW_ONLY**, with no Clinical Approval or Published
package. Exact review-subject hash:
`46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`;
review-execution hash:
`a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`;
golden trace:
`14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`.
Frozen Logical/Physical Architecture and other accepted ADRs remain unchanged.
No remote Supabase, production-region configuration, deployment or V2-021.
