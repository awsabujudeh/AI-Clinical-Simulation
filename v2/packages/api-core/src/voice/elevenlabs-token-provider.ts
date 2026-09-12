import { z } from "zod";
import type { SpeechTokenProvider } from "./token-broker.ts";
const providerResponse = z.object({ token: z.string().min(1).max(8192).regex(/^[\x21-\x7e]+$/u) });
/** Fixed speech capabilities only. No retry, redirect, credential or provider-body logging. */
export function createElevenLabsTokenProvider(input: { api_key: string; fetch: typeof fetch }): SpeechTokenProvider {
  if (!input.api_key.trim()) throw Error("Voice configuration unavailable.");
  return Object.freeze({
    async issue(type: "realtime_scribe" | "ttd_websocket") {
      if (type !== "realtime_scribe" && type !== "ttd_websocket") throw Error("Voice token unavailable.");
      const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 5000);
      try {
        const response = await input.fetch(`https://api.elevenlabs.io/v1/single-use-token/${type}`, {
          method: "POST", headers: { "xi-api-key": input.api_key }, redirect: "error", signal: abort.signal
        });
        if (!response.ok) throw Error("Voice token unavailable.");
        const result = providerResponse.safeParse(await response.json());
        if (!result.success || result.data.token === input.api_key) throw Error("Voice token unavailable.");
        return { single_use_token: result.data.token };
      } catch { throw Error("Voice token unavailable."); }
      finally { clearTimeout(timer); }
    }
  });
}
