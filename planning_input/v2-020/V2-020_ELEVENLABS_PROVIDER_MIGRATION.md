# V2-020C1/C1A — ElevenLabs provider migration and protocol alignment

Status: **live STT and corrected browser TTS integration PASS**, reported by the product owner. Final closure is governed by [V2-020_FINAL_CLOSURE_REPORT.md](V2-020_FINAL_CLOSURE_REPORT.md) and the final checkpoint/exact-SHA CI. Historical C1 baseline: `2dce8fd581659a0cf1499f9854c64f60c0ed8503`, branch `v2-development`; C1 itself made no live calls. Authority: [ADR-VOICE-PROVIDER-001](../adr/ADR-VOICE-PROVIDER-001.md). Frozen Architecture and other ADRs are unchanged.

Provider selection: CLOSED.
ElevenLabs provider quality: APPROVED.
Corpus role: SAFETY / INTEGRATION REGRESSION CORPUS.
Full 52-live provider-quality retest required: NO.

## Evidence and B2A recovery inventory

The product owner has approved Jordanian/Arabic STT and TTS through direct hands-on ElevenLabs use. This final provider decision is not a fabricated API benchmark. No Azure comparison or provider-quality qualification remains. C1A validates documented protocol and mocked integration only; the outstanding live checks are the two integrated smokes below, not a provider evaluation.

Initial B2A scope was exactly **7 created + 4 modified**, no staged/unrelated work:

| Initial path | Kind | Classification / treatment |
|---|---|---|
| `v2/apps/web/src/main.tsx` | modified | A: retain guarded DEV route |
| `v2/apps/web/vite.config.mjs` | modified | A: retain smoke env isolation |
| `v2/package.json` | modified | A/B: retain task wiring, replace launcher provider |
| `v2/tests/browser/voice/azure-adapter.browser.test.ts` | modified | B: replaced by new provider wire tests; old time-fixture fix no longer applies |
| `planning_input/v2-020/V2-020B2A_LOCAL_STT_SMOKE_HARNESS.md` | created | A/B: retain historical evidence with explicit supersession banner |
| `v2/apps/web/src/features/voice/VoiceSmoke.tsx` | created | A/B: retain controller/editing/latency, replace provider and add isolated exact-text TTS |
| `v2/runtime/voice-smoke-host.mjs` | created | A/B: retain localhost safety; replace token/config semantics |
| `v2/scripts/v2-020b2a-smoke-audit.mjs` | created | A/B: retain isolation assertions, add speech-only TTS checks |
| `v2/scripts/v2-020b2a-smoke-test.mjs` | created | A/B: retain HTTP/DEV tests; replace provider expectations |
| `v2/scripts/v2-020b2a-voice-smoke.mjs` | created | B: replaced by `v2-020c1-voice-smoke.mjs`, same secret-isolated launcher boundary |
| `v2/tests/browser/voice/voice-smoke.browser.test.tsx` | created | A/B: retain neutral controls, test new token/TTS boundaries |

No C/unrelated content was found. No reset/clean/discard was used. Removed tracked Azure adapter, token provider, Node/Deno runtime wrappers and obsolete provider test remain recoverable from Git. The Microsoft Speech SDK and 18 installed dependency packages were removed. Historical reports have a supersession banner; their old commands are not current instructions.

## Active architecture and dependencies

Server `runtime-config.ts` reads only `ELEVENLABS_API_KEY` on explicit composition. Node/Deno wrappers inject environment/fetch/time; imports perform no I/O. Missing key disables Voice only. `/v1/voice/token` still authorizes the learner and Session before issuance. POST `https://api.elevenlabs.io/v1/single-use-token/{realtime_scribe|ttd_websocket}`, server `xi-api-key`, fixed URL, redirect rejection, five-second timeout, no automatic retry, sanitized failure. STT maps to `realtime_scribe`; TTS/Text-to-Dialogue maps to `ttd_websocket`. Clients cannot override this mapping.

Response/profile version 2.0 carries trusted speech settings, not account metadata. Single-use/ambiguity/reconnect quotas are defined in the ADR. Browser fetch allocates a new issuance key per explicit attempt. No consumed token cache/replay; no token telemetry or recovery persistence. Server profile list defaults empty and rejects unknown TTS profiles; there is no arbitrary voice/model passthrough.

Browser `elevenlabs-speech-adapter.ts` uses the current official speech-only WebSocket protocols:

