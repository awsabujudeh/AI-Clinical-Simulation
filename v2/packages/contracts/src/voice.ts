import { z } from "zod";
import { SessionIdSchema } from "./ids.ts";
import { PatientLanguageSchema } from "./locales.ts";

export const VOICE_SCHEMA_VERSION = "1.0" as const;
export const VoiceCapabilitySchema = z.enum(["STT", "TTS"]);
export const SpeechTokenRequestSchema = z.strictObject({
  session_id: SessionIdSchema,
  locale: PatientLanguageSchema,
  capability: VoiceCapabilitySchema
});
export type SpeechTokenRequest = z.infer<typeof SpeechTokenRequestSchema>;
/** Ephemeral bearer credential. Never persist or include in telemetry. */
export const SpeechTokenResponseSchema = z.strictObject({
  voice_schema_version: z.literal(VOICE_SCHEMA_VERSION),
  session_id: SessionIdSchema,
  locale: PatientLanguageSchema,
  capability: VoiceCapabilitySchema,
  authorization_token: z.string().min(1).max(8_192).regex(/^[\x21-\x7e]+$/u),
  region: z.string().regex(/^[a-z][a-z0-9]{1,31}$/u),
  issued_at_ms: z.number().int().nonnegative().safe(),
  expires_at_ms: z.number().int().nonnegative().safe()
}).refine((value) => value.expires_at_ms > value.issued_at_ms
  && value.expires_at_ms - value.issued_at_ms <= 480_000);
export type SpeechTokenResponse = z.infer<typeof SpeechTokenResponseSchema>;
export const VoiceFailureCodeSchema = z.enum([
  "PERMISSION_DENIED", "DEVICE_UNAVAILABLE", "TOKEN_UNAVAILABLE", "TOKEN_EXPIRED",
  "RECOGNITION_FAILED", "NO_SPEECH", "PARTIAL_ONLY", "FINAL_TIMEOUT", "CANCELLED",
  "LOCALE_CHANGED", "NETWORK_LOST", "TTS_FAILED", "TTS_TIMEOUT", "PLAYBACK_BLOCKED",
  "INVALID_INPUT"
]);
export type VoiceFailureCode = z.infer<typeof VoiceFailureCodeSchema>;
export const VoiceCapturePhaseSchema = z.enum([
  "IDLE", "REQUESTING_PERMISSION", "LISTENING", "PROCESSING_FINAL", "READY_TO_REVIEW", "ERROR"
]);
export type VoiceCapturePhase = z.infer<typeof VoiceCapturePhaseSchema>;
const duration = z.number().finite().nonnegative().max(3_600_000);
export const VoiceTelemetrySchema = z.strictObject({
  voice_schema_version: z.literal(VOICE_SCHEMA_VERSION),
  utterance_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u),
  locale: PatientLanguageSchema,
  capability: VoiceCapabilitySchema,
  recording_duration_ms: duration.optional(),
  permission_outcome: z.enum(["NOT_REQUESTED", "GRANTED", "DENIED", "UNAVAILABLE"]),
  token_latency_ms: duration.optional(),
  first_partial_latency_ms: duration.optional(),
  final_transcript_latency_ms: duration.optional(),
  tts_first_audio_latency_ms: duration.optional(),
  completion: z.enum(["COMPLETED", "FAILED", "CANCELLED", "MAX_DURATION"]),
  failure_code: VoiceFailureCodeSchema.optional(),
  edit_occurred: z.boolean()
});
export type VoiceTelemetry = z.infer<typeof VoiceTelemetrySchema>;

/** Presentation choice only; no sex/gender inference or Case schema amendment. */
export const PatientVoiceProfileSchema = z.strictObject({
  profile_id: z.string().regex(/^voice-profile\.[a-z0-9-]+$/u),
  profile_version: z.literal("1.0"),
  voices: z.strictObject({
    "ar-JO": z.enum(["ar-JO-TaimNeural", "ar-JO-SanaNeural"]),
    "en-US": z.enum(["en-US-JennyNeural", "en-US-GuyNeural"])
  })
});
export type PatientVoiceProfile = z.infer<typeof PatientVoiceProfileSchema>;
