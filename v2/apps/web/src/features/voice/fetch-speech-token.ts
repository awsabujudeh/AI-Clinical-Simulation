import { SpeechTokenRequestSchema, SpeechTokenResponseSchema, createApiV1SuccessEnvelopeSchema } from "@ai-clinical-simulation/contracts";
import type { SpeechTokenSource } from "./voice-services";

/** Reuse the application's authenticated fetch/header provider. Tokens never enter recovery storage. */
export function createFetchSpeechTokenSource(input: {
  fetch: typeof fetch; headers(): Promise<Record<string, string>>; issuanceKey?: () => string;
}): SpeechTokenSource {
  return async (raw, signal) => {
    const request = SpeechTokenRequestSchema.parse(raw);
    const response = await input.fetch("/v1/voice/token", {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
      headers: { ...await input.headers(), "Idempotency-Key": (input.issuanceKey ?? (() => crypto.randomUUID()))(),
        "Content-Type": "application/json", "X-Api-Schema-Version": "1.0" },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error("TOKEN_UNAVAILABLE");
    const envelope = createApiV1SuccessEnvelopeSchema(SpeechTokenResponseSchema).parse(await response.json());
    const token = envelope.data;
    if (token.session_id !== request.session_id || token.locale !== request.locale || token.capability !== request.capability) {
      throw new Error("TOKEN_UNAVAILABLE");
    }
    return token;
  };
}
