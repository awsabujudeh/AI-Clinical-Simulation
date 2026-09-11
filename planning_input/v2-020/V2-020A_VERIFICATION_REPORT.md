# V2-020A verification checkpoint

## Required checkpoint report

1. **V2-020A VOICE CORE — REVIEW READY**. This is an implementation checkpoint, not final provider acceptance.
2. Baseline and current branch: `v2-development`; unchanged HEAD: `7e3a33fc75bf098540f6627fe1643dfb01ef531e`. Initial tree was clean. No staged files or conflicts at handoff.
3. Created files: 30, listed exactly below.
4. Modified existing files: 13, listed exactly below.
5. Architecture changes: NO. Provider infrastructure and presentation contracts implement the existing boundary; no Case Schema amendment.
6. ADR changes: NO, including ADR-AI-MODEL-001.
7. Official browser Speech SDK: `microsoft-cognitiveservices-speech-sdk` exactly `1.51.0`, locked in the web workspace. No CDN or portable-engine SDK dependency.
8. Token broker: authenticated `POST /v1/voice/token`, existing authorized/pinned Session load, strict locale/capability input, required idempotency identity, bounded refresh cache and issuance quota. Server provider uses fixed regional STS, injected secret/fetch, redirect rejection and timeout.
9. Token security: PASS for implemented/mock boundary. Eight-minute application TTL, no-store response, sanitized errors, no key returned, no browser persistence. Azure's bearer token itself is resource-wide, not cryptographically Session/text/capability scoped; see limitations below.
10. Locales: exactly `ar-JO` and `en-US`; manual existing Patient locale selection, no auto-detection. Arabic medical-English phrase hints are bounded to ECG/troponin/aspirin.
11. Tap-to-start/tap-to-stop phases: IDLE, REQUESTING_PERMISSION, LISTENING, PROCESSING_FINAL, READY_TO_REVIEW, ERROR. No always-listening behavior.
12. Recording limit: 15 seconds; final settlement bounded to five seconds. Setup separately bounded. Cancellation closes microphone/provider resources and rejects stale callbacks.
13. Partial transcript: display-only, never reviewable/submittable as final intent.
14. Final transcript: editable review, cancel/re-record, explicit transfer to the existing text field, then separate explicit submit. Timeout never auto-submits.
15. Patient integration: existing `submitQuestion`, with existing `STT` source metadata, durable question/replay semantics and grounded response authority unchanged.
16. Clinical integration: existing Interpreter candidate path, reconciliation and confirmation/manual proposal boundary. Provider outage leaves manual/text alternatives intact.
17. Direct clinical execution from voice absent: YES. Voice has no action-execution, Patient State, Clinical Time or Assessment authority.
18. TTS: parses a safe learner-visible Patient turn and synthesizes its exact `patient_utterance` with plain-text synthesis. No rewriting or SSML content generation.
19. Profiles: explicit presentation mapping supports ar-JO-TaimNeural/ar-JO-SanaNeural; English Jenny/Guy choices are explicit. No gender inference or reviewed Case hash change.
20. Mute/replay: implemented per response with memory-only audio and disposal.
21. Autoplay/playback restriction: explicit Play by default; rejected playback exposes Play again and preserves text.
22. No audio storage: no MediaRecorder/storage/recovery persistence; microphone tracks stopped, memory Blob URLs revoked, synthesized buffer bounded to 4 MB. Static audit verifies these code boundaries.
23. Text fallback: mock UI/E2E tests cover disabled voice, permission/token/provider errors and explicit text submission; existing offline/read-only and AI-unavailable rules are preserved rather than bypassed.
24. Safe telemetry: strict utterance/locale/capability, permission, recording/token/partial/final/TTS timings, completion/failure category and edit flag. No transcript/audio/credential/hidden context payload. Presentation clocks do not drive clinical time.
25. Corpus: 52 synthetic text definitions, 50 ar-JO and two en-US controls; zero recordings/results.
26. Categories: colloquial/standard Arabic, Patient symptoms/questions, code-switching, investigations, medication/action language, negation, numbers/doses/units, yes/no, fast/incomplete/hypothetical/past/compound phrases and noise challenges. Doses are transcription targets, not treatment advice.
27. Scoring: named human semantic adjudication against reference meaning; WER optional/secondary, no sole LLM or exact-word grader. Strict consent/provenance/reviewer/evidence fields; malformed/duplicate/missing evidence fails closed.
28. Thresholds frozen before live evidence: >=90% usable finals; 100% consequential meaning preserved or observed detected/corrected with confirmation. Policy SHA-256 `38e86b2cfd199c4fdf35e244bd6cfc0e1dd576266ea67d795c4bd66bd84374a7`; corpus SHA-256 `3425bf5fc5fd9ab264263e7c215d8e72f4c3bb9ab9e099386bda4d86d9371f42`. Audit recomputes both.
29. Live Azure calls executed: NO. No live OpenAI calls either.
30. Real human voice results: NOT YET. Planned 3–5 consenting Jordanian speakers, 50+ utterances and noisy conditions; complete current harness requires all 52 definitions.
31. TTS human results: NOT YET. Structured Taim/Sana review fields cover intelligibility, Jordanian acceptability, medical-English pronunciation, pacing, emotion and failures.
32. Voice API Browser tests: 9 PASS, using mocked provider only.
33. Voice Browser tests: 41 PASS across five files (16 core, 9 API, 3 real-adapter boundary/no-network, 12 UI, 1 portability). Full Browser suite PASS; final Vitest result cache records 83 files, zero failed files.
34. Deno: 34/34 full-suite PASS, including one voice test. Browser/Deno assert the same exact canonical voice/evaluation string, not merely object equality.
35. Playwright: existing workspace 11/11, new voice 3/3, Patient 5/5, Interpreter 6/6 and Actions 9/9 PASS. New voice tests mock media/provider, not authoritative action execution.
36. Secret/bundle audit: 18/18 voice checks PASS plus portable SDK/source/build signature checks. Changed/untracked authored-file scan found no secret/private-key/Base64-media or generated/temp path signatures. This is a reasonable signature/static check, not proof against every possible credential representation.
37. V2-013: Browser/Deno and native PostgreSQL API regression PASS through full verify.
38. V2-014: recovery/chaos Browser/Deno, PWA and workspace offline/IndexedDB Playwright regressions PASS.
39. V2-015/016: full Browser regressions, shell audit, Actions audit and the 11 workspace/9 Actions Playwright tests PASS.
40. V2-019A: Browser/Deno, safety audit, native PostgreSQL and 5 Playwright regressions PASS.
41. V2-019B: Interpreter/model-evaluation Browser/Deno and model-policy audit PASS; Interpreter audit and 6 Playwright tests PASS. V2-018 gateway Browser/Deno/security audit also PASS.
42. Patient selected model preserved: `gpt-5.6-terra`.
43. Interpreter selected model preserved: `gpt-5.6-luna`.
44. Final `npm run verify`: PASS, exact exit code **0**. Includes typecheck, portability, local persistence/API regression, build, audits, Browser, Deno and Playwright. One earlier attempt stopped at a comment falsely matching `window.` in the portability guard; only the comment was reworded, guard unchanged, before the successful run. No executable change after successful full verification; this final report is documentation-only.
45. `git diff --check`: PASS. Only normal Windows LF/CRLF checkout notices, no whitespace errors.
46. V1 preserved: README SHA-256 `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`; er_sim_10.html SHA-256 `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`.
47. STEMI remains UNDER_REVIEW / REVIEW_ONLY, zero protected-content diff. Existing verification preserves review subject `46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`, review execution `a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`, golden trace `14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`. No clinical approval/publication.
48. Frozen Logical, Physical and all previously accepted ADRs: zero Git diff versus HEAD.
49. Security/privacy: mocked auth/provider failure, bounded token/replay, no key disclosure, no clinical side effects, no audio persistence and bundle/static checks PASS. No real credential read/requested or used for Azure.
50. Warnings/deviations: see limitations below. Earlier failed-test screenshots were removed as disposable reproducible test output, not user content. Nothing was reset/reverted. Existing assertions/configuration were not weakened.
51. Before final V2-020 closure: separately authorized live Azure smoke, consented Jordanian semantic/latency/noise results, human Taim/Sana review, actual end-to-end playback/permission evidence and production enablement/quota review. No provider switch without evidence and ADR.
52. Confirmed: voice owns no clinical truth; STT creates text only; partials never submit; clinical speech cannot execute directly; Patient TTS uses approved text only; Azure key server-only/browser token short-lived; no real audio retained; text/manual alternatives remain independent of voice; Patient Terra/Interpreter Luna unchanged; AI non-authoritative. No V2-021, Meshy (still on hold), RAG, Tutor, Case Builder, Visual Engine, diagnostic-media ingestion, remote Supabase, production-region choice, Azure resource creation, deployment, commit or push.
53. **V2-020 overall: NOT CLOSED**, pending live Azure Jordanian Voice Evaluation Gate.