- STT `wss://api.elevenlabs.io/v1/speech-to-text/realtime`, `scribe_v2_realtime`, manual commit, `pcm_16000`, Arabic `ar` plus repeated `secondary_languages=en`; English `en` without secondary languages. Product locale stays unchanged. PCM AudioWorklet chunks are 100ms, mono 16kHz/16-bit; stream ends/flushes on explicit Stop or 15-second cap. Partial and `final_transcript` are not authoritative committed text. `committed_transcript` after Stop settles reviewable text. No automatic reconnect/submission.
- TTS `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input`, explicit `model_id=eleven_v3_conversational`, `output_format=mp3_44100_128`; never the standard `/text-to-speech/{voice_id}/stream-input` route. The first frame registers exactly one trusted voice and the server-minted `ttd_websocket` credential as `single_use_token`. The next frame contains only `inputs` with **exact approved text** and that voice ID; a separate `{close_socket: true}` control frame follows. No automatic expressive tags or text transformations. Audio is bounded to 4MB and held until the full `is_final` message, not `is_final_audio_for_turn`; ten-second timeout. First-audio measures receipt, not audible playback. The integrated TTS smoke checks playable completion, not a new quality competition. Replay uses the local audio handle; mute/disposal revoke the URL.

**Superseded C1/C1A assumption:** shared first-message authentication syntax was incorrectly taken to imply that `tts_websocket` was TTD-compatible. Subsequent product-owner live evidence is decisive: TTD close `1008`, provider code `invalid_token_type`, expected `ttd_websocket`, received `tts_websocket`. C2A corrects the trusted mint path, response contract and tests to `ttd_websocket`; the ordinary TTS token is explicitly rejected. Mock provider → broker → browser tests assert that exact mint path and the unchanged v3 TTD frames. The owner has now confirmed exactly one corrected browser TTS smoke PASS. See ADR-VOICE-PROVIDER-001's C2A clarification.

No ElevenLabs SDK was installed. Inspected official package metadata: `@elevenlabs/client` 1.25.0 exposes the full client/internal/worklets, not a clean speech-only export, and depends on LiveKit; `@elevenlabs/react` 1.15.2 depends on that client. To obey the explicit no-ElevenAgents dependency constraint, use small maintained-in-repo adapters against official speech protocols. This is a deliberate dependency tradeoff, not a provider/model substitution. No agent endpoint, LLM, tools or framework is used. Lockfile removes the retired SDK; all remaining dependency versions stay pinned.

Provider-neutral capture, review/cancel/re-record, manual Patient/Clinical Action controls, grounded approved Patient TTS, mute/replay/text fallback and payload-free telemetry remain intact. Patient → Terra; Interpreter → Luna; no clinical time/state/assessment/action behavior changed. Voice profiles are versioned presentation data with provider/model and per-locale voice IDs, not Case content or inferred patient demographics.

## Regression corpus and privacy

52 definitions remain exactly 50 ar-JO + 2 en-US. Corpus canonical SHA-256 remains `3425bf5fc5fd9ab264263e7c215d8e72f4c3bb9ab9e099386bda4d86d9371f42`. Old policy hash `38e86b2cfd199c4fdf35e244bd6cfc0e1dd576266ea67d795c4bd66bd84374a7`; new `e5fbc6f3849509f24060c22da4a639e24e1b420e6d349a27b088ab805333b3de`. **Only policy.provider changes**. The permanent audit reconstructs the prior policy and checks its original hash, proving no threshold change. Original snapshot moved without content changes to `history/v2-020a.freeze.json`; active `v2/evaluation/voice/v2-020c1.freeze.json` is pre-live, not claimed evidence.

The preserved corpus and offline evaluator are safety/integration regression evidence: colloquial/MSA mix, code-switching, dose/number/unit preservation, negation/hypotheticals, transcript review and Patient/Interpreter separation. Existing definitions, thresholds, speaker/noise metadata and latency fields remain unchanged for reproducibility; their historical live-evaluation requirements are not current closure gates. No full 52-live trial, three-speaker trial, multi-voice quality comparison or new quality qualification is required. The existing optional TTS review schema/harness may record presentation observations, but cannot reopen provider selection or make quality approval conditional. No recordings/results were fabricated.

Provider retention may occur by default. **Zero Retention is not claimed.** No raw/generated audio is persisted by this application; that does not imply provider non-retention. Synthetic educational use only. Before real sensitive healthcare data require actual account retention, institutional privacy, applicable BAA/HIPAA, Zero Retention availability and residency review. This separate restriction is not an extra synthetic V2-020 provider-quality gate. No production region, remote resource or deployment is configured.

