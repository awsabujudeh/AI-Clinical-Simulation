import { SpeechTokenRequestSchema, SpeechTokenResponseSchema, IdempotencyKeySchema,
  type SpeechTokenRequest, type SpeechTokenResponse } from "../../../contracts/src/index.ts";
import { ERRORS, apiError, type ApiServiceResult } from "../errors/api-service-error.ts";

export interface SpeechTokenProvider {
  issue(): Promise<{ authorization_token: string; region: string }>;
}
export interface SpeechTokenBroker {
  issue(principalId: string, request: SpeechTokenRequest, key: string): Promise<ApiServiceResult<SpeechTokenResponse>>;
}
const unavailable = apiError({ code: "VOICE_TOKEN_UNAVAILABLE", http_status: 503,
  message_key: "api.error.voice-token-unavailable", retryable: true });

/** Process-local bounded cache/limiter, not clinical persistence. Authorize on EVERY call before entry.
 * Same refresh key replays until expiry, then renews in a new refresh period. No credentials logged.
 * Multi-instance production must supply a shared quota broker before enabling voice at scale. */
export function createMemorySpeechTokenBroker(provider: SpeechTokenProvider, now: () => number): SpeechTokenBroker {
  const entries = new Map<string, { fingerprint: string; until: number; result: Promise<ApiServiceResult<SpeechTokenResponse>> }>();
  const quotas = new Map<string, { until: number; attempts: number }>();
  return Object.freeze({
    async issue(principalId: string, raw: SpeechTokenRequest, key: string) {
      const parsed = SpeechTokenRequestSchema.safeParse(raw);
      const time = now();
      if (!parsed.success || !IdempotencyKeySchema.safeParse(key).success || !Number.isSafeInteger(time) || time < 0) {
        return { success: false, error: ERRORS.malformed } as const;
      }
      const request = parsed.data;
      for (const [id, entry] of entries) if (entry.until <= time) entries.delete(id);
      for (const [id, quota] of quotas) if (quota.until <= time) quotas.delete(id);
      const owner = JSON.stringify([principalId, request.session_id]);
      const id = JSON.stringify([owner, key]);
      const fingerprint = JSON.stringify([request.locale, request.capability]);
      const cached = entries.get(id);
      if (cached) return cached.fingerprint === fingerprint
        ? structuredClone(await cached.result) : { success: false, error: ERRORS.idempotency } as const;
      const quota = quotas.get(owner) ?? { until: time + 600_000, attempts: 0 };
      if (quota.attempts >= 6 || entries.size >= 512 || quotas.size >= 512 && !quotas.has(owner)) {
        return { success: false, error: unavailable } as const;
      }
      quota.attempts += 1;
      quotas.set(owner, quota);
      const result = (async (): Promise<ApiServiceResult<SpeechTokenResponse>> => {
        try {
          const token = await provider.issue();
          const response = SpeechTokenResponseSchema.safeParse({
            voice_schema_version: "1.0", ...request,
            authorization_token: token.authorization_token, region: token.region,
            issued_at_ms: time, expires_at_ms: time + 480_000
          });
          if (!response.success || now() >= time + 480_000) return { success: false, error: unavailable };
          return { success: true, data: response.data };
        } catch { return { success: false, error: unavailable }; }
      })();
      entries.set(id, { fingerprint, until: time + 480_000, result });
      return structuredClone(await result);
    }
  });
}
