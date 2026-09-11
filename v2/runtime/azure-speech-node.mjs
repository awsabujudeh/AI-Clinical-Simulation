import { createAzureSpeechSecureApi } from "../packages/api-core/src/voice/runtime-composition.ts";
import { readAzureSpeechRuntimeConfig } from "../packages/api-core/src/voice/runtime-config.ts";

// Process environment only; no dotenv/file loader, environment dump, listener, or request on import.
export function readLocalAzureSpeechRuntimeConfig() {
  return readAzureSpeechRuntimeConfig(name => process.env[name]);
}

/** @param {Omit<import('../packages/api-core/src/voice/runtime-composition.ts').AzureSpeechApiCompositionInput, 'getEnv' | 'fetch' | 'now'> & { fetch?: typeof fetch, now?: () => number }} input */
export function createNodeAzureSpeechSecureApi(input) {
  return createAzureSpeechSecureApi({
    ...input, getEnv: name => process.env[name], fetch: input.fetch ?? globalThis.fetch,
    now: input.now ?? Date.now
  });
}