## Limitations and explicit decisions

- Voice services are opt-in dependency injection; unconfigured UI remains text/manual and token issuance fails closed. No credentials/resource bootstrap is supplied.
- Existing selected Patient locale drives the browser configuration. Token issuance checks supported requested locale but does not add a persisted-locale field to the Session aggregate or mutate Session metadata.
- Azure resource tokens cannot enforce our application Session/capability/text metadata cryptographically. Production resource-abuse controls and shared issuance accounting across multiple server instances must be reviewed before enablement; current broker is bounded process-local memory.
- Explicit Play is used rather than default autoplay. TTS first-audio telemetry records provider synthesis availability and includes user delay after text arrival; it is not yet a live audible-playback or end-to-end acceptance measurement.
- Presentation timers are allowed only in the voice UI subtree by the existing shell audit adjustment. The new voice audit checks that subtree has no clinical-engine/session/assessment authority. Portable engine guards are unchanged.
- On this Windows host, focused Playwright teardown required stopping only exact verified Vite PIDs after test workers exited (23876, 15248, 23376, 23660). Final full verify completed without that intervention. Color-environment warnings are non-failing.
- Real microphone/device, Azure response quality, network latency and voice naturalness remain unproven by mocks. No synthetic evidence is labelled human evidence.

## Exact files created (30)

