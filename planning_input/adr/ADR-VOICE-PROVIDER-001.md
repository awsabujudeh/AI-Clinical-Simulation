# ADR-VOICE-PROVIDER-001 — ElevenLabs Unified Voice Provider

Status: **ACCEPTED** — explicit product-owner decision, V2-020C1; protocol and closure clarification V2-020C1A.

Provider selection: CLOSED.
ElevenLabs provider quality: APPROVED.
Corpus role: SAFETY / INTEGRATION REGRESSION CORPUS.
Full 52-live provider-quality retest required: NO.

## Context and evidence

The product owner reports Azure regional token exchange and direct ar-JO TTS **TECHNICAL PASS**, but ar-JO-SanaNeural and ar-JO-TaimNeural **PRELIMINARY HUMAN NATURALNESS FAILURE**: broken Arabic, robotic/clearly synthetic delivery and insufficient Patient immersion. These are human observations, not formal comparative API measurements.

The product owner has approved Jordanian and Arabic STT and TTS quality through direct hands-on ElevenLabs use. This is attributed human approval, not a fabricated API benchmark. Provider adoption is final, not provisional: no new provider competition, Azure comparison, multi-voice quality qualification or full 52-utterance live quality trial is required. C1/C1A make no live speech requests; the remaining live checks are integration smokes only.

## Decision and supersession

The Azure Speech provider selection in the Frozen Physical Architecture is **SUPERSEDED** by this ADR. Frozen Architecture remains historically immutable. **Only the provider-specific Voice choice is superseded. All provider-neutral Voice architecture invariants remain authoritative.**

ElevenLabs is the sole active STT and TTS provider. No Azure fallback, hybrid or silent model fallback exists. ElevenLabs performs AUDIO → TEXT and APPROVED TEXT → AUDIO only. No ElevenAgents, conversational agent, LLM or tool execution is introduced. Patient Conversation remains `gpt-5.6-terra`; Clinical Interpreter remains `gpt-5.6-luna`; ADR-AI-MODEL-001 is unchanged.

- STT targets `scribe_v2_realtime`. Product locales remain `ar-JO` / `en-US`; the speech adapter uses Arabic `ar` with English `en` secondary language, or English `en` without a secondary language.
- TTS targets `eleven_v3_conversational` through the official v3 Text-to-Dialogue WebSocket, one trusted voice per connection. Input is the exact approved Patient text; no automatic expressive tags, rewriting, summaries, inferred facts or agent conversation. Voice IDs are trusted presentation configuration, not clinical truth. The integrated TTS smoke must use the configured approved patient voice; this does not reopen provider quality. Future model changes require explicit documentation, never fallback.
- Server-only `ELEVENLABS_API_KEY` mints `realtime_scribe` / `tts_websocket` capability tokens. Minimum necessary speech/token permissions and account-supported credit quotas are required when a key is provisioned later. No browser key or `VITE_*` secret.
- `/v1/voice/token` retains authentication, Session/learner/institution authorization and no-store responses. The smallest response/profile schema revision is `2.0`: provider, capability, token type, single-use material, expiry and trusted model/language/profile. TTS requests choose only an authorized presentation profile ID, not arbitrary provider/model/voice configuration.
- A token expires after 15 minutes if unused and is consumed by one connection. The broker stores bounded issuance tombstones, **not replayable tokens**. Repeated/in-flight/failed issuance keys fail closed; ambiguity cannot replay credentials. Explicit reconnect uses a fresh key and fresh authorized issuance. Six attempts per principal/Session per ten minutes; 512-entry bounds; tombstones live 15 minutes. Multi-instance deployment requires shared quotas/tombstones. Issuance never changes clinical/Session state.
- Browser connection attempts also reject reused credentials. Partial (including non-committed final) STT is display-only. Only committed transcripts become editable/reviewable, with explicit microphone gesture, a 15-second cap, cancel/re-record, and no automatic submission. No raw/generated audio is persisted by the application. TTS replay is in-memory presentation; failure leaves approved text and manual workflows available.

## Privacy and consequences

Provider default retention may apply. **Zero Retention is not claimed or verified.** Current Expo/development/evaluation is synthetic educational content only, no PHI. Before sensitive healthcare data: review actual account/API retention, institutional privacy, applicable BAA/HIPAA, Zero Retention availability and data residency. Synthetic development does not imply approval for real patient records.

The original 52 synthetic definitions, hashes and semantic/safety thresholds remain unchanged as regression evidence, not provider selection or ElevenLabs quality qualification. Historical speaker/noise/quality-evaluation requirements are superseded as V2-020 closure gates, not erased from the historical record. Official speech protocols are implemented without the general agent-oriented client dependency. This clarification does not authorize live requests, deployment, voice cloning, AI-role changes or Clinical Engine changes. Privacy review before real sensitive healthcare data is a separate data-use restriction, not an extra synthetic V2-020 provider-quality gate.

## Protocol alignment — C1A

Official documentation checked 2026-09-12: the [TTD contract](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket) accepts `single_use_token` in the first message using the same authentication pattern as the TTS WebSocket; the [token contract](https://elevenlabs.io/docs/api-reference/tokens/create) defines `tts_websocket` as its speech-generation capability. Together these document the server-minted token path; mock integration tests prove our wiring, not live account acceptance.

TTS uses `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v3_conversational&output_format=mp3_44100_128`, never the standard non-v3 TTS endpoint. Setup contains one approved voice and single-use authorization; the next frame contains the unchanged approved text and `close_socket`. Playback waits for the full socket final, not just a turn-final marker; audio buffering and timeout remain bounded. STT uses `wss://api.elevenlabs.io/v1/speech-to-text/realtime`, `scribe_v2_realtime` and a `realtime_scribe` token in the `token` query parameter. `ar-JO` maps to `ar` with secondary `en`. Partial text is display-only; committed text enters editable review, never automatic clinical submission.

## Remaining V2-020 closure gates — only A–G

A. Credential/token integration works end-to-end.
B. One real integrated STT smoke: microphone → partial → committed editable transcript, without clinical execution.
C. One real integrated TTS smoke: approved Patient text → correct configured voice → playable audio; visible text remains authoritative.
D. Existing safety/integration regression gates remain green.
E. Permanent ElevenLabs key remains server-only.
F. Text/manual fallback remains available.
G. Final `npm run verify` and exact-SHA CI pass.

Provider quality is not an open gate. V2-020 remains open only until these integration/verification requirements are met; no live smoke is executed or authorized by C1A itself.

## Primary references

- [Single-use tokens](https://elevenlabs.io/docs/api-reference/tokens/create): capability-specific token creation and expiry.
- [Scribe realtime protocol](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime): microphone PCM, languages, partial/committed output.
- [v3 dialogue WebSocket](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket) and [official guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd): speech-only exact-text synthesis.
- [Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode): account/plan-dependent controls; not assumed enabled here.
