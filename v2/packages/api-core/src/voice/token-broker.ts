import { SpeechTokenRequestSchema, SpeechTokenResponseSchema, IdempotencyKeySchema, PatientVoiceProfileSchema,
  type PatientVoiceProfile, type SpeechTokenRequest, type SpeechTokenResponse } from "../../../contracts/src/index.ts";
import { ERRORS, apiError, type ApiServiceResult } from "../errors/api-service-error.ts";
export interface SpeechTokenProvider {
  issue(type: "realtime_scribe" | "ttd_websocket"): Promise<{ single_use_token: string }>;
}
export interface SpeechTokenBroker {
  issue(principalId: string, request: SpeechTokenRequest, key: string): Promise<ApiServiceResult<SpeechTokenResponse>>;
}
const unavailable = apiError({ code: "VOICE_TOKEN_UNAVAILABLE", http_status: 503,
  message_key: "api.error.voice-token-unavailable", retryable: true });
/** Authorize EVERY call. Tombstones, not token replay/cache: duplicate issuance keys fail including
 * in-flight/failed attempts. Fresh explicit reconnect needs a new key. 6 attempts/10min per
 * principal+Session; 512 entries. Multi-instance rollout needs shared quota/tombstones. */
export function createMemorySpeechTokenBroker(provider: SpeechTokenProvider, now: () => number, profiles: readonly PatientVoiceProfile[] = []): SpeechTokenBroker {
  const trusted = new Map<string, PatientVoiceProfile>();
  for (const raw of profiles) {
    const profile = PatientVoiceProfileSchema.parse(raw);
    if (trusted.has(profile.profile_id)) throw Error("Duplicate Voice profile.");
    trusted.set(profile.profile_id, profile);
  }
  const attempts = new Map<string, number>();
  const quotas = new Map<string, { until: number; count: number }>();
  return Object.freeze({ async issue(principalId: string, raw: SpeechTokenRequest, key: string): Promise<ApiServiceResult<SpeechTokenResponse>> {
    const parsed = SpeechTokenRequestSchema.safeParse(raw); const time = now();
    if (!parsed.success || !IdempotencyKeySchema.safeParse(key).success || !Number.isSafeInteger(time) || time < 0) return { success: false, error: ERRORS.malformed };
    for (const [id, until] of attempts) if (until <= time) attempts.delete(id);
    for (const [id, quota] of quotas) if (quota.until <= time) quotas.delete(id);
    const owner = JSON.stringify([principalId, parsed.data.session_id]); const id = JSON.stringify([owner, key]);
    if (attempts.has(id)) return { success: false, error: ERRORS.idempotency };
    const request = parsed.data;
    const profile = request.capability === "TTS" ? trusted.get(request.voice_profile_id) : undefined;
    if (request.capability === "TTS" && !profile) return { success: false, error: unavailable };
    const quota = quotas.get(owner) ?? { until: time + 600_000, count: 0 };
    if (quota.count >= 6 || attempts.size >= 512 || (!quotas.has(owner) && quotas.size >= 512)) return { success: false, error: unavailable };
    quota.count++; quotas.set(owner, quota); attempts.set(id, time + 900_000);
    const policy = request.capability === "STT"
      ? { token_type: "realtime_scribe" as const, model_id: "scribe_v2_realtime", language_code: request.locale === "ar-JO" ? "ar" : "en", secondary_languages: request.locale === "ar-JO" ? ["en"] : [] }
      : { token_type: "ttd_websocket" as const, model_id: profile!.model_id, voice_id: request.locale === "ar-JO" ? profile!.voices["ar-JO"] : profile!.voices["en-US"] };
    try {
      const token = await provider.issue(policy.token_type);
      const response = SpeechTokenResponseSchema.safeParse({ voice_schema_version: "2.0", provider: "ELEVENLABS", ...request,
        ...policy, single_use_token: token.single_use_token, issued_at_ms: time, expires_at_ms: time + 900_000 });
      if (!response.success || now() >= time + 870_000) return { success: false, error: unavailable };
      return { success: true, data: response.data };
    } catch { return { success: false, error: unavailable }; }
  } });
}