## Local credential and integration-smoke procedure — retained for reference

The required live integration samples are now complete. The procedure below was
not executed by C1/C1A and is not a request for another closure smoke. Any future
live use requires its own authorization; automated verification/CI never runs it.

No `.env` is required. Provision a minimum-necessary speech/token-scoped key with account-supported credit quota later. Never paste it into chat, source or shell command history. From PowerShell in `C:\Projects\AI-Clinical-Simulation\v2`, enter it using a hidden prompt in the local parent process:

```powershell
$voiceCredential = Read-Host 'ElevenLabs API key (hidden)' -AsSecureString
$voicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($voiceCredential)
try { $env:ELEVENLABS_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($voicePointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($voicePointer); $voiceCredential.Dispose() }
$env:V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE = '1'
$env:ELEVENLABS_SMOKE_VOICE_IDS = '<APPROVED_VOICE_ID_1>,<APPROVED_VOICE_ID_2>'
npm run dev:v2-020:voice-smoke
```

The credential syntax conceptually is `ELEVENLABS_API_KEY=<ELEVENLABS_KEY>`; the hidden prompt avoids printing the value. Voice IDs are non-secret presentation configuration; replace placeholders with product-owner-approved actual IDs, never invented defaults. Leave IDs unset for STT-only preparation. No credentials were read/set here.

Open `http://127.0.0.1:4182/__dev/voice-smoke`. **STT:** explicit Start recording → partial display → Stop/15-second cap → committed editable text; no submission. **TTS:** choose trusted profile → Generate TTS sends only the fixed synthetic reference, never the edited transcript → Play/replay/Mute. The page fetches safe profiles locally on load, which makes no provider request. Fresh generation/recording obtains one new bounded capability token. After provider failure, no automatic retries. Ctrl+C stops both owned localhost servers; remove the three process variables afterward. Restart the launcher after changing credentials/profile settings. Child Vite receives only an OS allowlist, no secret/live guard, and smoke mode disables `.env` loading. Production excludes both route and diagnostic host.

## Verification and closure criteria

Use `npm run build`, `npm run test:v2-020c1`, and final `npm run verify`. All tests inject synthetic token/fetch/socket/microphone/audio dependencies; no live Speech requests. Existing A/B command names remain compatibility aliases for active-provider tests. Static audits enforce no clinical execution/audio persistence, safe server-only key, exact TTS text, trusted locale, bounded capture, DEV-only route and speech-only dependencies. Existing generic security denylist references to provider SDK names are prohibitions, not active dependencies.

The V2-020 closure criteria are ONLY:

A. Credential/token integration works end-to-end.
B. One real integrated STT smoke: microphone → partial → committed editable transcript, without clinical execution.
C. One real integrated TTS smoke: approved Patient text → correct configured voice → playable audio; visible text remains authoritative.
D. Existing safety/integration regression gates remain green.
E. Permanent ElevenLabs key remains server-only.
F. Text/manual fallback remains available.
G. Final `npm run verify` and exact-SHA CI pass.

Both required live smokes have subsequently passed, as attributed in the final closure report. Provider selection and quality are closed/approved. Overall V2-020 is CLOSED only after final verification, commit, normal push and exact-SHA CI PASS; no further live quality/integration sample is required by this closure pass.

Primary protocol, package and privacy evidence is linked in the ADR, plus [official package source](https://github.com/elevenlabs/packages/tree/main/packages/client) and [speech versus dialogue WebSocket guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets).

## C2 integration correction

The product owner subsequently reported integrated STT PASS, TTS token issuance
PASS and direct HTTP TTD playable audio EXCELLENT / APPROVED with the same voice
and model. Browser TTD exposed only `TTS_UNAVAILABLE`, with no saved numeric close
or provider code. C2 separates input/control frames and adds safe browser failure
diagnostics without changing provider, voice, model or topology. See
[C2 correction and one-smoke retest](V2-020C2_BROWSER_TTD_CORRECTION.md).
The then-required corrected browser TTS integration smoke has now passed. Only
final closure verification/checkpoint/CI remain; no provider-quality reevaluation
is required.

C2A resolves the previously missing root-cause evidence: the subsequent live
`invalid_token_type` / `1008` response identifies a token-scope mismatch, not a
voice/model/quality failure. Active TTD tokens are now `ttd_websocket`. All C2
framing, bounded playback and sanitized diagnostics remain intact; the specific
provider code is now allowlisted as `TTS_PROVIDER_ERROR`. No live call was made
during this implementation correction.
