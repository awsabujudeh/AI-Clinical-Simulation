import type { SpeechTokenProvider } from "./token-broker.ts";

/** Server infrastructure only. Construct from trusted secret injection, never browser/request data. */
export function createAzureSpeechTokenProvider(input: {
  subscription_key: string; region: string; fetch: typeof fetch;
}): SpeechTokenProvider {
  if (!/^[a-z][a-z0-9]{1,31}$/u.test(input.region) || input.subscription_key.trim().length === 0) {
    throw new Error("Invalid server Speech configuration.");
  }
  return Object.freeze({
    async issue() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await input.fetch(`https://${input.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Ocp-Apim-Subscription-Key": input.subscription_key, "Content-Type": "application/x-www-form-urlencoded" },
          body: ""
        });
        if (!response.ok) throw new Error("Speech token unavailable.");
        // Never propagate provider bodies/errors or send a secret across an HTTP redirect.
        const token = await response.text();
        if (token.length < 1 || token.length > 8_192 || token === input.subscription_key
          || !/^[\x21-\x7e]+$/u.test(token)) throw new Error("Speech token unavailable.");
        return { authorization_token: token, region: input.region };
      } catch { throw new Error("Speech token unavailable."); }
      finally { clearTimeout(timer); }
    }
  });
}
