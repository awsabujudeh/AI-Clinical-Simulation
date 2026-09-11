import { createElevenLabsSecureApi, type ElevenLabsApiCompositionInput } from "../packages/api-core/src/voice/runtime-composition.ts";
export function createDenoElevenLabsSecureApi(input: Omit<ElevenLabsApiCompositionInput, "getEnv" | "fetch" | "now"> & { fetch?: typeof fetch; now?: () => number }) {
  return createElevenLabsSecureApi({ ...input, getEnv: name => Deno.env.get(name), fetch: input.fetch ?? globalThis.fetch, now: input.now ?? Date.now });
}
