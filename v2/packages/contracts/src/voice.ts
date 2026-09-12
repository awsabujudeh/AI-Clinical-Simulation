import { z } from "zod";
import { SessionIdSchema } from "./ids.ts";
import { PatientLanguageSchema } from "./locales.ts";

export const VOICE_SCHEMA_VERSION = "1.0" as const;
export const VoiceCapabilitySchema = z.enum(["STT", "TTS"]);
export const VoiceProfileIdSchema = z.string().regex(/^voice-profile\.[a-z0-9-]+$/u);
export const SpeechVoiceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
export const SpeechTokenRequestSchema = z.discriminatedUnion("capability", [
  z.strictObject({ session_id: SessionIdSchema, locale: PatientLanguageSchema, capability: z.literal("STT") }),
  z.strictObject({ session_id: SessionIdSchema, locale: PatientLanguageSchema, capability: z.literal("TTS"), voice_profile_id: VoiceProfileIdSchema })
]);
export type SpeechTokenRequest = z.infer<typeof SpeechTokenRequestSchema>;
/** Version 2: one connection attempt only. Never persist/cache for replay or put in telemetry. */
const tokenFields = {
  voice_schema_version: z.literal("2.0"),
  provider: z.literal("ELEVENLABS"),
  session_id: SessionIdSchema,
  locale: PatientLanguageSchema,
  single_use_token: z.string().min(1).max(8_192).regex(/^[\x21-\x7e]+$/u),
  issued_at_ms: z.number().int().nonnegative().safe(),
  expires_at_ms: z.number().int().nonnegative().safe()
};
export const SpeechTokenResponseSchema = z.discriminatedUnion("capability", [
  z.strictObject({ ...tokenFields, capability: z.literal("STT"), token_type: z.literal("realtime_scribe"),
    model_id: z.literal("scribe_v2_realtime"), language_code: z.enum(["ar", "en"]), secondary_languages: z.array(z.enum(["ar", "en"])).max(1) }),
  z.strictObject({ ...tokenFields, capability: z.literal("TTS"), token_type: z.literal("ttd_websocket"),
    model_id: z.literal("eleven_v3_conversational"), voice_profile_id: VoiceProfileIdSchema, voice_id: SpeechVoiceIdSchema })
]).refine(value => value.expires_at_ms > value.issued_at_ms && value.expires_at_ms - value.issued_at_ms <= 900_000)
  .refine(value => value.capability !== "STT" || (value.locale === "ar-JO"
    ? value.language_code === "ar" && value.secondary_languages.length === 1 && value.secondary_languages[0] === "en"
    : value.language_code === "en" && value.secondary_languages.length === 0));
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
  profile_id: VoiceProfileIdSchema,
  profile_version: z.literal("2.0"),
  provider: z.literal("ELEVENLABS"),
  model_id: z.literal("eleven_v3_conversational"),
  voices: z.strictObject({
    "ar-JO": SpeechVoiceIdSchema,
    "en-US": SpeechVoiceIdSchema
  })
});
export type PatientVoiceProfile = z.infer<typeof PatientVoiceProfileSchema>;
