> HISTORICAL / SUPERSEDED PROVIDER RECORD: Azure-specific runtime, credential and command instructions below are not active. ADR-VOICE-PROVIDER-001 supersedes the provider choice. Use V2-020_ELEVENLABS_PROVIDER_MIGRATION.md for current instructions. This banner does not retroactively change the historical test evidence or reviewed semantic thresholds.
>
> C1A CLOSURE SUPERSESSION: Provider selection is CLOSED; ElevenLabs Jordanian/Arabic STT and TTS quality is APPROVED by the product owner. The unchanged 52 fixtures/hashes are SAFETY / INTEGRATION REGRESSION CORPUS, not a required live quality retest. Historical quality, multi-speaker and multi-voice gates below are not current closure requirements. Only the A–G integration/verification checklist in ADR-VOICE-PROVIDER-001 and V2-020_ELEVENLABS_PROVIDER_MIGRATION.md is active.

# V2-020B2A — Local STT smoke harness

Baseline: `2dce8fd581659a0cf1499f9854c64f60c0ed8503`, `v2-development`.
Preparation only. No live Azure request, credential inspection, microphone use,
TTS execution or 52-utterance evaluation is authorized by this implementation task.
V2-020 remains **NOT CLOSED**.

## Isolated composition

One launcher owns a diagnostic Node token host (`127.0.0.1:4183`) and Vite child
(`127.0.0.1:4182`, strict port, `voice-smoke` development mode). Ctrl+C terminates
both owned servers; Vite failure also closes the token host. Port collisions fail
closed. Neither listener uses `0.0.0.0`.

The only token operation is JSON `POST /__diagnostic/voice-smoke/token`, with
exact Host `127.0.0.1:4183` and Origin `http://127.0.0.1:4182`. Its narrow OPTIONS
preflight allows only POST and Content-Type; it cannot issue a token. No wildcard
CORS, file serving, proxy, environment/debug route or production API bypass exists.
The binding is fixed to `session.voice-smoke`, `ar-JO`, `STT`; this is a diagnostic
identifier, not authorization to a real clinical Session. Other bindings fail.
Loopback/Origin restriction is not authentication against hostile local processes;
run only on a trusted workstation and close the launcher after the smoke.

Host startup requires `V2_ALLOW_LIVE_AZURE_VOICE_SMOKE=1`, then uses existing
`readAzureSpeechRuntimeConfig`, `createAzureSpeechTokenProvider` and
`createMemorySpeechTokenBroker`. Configuration comes only from its trusted process:
`AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. No dotenv/secret file loader, command-line
secret, credential logging or provider-body logging. The Vite child receives an OS
environment allowlist, not provider credentials, and does not load `.env` files.

The regional exchange is the existing HTTPS STS flow. Browser transport receives
only the strict short-lived token response, never the subscription key. Existing
eight-minute application TTL, 30-second adapter freshness minimum, bounded broker
quota/cache and expiry refresh semantics remain unchanged. No background refresh
is added. A near-expiry cached token can fail the existing browser freshness gate;
wait for application expiry before retrying rather than bypassing validation.

## Browser boundary

`http://127.0.0.1:4182/__dev/voice-smoke` loads only with DEV + dedicated mode + exact
origin/path. Production build removes its dynamic import/route; the permanent audit
checks built artifacts (including maps if present). This is not a Student UI route.

The page uses `createAzureSpeechAdapter` (SDK **1.51.0**) and the existing
`createCaptureController`. No alternative recognition implementation exists.
Only explicit **Start recording** requests a token/microphone. Recording ends at
the existing 15-second maximum; final settlement retains the existing five-second
bound. **Stop recording** stops explicitly; **Cancel / clear** closes capture.
Unmount closes owned resources. No raw audio is saved. SDK audio/content telemetry
remains disabled; audio streaming occurs only through the existing Speech adapter
when separately authorized. The page keeps display text and safe metrics in memory.

Partial is display-only. Final text becomes editable after settlement; there is no
submit/playback function, form, Patient/Interpreter service or clinical execution
path. Reference text is displayed only, never included in token payloads or sent as
recognition input:

> الألم بلش معي من حوالي ساعة وبحس إنه ضاغط على صدري

