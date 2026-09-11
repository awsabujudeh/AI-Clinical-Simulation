import { createElevenLabsSecureApi } from "../packages/api-core/src/voice/runtime-composition.ts";
import { readElevenLabsRuntimeConfig } from "../packages/api-core/src/voice/runtime-config.ts";
export function readLocalVoiceRuntimeConfig() { return readElevenLabsRuntimeConfig(name => process.env[name]); }
export function createNodeElevenLabsSecureApi(input) {
  return createElevenLabsSecureApi({ ...input, getEnv: name => process.env[name], fetch: input.fetch ?? globalThis.fetch, now: input.now ?? Date.now });
}
