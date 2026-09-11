import { readElevenLabsRuntimeConfig } from "../../packages/api-core/src/voice/runtime-config.ts";
import { createDenoElevenLabsSecureApi } from "../../runtime/elevenlabs-voice-deno.ts";
import { createApiTestHarness } from "../fixtures/api/secure-api.ts";
Deno.test("voice config is portable and denied runtime environment keeps the secure API available", async () => {
  const config = readElevenLabsRuntimeConfig(() => "synthetic-only");
  if (!config.success) throw Error("Portable config mismatch");
  const h = await createApiTestHarness({ include_stemi: false });
  // No environment/network permission, so actual credentials cannot be accessed.
  const root = createDenoElevenLabsSecureApi({ dependencies: h.dependencies, fetch: (() => { throw Error("No network"); }) as typeof fetch });
  if (root.voice.available || root.voice.code !== "VOICE_ENVIRONMENT_UNAVAILABLE") throw Error("Expected capability-local denied-env result");
  if ((await root.app.request("/v1/voice/token", { method: "POST" })).status !== 401) throw Error("Auth bypass");
});
