import { createAzureSpeechSecureApi, type AzureSpeechApiCompositionInput } from "../packages/api-core/src/voice/runtime-composition.ts";

/** Runtime-only adapter. No listener or provider request on import/construction.
 * Environment permission failure disables only voice; existing API auth remains unchanged.
 */
export function createDenoAzureSpeechSecureApi(
  input: Omit<AzureSpeechApiCompositionInput, "getEnv" | "fetch" | "now"> & {
    fetch?: typeof fetch; now?: () => number;
  }
) {
  return createAzureSpeechSecureApi({
    ...input, getEnv: name => Deno.env.get(name), fetch: input.fetch ?? globalThis.fetch,
    now: input.now ?? Date.now
  });
}
