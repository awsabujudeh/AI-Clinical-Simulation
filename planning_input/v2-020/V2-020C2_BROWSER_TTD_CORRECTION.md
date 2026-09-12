# V2-020C2 — Browser TTD integration correction

Baseline: `c76deb3ede79cfc9e988164f18eba24e189aacde`, `v2-development`.
Implementation and mocked verification only; no live provider call.
ElevenLabs remains the sole approved Voice provider. No ADR/policy/Voice ID change.

**Historical C2/C2A correction record:** the product owner has since confirmed
exactly one corrected browser TTS smoke PASS. Its final evidence and closure
requirements are in [V2-020_FINAL_CLOSURE_REPORT.md](V2-020_FINAL_CLOSURE_REPORT.md).
Past unknown/pending statements below describe their original review stage, not
an additional live test requirement. C2A's authorized provider-ADR amendment is
documented separately below.

## Historical C2 evidence and diagnosis — root-cause uncertainty superseded by C2A

Product-owner live evidence, preserved without rerunning:

- Product STT PASS: committed editable Arabic transcript, safe error NONE, no
  clinical submission; listening callback → first partial about 2455.4 ms;
  explicit Stop → final settlement 347.5 ms. One integration sample only.
- Historical `tts_websocket` token mint PASS (subsequently proven wrong for TTD);
  direct HTTP Text-to-Dialogue with the same
  approved configured voice and `eleven_v3_conversational` played successfully.
  Human quality EXCELLENT / APPROVED; no quality reevaluation is requested.
- Browser TTD failed with `TTS_UNAVAILABLE`. The owner confirms no additional
  numeric close code/provider code was exposed or retained.

The confirmed diagnostic defect was loss of all non-timeout adapter errors in
`TTS_FAILED`, then the smoke UI's generic `TTS_UNAVAILABLE`. The prior client also
combined `inputs` and `close_socket` in one frame instead of the separately sent
control frame required by this correction and shown in the official guide.
**At the C2 review, the exact live cause was unknown from the generic error.**
Documentation did not prove combined frames caused rejection. This uncertainty
is now superseded by the C2A live token-type evidence below; the historical C2
findings are retained rather than retroactively presented as a confirmed cause.

## C2A confirmed root cause and active token contract

The product owner subsequently supplied TTD close `1008`, provider code
`invalid_token_type`, and the message:

> Token type mismatch: expected 'ttd_websocket', got 'tts_websocket'.

The trusted server minted the **wrong capability token**, not a wrong voice/model.
Current mapping is STT → `realtime_scribe`; TTS/Text-to-Dialogue → `ttd_websocket`.
TTS minting is `POST https://api.elevenlabs.io/v1/single-use-token/ttd_websocket`.
The strict response contract requires that type; the provider rejects the ordinary
`tts_websocket` type, and client requests cannot supply either raw token type.
C1/C1A's token-compatibility assumption is explicitly superseded in the accepted
provider ADR and migration record. Historical Azure evidence is untouched.

C2A changes no C2 browser URL, first/input/close frame, model, configured Voice ID,
STT function, text fallback, buffering, or retry behavior. `invalid_token_type` is
allowlisted as `TTS_PROVIDER_ERROR` with the safe numeric close code; raw messages
and credential-bearing frames are still never displayed. This correction uses
mocks only and does not claim the corrected live browser smoke has passed.

## Exact wire comparison

Unchanged URL (no credential in the TTD URL):

```text
wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v3_conversational&output_format=mp3_44100_128
```

Unchanged first frame (placeholders only):

```json
{"voices":["<trustedVoiceId>"],"single_use_token":"<server-minted-single-use-token>"}
```

Previous second frame:

```json
{"inputs":[{"text":"<exact approved text>","voice_id":"<trustedVoiceId>"}],"close_socket":true}
```

Corrected second and third frames, in order, on the same connection:

```json
{"inputs":[{"text":"<exact approved text>","voice_id":"<trustedVoiceId>"}]}
{"close_socket":true}
```

No acknowledgment message is invented. WebSocket send ordering preserves setup
before input before close. Exact text, including whitespace, is not transformed.
One configured voice only; no expressive tags or clinical context. The public
[TTD API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket)
documents first-message `single_use_token` authentication. The official
[streaming guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd)
shows separate input/control sends and full `is_final` after flushing.

## Token and lifecycle safety

Each explicit attempt calls the token source once, using one fresh issuance key
and, for the active TTD connection, a new `ttd_websocket` token.
A valid fresh, correctly bound token opens at most one socket; invalid tokens open
none. The existing bounded digest set rejects reuse, including a failed connection's
token. No probe, reconnect, background mint, or automatic retry exists. A React
synchronous ref guard now rejects same-render double clicks; StrictMode mounting
alone requests nothing. Retry obtains a new token. Local replay requests nothing.

