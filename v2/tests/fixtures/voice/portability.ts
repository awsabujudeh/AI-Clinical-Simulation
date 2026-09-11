import { createCaptureController } from "../../../apps/web/src/features/voice/capture-controller.ts";
import { PatientLanguageSchema } from "../../../packages/contracts/src/locales.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import { fakeVoiceClock, mockSpeech } from "./mock-speech.ts";
import { evaluateVoiceEvidence } from "../../../evaluation/voice/voice-evaluation.ts";
import { VOICE_EVALUATION_CORPUS } from "./corpus.ts";
import { SpeechTokenRequestSchema, SpeechTokenResponseSchema } from "../../../packages/contracts/src/voice.ts";
import { createMemorySpeechTokenBroker } from "../../../packages/api-core/src/voice/token-broker.ts";
import { SYNTHETIC_VOICE_PROFILE } from "./mock-speech.ts";
export async function speechTokenPortability() {
  const broker = createMemorySpeechTokenBroker({ async issue() { return { single_use_token: "synthetic-portable-token" }; } }, () => 1000, [SYNTHETIC_VOICE_PROFILE]);
  const results = [];
  for (const [index, raw] of [{ capability: "STT", locale: "ar-JO" }, { capability: "STT", locale: "en-US" },
    { capability: "TTS", locale: "ar-JO", voice_profile_id: SYNTHETIC_VOICE_PROFILE.profile_id }].entries()) {
    const result = await broker.issue("synthetic", SpeechTokenRequestSchema.parse({ ...raw, session_id: "session.voice" }), `issuance.${index}`);
    if (!result.success) throw Error("Token fixture failed");
    const token = SpeechTokenResponseSchema.parse(result.data);
    results.push([token.provider, token.capability, token.token_type, token.model_id, token.expires_at_ms,
      token.capability === "STT" ? [token.locale, token.language_code, token.secondary_languages] : token.voice_id]);
  }
  return canonicalSerialize(results);
}
export const TOKEN_PORTABILITY_EXPECTED = '[["ELEVENLABS","STT","realtime_scribe","scribe_v2_realtime",901000,["ar-JO","ar",["en"]]],["ELEVENLABS","STT","realtime_scribe","scribe_v2_realtime",901000,["en-US","en",[]]],["ELEVENLABS","TTS","tts_websocket","eleven_v3_conversational",901000,"syntheticArabicVoice"]]';
export async function voicePortability() {
  const mock = mockSpeech(); const time = fakeVoiceClock();
  const controller = createCaptureController({ adapter: mock.adapter, clock: time.clock,
    session_id: "session.voice", utterance_id: "utterance.voice", locale: PatientLanguageSchema.parse("ar-JO"), changed() {} });
  await controller.start(); mock.listener().partial("اطلب"); mock.listener().final("اطلب ECG");
  controller.stop(); mock.listener().ended();
  return canonicalSerialize({ snapshot: controller.snapshot(), reviewed: controller.review("لا تطلب ECG"),
    evaluation: evaluateVoiceEvidence(VOICE_EVALUATION_CORPUS, []) });
}
export const VOICE_PORTABILITY_EXPECTED = '{"evaluation":{"records":0,"status":"NOT_EXECUTED"},"reviewed":"لا تطلب ECG","snapshot":{"final":"اطلب ECG","partial":"","phase":"READY_TO_REVIEW"}}';
