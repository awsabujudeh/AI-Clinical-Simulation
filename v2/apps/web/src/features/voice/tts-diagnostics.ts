/** Closed, presentation-only diagnostics. Never retain raw provider messages or close reasons. */
export const TTS_FAILURE_CODES = [
  "TTS_TOKEN_UNAVAILABLE", "TTS_WEBSOCKET_CONNECT_FAILED", "TTS_WEBSOCKET_AUTH_FAILED",
  "TTS_PROTOCOL_ERROR", "TTS_PROVIDER_ERROR", "TTS_AUDIO_DECODE_FAILED", "TTS_TIMEOUT", "TTS_PLAYBACK_FAILED"
] as const;
export type TtsFailureCode = typeof TTS_FAILURE_CODES[number];
const providerCodes = ["unauthorized", "authentication_error", "invalid_token", "token_expired",
  "invalid_token_type", "invalid_request", "rate_limit_exceeded", "quota_exceeded", "voice_not_found", "model_not_found"] as const;
function safeProviderCode(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599) return value;
  if (typeof value === "string" && providerCodes.some(code => code === value)) return value;
  return value === undefined ? undefined : "OTHER";
}
export class TtsDiagnostic extends Error {
  readonly closeCode: number | undefined;
  readonly providerCode: string | number | undefined;
  constructor(readonly code: TtsFailureCode, details: { closeCode?: unknown; providerCode?: unknown } = {}) {
    super(code); this.name = "TtsDiagnostic";
    this.closeCode = typeof details.closeCode === "number" && Number.isInteger(details.closeCode)
      && details.closeCode >= 1000 && details.closeCode <= 4999 ? details.closeCode : undefined;
    this.providerCode = safeProviderCode(details.providerCode);
    Object.freeze(this);
  }
}
export function providerTtsDiagnostic(value: unknown): TtsDiagnostic {
  const code = safeProviderCode(value);
  const auth = code === 401 || code === 403 || code === "unauthorized" || code === "authentication_error"
    || code === "invalid_token" || code === "token_expired";
  return new TtsDiagnostic(auth ? "TTS_WEBSOCKET_AUTH_FAILED" : "TTS_PROVIDER_ERROR", { providerCode: value });
}
export function formatTtsDiagnostic(error: unknown): string {
  const safe = error instanceof TtsDiagnostic ? error : new TtsDiagnostic("TTS_PROVIDER_ERROR");
  return [safe.code, safe.closeCode === undefined ? undefined : `close=${safe.closeCode}`,
    safe.providerCode === undefined ? undefined : `provider=${safe.providerCode}`].filter(Boolean).join("; ");
}
