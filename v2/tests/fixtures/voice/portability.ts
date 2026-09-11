import { createCaptureController } from "../../../apps/web/src/features/voice/capture-controller.ts";
import { PatientLanguageSchema } from "../../../packages/contracts/src/locales.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import { fakeVoiceClock, mockSpeech } from "./mock-speech.ts";
import { evaluateVoiceEvidence } from "../../../evaluation/voice/voice-evaluation.ts";
import { VOICE_EVALUATION_CORPUS } from "./corpus.ts";
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
