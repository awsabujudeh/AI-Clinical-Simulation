import { describe, it, expect } from "vitest";
import { PatientLanguageSchema, SpeechTokenRequestSchema, SpeechTokenResponseSchema, VoiceTelemetrySchema } from "../../../packages/contracts/src/index.ts";
import { createCaptureController } from "../../../apps/web/src/features/voice/capture-controller.ts";
import { fakeVoiceClock, mockSpeech } from "../../fixtures/voice/mock-speech.ts";
import { evaluateVoiceEvidence, VOICE_EVALUATION_POLICY } from "../../../evaluation/voice/voice-evaluation.ts";
import { VOICE_EVALUATION_CORPUS } from "../../fixtures/voice/corpus.ts";

function harness() {
  const mock = mockSpeech(); const time = fakeVoiceClock(); const telemetry: unknown[] = [];
  const controller = createCaptureController({ adapter: mock.adapter, session_id: "session.voice", locale: PatientLanguageSchema.parse("ar-JO"),
    utterance_id: "utterance.voice.001", clock: time.clock, changed() {}, telemetry(event) { telemetry.push(event); } });
  return { ...mock, ...time, controller, telemetry };
}
describe("Voice presentation core", () => {
  it("partial cannot be reviewed; final is editable and never auto-submits", async () => {
    const h = harness(); await h.controller.start(); h.listener().partial("اطلب");
    expect(h.controller.review("اطلب")).toBeUndefined(); h.listener().final("اطلب ECG");
    expect(h.controller.review("اطلب ECG")).toBeUndefined(); h.controller.stop(); h.listener().ended();
    expect(h.controller.snapshot().phase).toBe("READY_TO_REVIEW");
    expect(h.controller.review("لا تطلب ECG")).toBe("لا تطلب ECG");
    expect(h.telemetry.at(-1)).toMatchObject({ edit_occurred: true });
    expect(JSON.stringify(h.telemetry)).not.toContain("ECG");
  });
  it("stops at exactly 15 seconds and preserves usable final after release", async () => {
    const h = harness(); await h.controller.start(); h.listener().final("نص نهائي");
    h.advance(14_999); expect(h.counters.stops).toBe(0); h.advance(1); expect(h.counters.stops).toBe(1);
    h.listener().ended(); expect(h.controller.snapshot().final).toBe("نص نهائي");
    expect(h.telemetry[0]).toMatchObject({ completion: "MAX_DURATION", recording_duration_ms: 15000 });
  });
  it.each(["PERMISSION_DENIED", "DEVICE_UNAVAILABLE", "TOKEN_UNAVAILABLE", "TOKEN_EXPIRED", "RECOGNITION_FAILED", "NETWORK_LOST"] as const)("contains %s without enabling review", async (code) => {
    const h = harness(); await h.controller.start(); h.listener().failed(code);
    expect(h.controller.snapshot()).toMatchObject({ phase: "ERROR", failure: code });
    expect(h.controller.review("not authoritative")).toBeUndefined(); expect(h.counters.closed).toBe(1);
  });
  it.each([false, true])("no speech/partial-only stays failure: %s", async (partial) => {
    const h = harness(); await h.controller.start(); if (partial) h.listener().partial("maybe");
    h.listener().ended(); expect(h.controller.snapshot().failure).toBe(partial ? "PARTIAL_ONLY" : "NO_SPEECH");
    expect(h.controller.review("maybe")).toBeUndefined();
  });
  it("final timeout is bounded and partial never becomes final", async () => {
    const h = harness(); await h.controller.start(); h.listener().partial("some words"); h.controller.stop(); h.advance(5000);
    expect(h.controller.snapshot().failure).toBe("FINAL_TIMEOUT"); expect(h.controller.snapshot().final).toBe("");
  });
  it("cancel/re-record ignores old callbacks and closes old resources", async () => {
    const h = harness(); await h.controller.start(); const old = h.listener(); h.controller.cancel(); await h.controller.start();
    old.final("stale"); old.ended(); expect(h.controller.snapshot().phase).toBe("LISTENING");
    expect(h.controller.snapshot().final).toBe(""); h.controller.dispose(); expect(h.counters.closed).toBe(2);
  });
  it("late permission resolution after disposal closes returned handle", async () => {
    const h = harness(); const pending = h.controller.start(); h.controller.dispose(); await pending;
    expect(h.counters.closed).toBe(1);
  });
  it("rejects unknown fields, locales, unbounded tokens and telemetry payloads", () => {
    const req = { session_id: "session.voice", locale: "ar-JO", capability: "STT" };
    expect(SpeechTokenRequestSchema.safeParse(req).success).toBe(true);
    for (const locale of ["ar", "en", "ar-SA", "en-GB"]) expect(SpeechTokenRequestSchema.safeParse({ ...req, locale }).success).toBe(false);
    expect(SpeechTokenRequestSchema.safeParse({ ...req, api_key: "not-real" }).success).toBe(false);
    const token = { ...req, voice_schema_version: "2.0", provider: "ELEVENLABS", token_type: "realtime_scribe",
      model_id: "scribe_v2_realtime", language_code: "ar", secondary_languages: ["en"], single_use_token: "synthetic-token", issued_at_ms: 0, expires_at_ms: 900000 };
    expect(SpeechTokenResponseSchema.safeParse(token).success).toBe(true);
    for (const invalid of [{ single_use_token: "x".repeat(8193) }, { voice_schema_version: "1.0" }, { model_id: "other" }, { language_code: "en" }, { secret: true }]) {
      expect(SpeechTokenResponseSchema.safeParse({ ...token, ...invalid }).success).toBe(false);
    }
    expect(VoiceTelemetrySchema.safeParse({ raw_audio: "forbidden" }).success).toBe(false);
  });
  it("freezes 50 Arabic plus two English definitions, without live results", () => {
    expect(VOICE_EVALUATION_CORPUS).toHaveLength(52);
    expect(VOICE_EVALUATION_CORPUS.filter(x => x.locale === "ar-JO")).toHaveLength(50);
    expect(VOICE_EVALUATION_POLICY.usable_percentage).toBe(90);
    expect(VOICE_EVALUATION_POLICY.consequential_safe_percentage).toBe(100);
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, [])).toEqual({ status: "NOT_EXECUTED", records: 0 });
    expect(VOICE_EVALUATION_CORPUS.every(x => x.recording_provenance === null && x.speaker_metadata === null)).toBe(true);
  });
  it("semantic evidence is human-adjudicated, duplicate/missing/synthetic provenance fails closed", () => {
    const records = VOICE_EVALUATION_CORPUS.map((item, i) => ({ utterance_id: item.utterance_id, speaker_id: `speaker.${i % 3}`,
      reviewer_id: "reviewer.test", consent_confirmed: true, provenance: "LIVE_HUMAN", recording_reference: `recording.${i}`,
      condition: "BOOTH_NOISE", final_transcript: item.reference_text, semantic_verdict: "PRESERVED",
      correction_detected_before_submit: false, confirmation_boundary_observed: true, first_partial_ms: 100, final_after_release_ms: 200 }));
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, records).status).toBe("MEETS_STT_TARGETS");
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, records.slice(1)).status).toBe("INCOMPLETE");
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, [...records, records[0]]).status).toBe("INVALID_EVIDENCE");
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, [{ ...records[0], provenance: "GENERATED_TTS" }]).status).toBe("INVALID_EVIDENCE");
    records[30]!.semantic_verdict = "MEANING_CHANGED";
    expect(evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, records).status).toBe("BELOW_STT_TARGETS");
  });
});
