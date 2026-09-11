import { createSecureApiApp, type SecureApiAppDependencies } from "../http/create-api-app.ts";
import { createElevenLabsTokenProvider } from "./elevenlabs-token-provider.ts";
import { createMemorySpeechTokenBroker } from "./token-broker.ts";
import { readElevenLabsRuntimeConfig, type SpeechEnvironmentGetter } from "./runtime-config.ts";
import type { PatientVoiceProfile } from "../../../contracts/src/voice.ts";
export type ElevenLabsApiCompositionInput = Readonly<{
  dependencies: Omit<SecureApiAppDependencies, "speech_token_broker">;
  getEnv: SpeechEnvironmentGetter;
  voice_profiles?: readonly PatientVoiceProfile[];
  fetch: typeof fetch; now: () => number;
}>;
/** Capability-local configuration failure. No provider call on construction. Existing auth unchanged. */
export function createElevenLabsSecureApi(input: ElevenLabsApiCompositionInput) {
  const result = readElevenLabsRuntimeConfig(input.getEnv);
  const broker = result.success
    ? createMemorySpeechTokenBroker(createElevenLabsTokenProvider({ ...result.config, fetch: input.fetch }), input.now, input.voice_profiles)
    : undefined;
  return { app: createSecureApiApp({ ...input.dependencies, speech_token_broker: broker }),
    voice: result.success ? { available: true as const } : { available: false as const, code: result.code } };
}