Paths are repository-relative.

```text
planning_input/v2-020/V2-020A_EVALUATION_PROTOCOL.md
planning_input/v2-020/V2-020A_VERIFICATION_REPORT.md
planning_input/v2-020/V2-020A_VOICE_BOUNDARY.md
v2/apps/web/src/features/voice/PatientSpeech.tsx
v2/apps/web/src/features/voice/VoiceCapture.tsx
v2/apps/web/src/features/voice/azure-speech-adapter.ts
v2/apps/web/src/features/voice/capture-controller.ts
v2/apps/web/src/features/voice/create-voice-services.ts
v2/apps/web/src/features/voice/fetch-speech-token.ts
v2/apps/web/src/features/voice/voice-services.ts
v2/evaluation/voice/v2-020a.freeze.json
v2/evaluation/voice/voice-evaluation.ts
v2/packages/api-core/src/voice/azure-token-provider.ts
v2/packages/api-core/src/voice/token-broker.ts
v2/packages/contracts/src/voice.ts
v2/playwright.v2-020a.config.mjs
v2/scripts/v2-020a-voice-audit.mjs
v2/tests/browser/v2-020a-e2e/voice-harness.html
v2/tests/browser/v2-020a-e2e/voice-harness.tsx
v2/tests/browser/v2-020a-e2e/voice.spec.ts
v2/tests/browser/voice/azure-adapter.browser.test.ts
v2/tests/browser/voice/voice-api.browser.test.ts
v2/tests/browser/voice/voice-core.browser.test.ts
v2/tests/browser/voice/voice-portability.browser.test.ts
v2/tests/browser/voice/voice-ui.browser.test.tsx
v2/tests/deno/voice_test.ts
v2/tests/fixtures/voice/corpus.ts
v2/tests/fixtures/voice/mock-speech.ts
v2/tests/fixtures/voice/portability.ts
v2/tests/fixtures/voice/ui-services.ts
```

## Exact existing files modified (13)

```text
v2/README.md
v2/apps/web/package.json
v2/apps/web/src/app/types.ts
v2/apps/web/src/features/actions/ClinicalActionsPanel.tsx
v2/apps/web/src/features/actions/ClinicalInterpreterPanel.tsx
v2/apps/web/src/features/conversation/PatientConversationPanel.tsx
v2/package-lock.json
v2/package.json
v2/packages/api-core/src/http/create-api-app.ts
v2/packages/api-core/src/index.ts
v2/packages/contracts/src/index.ts
v2/scripts/v2-015-ui-audit.mjs
v2/tests/fixtures/api/secure-api.ts
```
