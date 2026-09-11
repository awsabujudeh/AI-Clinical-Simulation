> HISTORICAL / SUPERSEDED PROVIDER RECORD: Azure-specific runtime, credential and command instructions below are not active. ADR-VOICE-PROVIDER-001 supersedes the provider choice. Use V2-020_ELEVENLABS_PROVIDER_MIGRATION.md for current instructions. This banner does not retroactively change the historical test evidence or reviewed semantic thresholds.
>
> C1A CLOSURE SUPERSESSION: Provider selection is CLOSED; ElevenLabs Jordanian/Arabic STT and TTS quality is APPROVED by the product owner. The unchanged 52 fixtures/hashes are SAFETY / INTEGRATION REGRESSION CORPUS, not a required live quality retest. Historical quality, multi-speaker and multi-voice gates below are not current closure requirements. Only the A–G integration/verification checklist in ADR-VOICE-PROVIDER-001 and V2-020_ELEVENLABS_PROVIDER_MIGRATION.md is active.

# V2-020A — Jordanian Voice Evaluation Harness

Status: **PREPARED; NOT EXECUTED**. This is not Azure acceptance or medical validation.

The corpus has 52 authored definitions: 50 `ar-JO`, two `en-US`. All are synthetic text specifications, not audio, human observations, or medical recommendations. It covers colloquial/standard Arabic, symptom and yes/no questions, English medical code-switching, investigations, medications, negation, quantities/doses/units, hypothetical and past language, compound/incomplete commands, fast speech and booth-noise challenges. Reference meaning and important concepts are explicit. No word-for-word Azure transcript is required; no unreviewed alternative phrasings are asserted. Speaker and recording metadata are null until real evidence exists.

`v2/evaluation/voice/v2-020a.freeze.json` binds canonical policy and corpus SHA-256 before any live results. The permanent audit recomputes both. Any change requires explicit review/refreeze before live collection; thresholds must not be adjusted to rescue a provider.

## Collection and semantic review

Target 3–5 consenting Jordanian speakers, male/female representation where possible, at least 50 utterances, and booth-like noise. This harness requires every defined utterance once (52 including two English controls) for a complete dataset; repeat/inter-speaker studies can be recorded separately before extending the frozen protocol explicitly. Record provenance by identifier, not raw audio inside this repository/runtime. Synthetic SDK/TTS audio must never substitute for human STT evidence.

A named human reviewer adjudicates PRESERVED, MEANING_CHANGED, or UNUSABLE against the authored semantic meaning, including negation, numerical magnitude, units, action identity and omissions. Token overlap and WER alone cannot award semantic success. Optional WER is secondary diagnostic evidence. The schema requires consent, live-human provenance, speaker/reviewer/reference identifiers, noise condition, transcript, semantic verdict, observed correction/confirmation boundary and timings. Duplicate/missing/unknown identities or malformed evidence fail closed.

Frozen thresholds: at least 90% semantically usable finals. Every consequential phrase must preserve meaning or be explicitly detected/corrected before submission with the confirmation boundary observed. A checkbox asserting that the UI has confirmation is not enough to excuse unobserved semantic corruption. No transcript executes a clinical action directly.

Latency targets (strictly below): first partial p50 800/p95 1500 ms; release-to-final p50 1200/p95 3000 ms; Patient text-to-first-TTS-audio p50 1200/p95 2500 ms; short end-to-end question p95 8000 ms. These are targets, not guarantees. The STT evaluator reports its subset only; overall provider acceptance additionally requires TTS and end-to-end evidence. Missing evidence never becomes PASS.

## TTS human review

Prepare separate review rows for Taim and Sana: Jordanian acceptability, intelligibility, medical-English pronunciation, pacing, emotional appropriateness (1–5 anchored poor→excellent), explicit pronunciation-failure flag, measured first-audio latency and notes. No voice winner is selected here. Human reviewers must adjudicate naturalness after actual playback. They may not override a consequential safety failure using average naturalness.

## Final V2-020 closure blockers

- Separately authorized live Azure smoke and resource/security review; no credentials requested in A.
- Real consented Jordanian recordings/recognition observations and complete provenance.
- Frozen semantic/latency analysis, including noisy conditions and consequential errors.
- Taim/Sana human naturalness/pronunciation review and explicit final presentation profile choice.
- Real end-to-end latency and browser playback/permission tests.
- Production enablement/quota accounting review. No resource creation or production-region decision now.

Azure remains evaluation-gated. Any provider switch requires an evidence-backed ADR before another speech provider is implemented. V2-020 remains NOT CLOSED.
