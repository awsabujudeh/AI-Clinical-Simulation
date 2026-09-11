import { createSecureApiApp, type SecureApiAppDependencies } from "../http/create-api-app.ts";
import { createAzureSpeechTokenProvider } from "./azure-token-provider.ts";
import { createMemorySpeechTokenBroker } from "./token-broker.ts";
import { readAzureSpeechRuntimeConfig, type AzureSpeechEnvironmentGetter } from "./runtime-config.ts";

export type AzureSpeechApiCompositionInput = Readonly<{
  dependencies: Omit<SecureApiAppDependencies, "speech_token_broker">;
  getEnv: AzureSpeechEnvironmentGetter;
  fetch: typeof fetch;
  now: () => number;
}>;

/** Capability-local configuration failure; the existing authenticated API still starts.
 * Construction never issues a token. Only the authorized route may invoke the provider.
 */
export function createAzureSpeechSecureApi(input: AzureSpeechApiCompositionInput) {
  const result = readAzureSpeechRuntimeConfig(input.getEnv);
  const broker = result.success
    ? createMemorySpeechTokenBroker(createAzureSpeechTokenProvider({ ...result.config, fetch: input.fetch }), input.now)
    : undefined;
  return {
    app: createSecureApiApp({ ...input.dependencies, speech_token_broker: broker }),
    voice: result.success
      ? { available: true as const }
      : { available: false as const, code: result.code }
  };
}