Manual meaning review: pain, approximately one hour, pressure/tightness, chest.
Spelling/WER alone is insufficient. The current adapter's existing ar-JO phrase
hints are unchanged.

Latency labels are **SDK listening callback → first partial** and **explicit Stop →
final settlement**. Metrics become available at controller settlement. They are not
physical microphone-start or automatic end-of-speech measurements. If the automatic
15-second cap ends capture, explicit-Stop latency is marked not measured.
Permission display reflects SDK listening confirmation or a safe failure, not a
separate permissions API probe. SDK outcome displays the existing capture phase.

## Future live launch — not executed during preparation

Use one trusted PowerShell terminal. After separate explicit live authorization,
inject the key locally with a masked prompt, never paste it into chat or a command
argument. Do not save it in a file. Example for that future authorized session only:

```powershell
Set-Location C:\Projects\AI-Clinical-Simulation\v2
$speechSecret = Read-Host 'Azure Speech key (local masked input)' -AsSecureString
$speechPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($speechSecret)
try { $env:AZURE_SPEECH_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($speechPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($speechPointer); $speechSecret.Dispose() }
$env:AZURE_SPEECH_REGION = 'uaenorth'
$env:V2_ALLOW_LIVE_AZURE_VOICE_SMOKE = '1'
try { npm run dev:v2-020:voice-smoke }
finally {
  Remove-Item Env:AZURE_SPEECH_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:V2_ALLOW_LIVE_AZURE_VOICE_SMOKE -ErrorAction SilentlyContinue
}
```

Open the URL above, click Start once, grant microphone permission, speak the
reference naturally, click Stop, then inspect/edit the final text locally. Do not
retry automatically. Report: token outcome, permission, SDK phase, safe error,
partial/final presence, final recognized text (synthetic reference only), required
edits, preservation of the four concepts, both accurately labeled latencies, and
whether explicit Stop or the limit ended capture. Never report a bearer token/key
or copy network response bodies. Close the page and Ctrl+C after the smoke.
Changing the trusted credential/region requires restarting the launcher.

Required separate authorization wording:

> I authorize exactly one live ar-JO STT smoke using my microphone and the synthetic
> reference utterance through Azure Speech in uaenorth, including the necessary
> regional token exchange. I understand the audio is transmitted to Azure for
> recognition. No real patient data/PHI, TTS, transcript submission to AI or clinical
> actions, automatic retries, or 52-utterance evaluation is authorized. Keep the key
> secret and stop after reporting this one smoke.

## Permanent verification

`npm run test:v2-020b2a:host` uses synthetic configuration and mocked provider
responses, including real loopback HTTP rejection tests and a browser DEV-route
load without a token host, microphone or external traffic. It also verifies the
actual launcher refuses in an empty environment. `npm run test:v2-020a:browser`
covers the new page with injected adapter/clock alongside prior Voice regressions.
`npm run build` followed by `npm run test:v2-020b2a:audit` proves production exclusion,
closed imports, transcript isolation and credential-signature absence.
The existing voice safety audit and portability guard remain required.
These gates are incorporated into `npm run verify`; none starts the live launcher
with credentials. Final counts and exit status are reported in the checkpoint reply.

An existing mock token fixture was corrected to capture one issued timestamp before
deriving its exact eight-minute expiry. Two separate clock reads could previously
make that test token exceed the strict TTL by a millisecond. No assertion weakened.

## Prior TTS evidence — user-reported, not rerun

| Observation | Status |
| --- | --- |
| Azure regional token exchange | TECHNICAL PASS |
| Azure direct-key TTS | TECHNICAL PASS |
| Sana preliminary human naturalness | FAIL |
| Taim preliminary human naturalness | FAIL |

Product-owner observations: broken Arabic, robotic, clearly synthetic, not
acceptable for an immersive Patient experience. Classification:
**PRELIMINARY HUMAN NATURALNESS FAILURE**. This is not a completed provider gate.
No TTS tuning, provider-policy change or ADR follows from this checkpoint.

Patient remains Terra; Interpreter remains Luna. Voice is non-authoritative.
V1, STEMI UNDER_REVIEW/REVIEW_ONLY, frozen Architecture and accepted ADRs are outside
the change scope. Live Jordanian STT evaluation and the final Voice provider
decision remain pending. No commit, push, deployment or V2-021.
