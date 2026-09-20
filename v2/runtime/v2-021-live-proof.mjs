import { PatientVoiceProfileSchema } from "../packages/contracts/src/index.ts";
import { OpenAiResponsesProvider } from "../packages/ai-gateway/src/index.ts";
import { readElevenLabsRuntimeConfig } from "../packages/api-core/src/voice/runtime-config.ts";
import { createElevenLabsTokenProvider } from "../packages/api-core/src/voice/elevenlabs-token-provider.ts";
import { createMemorySpeechTokenBroker } from "../packages/api-core/src/voice/token-broker.ts";

export const V2_021_PROOF_QUESTION = "متى بلش وجع صدرك؟";

// DEV-only admission limit. Exact retries still reach authoritative API replay;
// a new page must not obtain another provider invocation in the same host boot.
export function createV2_021QuestionAdmission() {
  let acceptedKey;
  return (body, key) => {
    if (body?.text !== V2_021_PROOF_QUESTION || body?.locale !== "ar-JO"
      || typeof key !== "string" || !key) return "REVIEW_PROOF_REQUEST_NOT_ALLOWED";
    if (acceptedKey && key !== acceptedKey) return "REVIEW_PROOF_ALREADY_CONSUMED";
    acceptedKey = key;
    return undefined;
  };
}
/** Explicit, one-question loopback proof; never production configuration or auth. */
export function prepareV2_021LiveProof({ getEnv, fetch, now = Date.now }) {
  try {
    if (getEnv("V2_ALLOW_LIVE_V2_021_VOICE_PROOF") !== "1") return { success: false, code: "LIVE_PROOF_OPT_IN_REQUIRED" };
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey?.trim()) return { success: false, code: "PATIENT_PROVIDER_KEY_REQUIRED" };
    const speech = readElevenLabsRuntimeConfig(getEnv);
    if (!speech.success) return speech;
    const ids = (getEnv("ELEVENLABS_SMOKE_VOICE_IDS") ?? "").split(",").filter(Boolean);
    if (ids.length !== 1) return { success: false, code: "ONE_APPROVED_VOICE_REQUIRED" };
    const profile = PatientVoiceProfileSchema.parse({ profile_version: "2.0", profile_id: "voice-profile.stemi-review",
      provider: "ELEVENLABS", model_id: "eleven_v3_conversational", voices: { "ar-JO": ids[0], "en-US": ids[0] } });
    let providerAttempts = 0; let tokens = 0; let invocation = false;
    const provider = new OpenAiResponsesProvider({ api_key: apiKey, transport: { async send(request) {
      // One Patient invocation, existing selected policy allows at most two HTTP attempts.
      if (++providerAttempts > 2) throw Error("PROOF_LIMIT_REACHED");
      const response = await fetch(request.url, { method: request.method, headers: request.headers,
        body: request.body, signal: request.signal, redirect: "error" });
      return { status: response.status, body: await response.text() };
    } } });
    const speechProvider = createElevenLabsTokenProvider({ ...speech.config, fetch });
    const broker = createMemorySpeechTokenBroker({ async issue(type) {
      if (type !== "ttd_websocket" || ++tokens > 1) throw Error("PROOF_LIMIT_REACHED");
      return speechProvider.issue(type);
    } }, now, [profile]);
    return { success: true, profile, speech_token_broker: broker, patient_provider: {
      async execute(request) {
        if (invocation) return { success: false, provider: "OPENAI", code: "AI_BUDGET_EXCEEDED",
          retryable: false, response_status: "FAILED", retry_count: 0 };
        invocation = true; return provider.execute(request);
      }
    }, counts() { return { patient_http_attempts: providerAttempts, tts_token_attempts: tokens }; } };
  } catch { return { success: false, code: "LIVE_PROOF_CONFIGURATION_UNAVAILABLE" }; }
}
