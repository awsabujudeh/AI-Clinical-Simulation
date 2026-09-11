import type { PatientLanguage, PatientVoiceProfile, SafePatientConversationTurn,
  SpeechTokenRequest, SpeechTokenResponse, VoiceFailureCode, VoiceTelemetry } from "@ai-clinical-simulation/contracts";

export type RecognitionHandle = { stop(): void; close(): void };
export interface SpeechAdapter {
  recognize(input: {
    session_id: string; locale: PatientLanguage; signal: AbortSignal;
    listening(): void; partial(text: string): void; final(text: string): void;
    ended(): void; failed(code: VoiceFailureCode): void;
    tokenLatency(ms: number): void;
  }): Promise<RecognitionHandle>;
  synthesize(input: {
    session_id: string; locale: PatientLanguage; voice_id: string;
    text: string; voice_profile_id: string; signal: AbortSignal; firstAudio(ms: number): void;
  }): Promise<{ play(): Promise<void>; close(): void }>;
}
export interface StudentVoiceServices {
  adapter: SpeechAdapter;
  profile: PatientVoiceProfile;
  telemetry?(event: VoiceTelemetry): void;
}
export type SpeechTokenSource = (request: SpeechTokenRequest, signal: AbortSignal) => Promise<SpeechTokenResponse>;
/** TTS accepts a validated server turn at the UI boundary, never learner input. */
export type ApprovedPatientSpeech = Pick<SafePatientConversationTurn, "patient_utterance" | "locale" | "turn_id" | "session_id">;
