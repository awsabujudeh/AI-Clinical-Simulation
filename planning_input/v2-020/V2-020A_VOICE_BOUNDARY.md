# V2-020A — Safe Voice Foundation

Implementation checkpoint within V2-020; **V2-020 is NOT CLOSED**. No live Azure calls, credentials, resources, human recordings, or voice-quality claims belong to this checkpoint.

## Authority and integration

STT produces text only. Partials are displayed separately and can never enter a submit handler. Final text appears in a separate editable review field. “Use reviewed text” copies it to the existing Patient question or Interpreter field; the existing submit button remains a separate explicit gesture. Patient questions retain `source: STT`; the existing service owns utterance/idempotency identity and durable events. The Interpreter remains candidate-only and uses the existing confirmation/proposal path. Voice cannot call clinical execution or provide Clinical Time.

Patient text is displayed immediately. Optional Play/Replay synthesizes the exact validated learner-visible Patient turn using plain-text synthesis, not SSML. Playback is explicitly user-initiated rather than automatic, minimizing autoplay surprises. Blocked playback exposes Play again; mute closes the response's audio. Audio is memory-only, bounded to 4 MB, and revoked on mute/unmount/turn replacement. Each response has its own audio control; no audio is persisted.

The selected text models remain Patient **Terra**, Interpreter **Luna**. Azure Speech is the sole speech adapter; no provider failover exists.

## Server token boundary

`POST /v1/voice/token` reuses verified authentication, headers, origins, body-size limits, authorization and exact pinned Session loading. It requires an active authorized Session, an idempotency key, explicit `ar-JO`/`en-US`, and `STT`/`TTS`. It performs no Session synchronization, state mutation, event append, or assessment operation. Disabled/unconfigured service fails closed.

The server-only provider exchanges an injected subscription key at a fixed regional STS endpoint. It rejects redirects, bounds requests to five seconds, sanitizes failures, and never returns its key. The browser response is strict, no-store, and contains only an ephemeral token, configured region, Session/locale/capability metadata, and issuance/expiry. The eight-minute application TTL is shorter than Azure's documented ten-minute token lifetime.

The bounded in-memory broker coalesces exact concurrent retries within a refresh window. Changed locale/capability under the same active key conflicts. On expiry, the key may renew a new window. Failures remain cached in that window; a new key can retry within the per-Session quota of six attempts per ten minutes. Maximum cached entries/owners is 512. Authorization is rechecked before every replay. No token enters recovery queues, IndexedDB, logs, or browser persistence.

Azure's resource bearer token is **not cryptographically scoped to an application Session, locale, capability, or approved TTS text**. Those fields bind our adapter and issuance policy, not Azure privileges. This is the frozen browser-token topology, not a claim of provider-enforced least privilege. Production enablement must review resource quota/abuse monitoring and replace process-local issuance accounting with shared accounting for multiple backend instances. No distributed limiter or cloud configuration is implemented here.

## Browser/provider composition

The official `microsoft-cognitiveservices-speech-sdk` is pinned to **1.51.0** in the web workspace and lockfile. `createAzureStudentVoiceServices` takes an authenticated token source and explicit presentation-level patient voice profile. No default patient gender/voice is inferred. Both Taim and Sana are supported for `ar-JO`; explicit English choices are Jenny/Guy. This presentation configuration does not amend reviewed Case content or any clinical hash.

The UI's existing selected Patient locale drives recognition; automatic detection is absent. Changing it disposes the old capture and discards stale callbacks. The token endpoint validates the supported requested language; it does not change persisted Session metadata. The current application already passes selected locale to question/Interpreter submissions.

Tap-to-start/tap-to-stop is chosen for accessible keyboard/touch use and explicit stopping. States: IDLE, REQUESTING_PERMISSION, LISTENING, PROCESSING_FINAL, READY_TO_REVIEW, ERROR. Capture is limited to 15 seconds; final settlement to five seconds. Permission/token setup is separately bounded. Cancellation, offline events and unmount close the SDK and microphone tracks. SDK telemetry is disabled. Bounded `ECG`, `troponin`, `aspirin` phrase hints assist recognition only.

Text/manual paths remain independent of voice failures. Existing offline recovery and AI-unavailable handling are reused, not reimplemented. No clinical event exists until explicit text submission through the existing service.

## Telemetry

Only the strict VoiceTelemetry allowlist may be emitted: ephemeral utterance ID, locale, capability, duration, permission outcome, token/partial/final/first-audio timing, completion/failure code, and edit flag. No transcript, raw audio, provider error detail, credentials, hidden context or billing payload is included. Timing is presentation-only. TTS text-to-first-audio timing includes any deliberate user wait before pressing Play; live evaluation must record that condition rather than present it as provider-only latency.

## References

- [Microsoft SpeechRecognizer API](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognizer)
- [Microsoft Speech token exchange](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Official browser SDK source and examples](https://github.com/microsoft/cognitive-services-speech-sdk-js)

Frozen Logical/Physical Architecture and all accepted ADRs remain unchanged. No new ADR is required for this implementation checkpoint.
