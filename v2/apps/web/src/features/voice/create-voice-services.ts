import { PatientVoiceProfileSchema, type PatientVoiceProfile, type VoiceTelemetry } from "@ai-clinical-simulation/contracts";
import { createAzureSpeechAdapter } from "./azure-speech-adapter";
import type { SpeechTokenSource, StudentVoiceServices } from "./voice-services";

/** Opt-in presentation composition. No environment reads, guessed patient voice, or provider failover. */
export function createAzureStudentVoiceServices(input: {
  token_source: SpeechTokenSource; patient_voice_profile: PatientVoiceProfile;
  telemetry?(event: VoiceTelemetry): void;
}): StudentVoiceServices {
  return Object.freeze({ adapter: createAzureSpeechAdapter(input.token_source),
    profile: PatientVoiceProfileSchema.parse(input.patient_voice_profile), telemetry: input.telemetry });
}