Server chunks are decoded from base64 in received order, capped at 4,000,000 decoded
bytes with a 6,000,000-character per-frame bound. A turn-final marker does not
release audio. Nonempty audio plus full `is_final: true` is required; early close,
malformed input, invalid base64, oversized or partial output cannot become success.
`mp3_44100_128` maps to an `audio/mpeg` Blob. URL revocation is idempotent, including
construction failure; replay rewinds locally; mute/unmount discard audio and ignore
late callbacks. Autoplay rejection retains a manually replayable handle and text.
Media decode errors are distinct from playback permission errors. No audio is saved.

## Sanitized diagnostics

The adapter emits a closed `TtsDiagnostic`; the smoke page displays only its code
and sanitized optional numeric close/provider code:

- `TTS_TOKEN_UNAVAILABLE`: acquisition, schema, expiry, binding or reuse rejection.
- `TTS_WEBSOCKET_CONNECT_FAILED`: socket creation/transport or opaque handshake failure.
- `TTS_WEBSOCKET_AUTH_FAILED`: explicit allowlisted authentication provider code only.
- `TTS_PROTOCOL_ERROR`: malformed frames, send failure, size bound, empty final or premature close.
- `TTS_PROVIDER_ERROR`: provider rejection/server close, including allowlisted `invalid_token_type`; unknown provider codes become `OTHER`.
- `TTS_AUDIO_DECODE_FAILED`: invalid base64 or media decoder/unsupported-source error.
- `TTS_TIMEOUT`: existing ten-second connection/generation deadline.
- `TTS_PLAYBACK_FAILED`: media construction or rejected playback; manual replay remains possible.

Numeric close codes are retained only in 1000–4999. Provider codes are a closed
allowlist or HTTP-like numeric 400–599; arbitrary strings are never displayed.
No raw error message, close reason, token, credential-bearing URL or cause is retained
in diagnostics. An error frame is followed by at most 250 ms of diagnostic grace
to receive the peer close code; buffered audio is already discarded, further data
cannot succeed, and the ten-second overall deadline still applies. This is not a
retry. Code 1006 is opaque, and 1008 is a generic policy failure, not proof of auth
failure. Abort is suppressed by the requesting UI and releases resources.

## Verification scope

Permanent browser tests cover the three-frame contract, one-token/one-attempt and
fresh retry, broker/provider composition, StrictMode/double-click behavior, ordered
chunks/full final, error/close mapping, timeout/grace, malformed/oversized/partial
output, base64/media failures, autoplay recovery, replay/mute and late callbacks.
Existing STT implementation and regressions remain intact. The DEV isolation audit
permits only the added closed diagnostic helper and checks that it has no imports,
network, persistence, raw close reason or logging behavior. Existing credential,
provider/bundle, host, API/token and Voice safety checks remain enabled.

Run focused typecheck, Voice browser, mock host and safety/bundle audits; then one
full `npm run verify` on the stable implementation. Exact final results are reported
with the review checkpoint, not asserted as live provider success here.

C2A additionally tests the real mocked provider → broker → browser composition:
v3 TTD must mint `ttd_websocket`, never the ordinary TTS kind. STT retains its exact
mint URL. Provider raw-type rejection, API override rejection for both capabilities,
stale response rejection before socket creation, and the `invalid_token_type` UI
diagnostic are permanent regressions. The Browser/Deno token snapshot changes only
the TTS tuple's token type from `tts_websocket` to `ttd_websocket`; model, voice,
locale, expiry, corpus/policy hashes and clinical hashes are unchanged. This is a
correction of the version-2.0 token literal, not acceptance of both token scopes.

## Historical one-browser-TTS retest procedure — now completed by the product owner

1. After review/authorization, use the trusted PowerShell environment with the
   **same already approved credential and Voice ID configuration**. Do not change
   model/profile, print secrets or copy network frames. Stop an old diagnostic
   launcher with Ctrl+C before restarting the updated one.
2. In `C:\Projects\AI-Clinical-Simulation\v2`, set only the existing live guard
   `$env:V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE = '1'` and run
   `npm run dev:v2-020:voice-smoke`. Credential setup, if needed locally, remains the
   existing masked-input convention in the migration document; never paste into chat.
3. Open `http://127.0.0.1:4182/__dev/voice-smoke`. Select the unchanged approved
   trusted profile. Do not record STT or edit the fixed reference.
4. Click **Generate TTS exactly once**. This authorizes one fresh token and one TTD
   connection for the fixed synthetic text. If autoplay is blocked, click
   **Play / replay** (local existing audio only; no new generation).
5. Report token outcome, TTS outcome, safe diagnostic/close/provider code if shown,
   first-audio latency, playable completion and unchanged authoritative visible text.
   Do not report credentials, raw frames or provider messages. If generation fails,
   STOP without clicking Generate again; review the sanitized diagnostic first.
6. Mute/discard, close the page and Ctrl+C the launcher. No clinical submission,
   execution or new provider-quality evaluation follows.

The one corrected browser TTS integration smoke is now **PASS** by product-owner
confirmation. Overall closure requires final verification and checkpoint/CI, as
recorded in the final closure report. Patient Terra, Interpreter Luna, STEMI review-only status,
V1 and frozen Architecture remain unchanged. Only ADR-VOICE-PROVIDER-001 is amended
for the authorized C2A token semantics; all other ADRs remain unchanged. No deployment/V2-021.
