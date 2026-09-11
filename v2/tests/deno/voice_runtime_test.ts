import { readAzureSpeechRuntimeConfig } from "../../packages/api-core/src/voice/runtime-config.ts";
import { createDenoAzureSpeechSecureApi } from "../../runtime/azure-speech-deno.ts";
import { createApiTestHarness } from "../fixtures/api/secure-api.ts";

Deno.test("voice config is portable and denied runtime environment keeps the secure API available", async () => {
  const config = readAzureSpeechRuntimeConfig(name => name === "AZURE_SPEECH_KEY" ? "synthetic-only" : " UAENORTH ");
  if (!config.success || config.config.region !== "uaenorth") throw Error("Portable config mismatch");
  const h = await createApiTestHarness({ include_stemi: false });
  // No --allow-env or --allow-net: even a real credential in the host is never read.
  const root = createDenoAzureSpeechSecureApi({ dependencies: h.dependencies,
    fetch: (() => { throw Error("Provider must not run"); }) as typeof fetch });
  if (root.voice.available || root.voice.code !== "AZURE_SPEECH_ENVIRONMENT_UNAVAILABLE") throw Error("Expected capability-local denied-env result");
  const response = await root.app.request("/v1/voice/token", { method: "POST" });
  if (response.status !== 401) throw Error("Authentication bypassed");
});
