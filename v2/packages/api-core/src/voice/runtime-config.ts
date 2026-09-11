/** Trusted server configuration only. Never serialize this configuration to clients or logs. */
export const AZURE_SPEECH_KEY_ENV_NAME = "AZURE_SPEECH_KEY" as const;
export const AZURE_SPEECH_REGION_ENV_NAME = "AZURE_SPEECH_REGION" as const;
export type AzureSpeechEnvironmentGetter = (name: string) => string | undefined;
export type AzureSpeechConfigError = "AZURE_SPEECH_KEY_REQUIRED" | "AZURE_SPEECH_REGION_REQUIRED"
  | "AZURE_SPEECH_REGION_INVALID" | "AZURE_SPEECH_ENVIRONMENT_UNAVAILABLE";
export type AzureSpeechRuntimeConfigResult =
  | Readonly<{ success: true; config: Readonly<{ subscription_key: string; region: string }> }>
  | Readonly<{ success: false; code: AzureSpeechConfigError }>;

export function isAzureSpeechRegion(value: string): boolean {
  return /^[a-z][a-z0-9]{1,31}$/u.test(value);
}

export function readAzureSpeechRuntimeConfig(getEnv: AzureSpeechEnvironmentGetter): AzureSpeechRuntimeConfigResult {
  // The reader may throw (e.g. denied environment access). Never propagate its message or values.
  try {
    const key = getEnv(AZURE_SPEECH_KEY_ENV_NAME);
    if (typeof key !== "string" || key.trim().length === 0) {
      return { success: false, code: "AZURE_SPEECH_KEY_REQUIRED" };
    }
    const rawRegion = getEnv(AZURE_SPEECH_REGION_ENV_NAME);
    if (typeof rawRegion !== "string" || rawRegion.trim().length === 0) {
      return { success: false, code: "AZURE_SPEECH_REGION_REQUIRED" };
    }
    const region = rawRegion.trim().toLowerCase();
    if (!isAzureSpeechRegion(region)) return { success: false, code: "AZURE_SPEECH_REGION_INVALID" };
    return { success: true, config: Object.freeze({ subscription_key: key, region }) };
  } catch {
    return { success: false, code: "AZURE_SPEECH_ENVIRONMENT_UNAVAILABLE" };
  }
}
