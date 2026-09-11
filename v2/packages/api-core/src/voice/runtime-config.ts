/** Trusted process configuration only. Never serialize or log its secret. */
export type SpeechEnvironmentGetter = (name: string) => string | undefined;
export function readElevenLabsRuntimeConfig(getEnv: SpeechEnvironmentGetter) {
  try {
    const api_key = getEnv("ELEVENLABS_API_KEY");
    if (typeof api_key !== "string" || !api_key.trim()) return { success: false, code: "VOICE_KEY_REQUIRED" } as const;
    return { success: true, config: Object.freeze({ api_key }) } as const;
  } catch { return { success: false, code: "VOICE_ENVIRONMENT_UNAVAILABLE" } as const; }
}
