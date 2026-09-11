import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// Isolated child environments only: never read, inherit, replace or print a host Speech secret.
const scenarios = [
  [{ AZURE_SPEECH_KEY: "synthetic-runtime-key-not-a-credential", AZURE_SPEECH_REGION: " UAENORTH " }, true],
  [{ AZURE_SPEECH_REGION: "uaenorth" }, false],
  [{ AZURE_SPEECH_KEY: "synthetic-runtime-key-not-a-credential" }, false]
];
for (const [environment, available] of scenarios) {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { readLocalAzureSpeechRuntimeConfig, createNodeAzureSpeechSecureApi } from './runtime/azure-speech-node.mjs';
    import { createApiTestHarness } from './tests/fixtures/api/secure-api.ts';
    const config = readLocalAzureSpeechRuntimeConfig();
    if (config.success !== ${available}) throw Error('Configuration availability mismatch');
    const h = await createApiTestHarness({ include_stemi: false });
    const root = createNodeAzureSpeechSecureApi({ dependencies: h.dependencies, now: () => 1000,
      fetch: async () => { throw Error('Unexpected network attempt'); } });
    if (root.voice.available !== ${available}) throw Error('Composition availability mismatch');
    if ((await root.app.request('/v1/voice/token', { method: 'POST' })).status !== 401) throw Error('Auth bypass');
  `], { cwd: fileURLToPath(new URL("../", import.meta.url)), env: environment, encoding: "utf8", timeout: 30_000 });
  assert.equal(child.status, 0, "Isolated Node configuration/composition check failed");
  assert.equal(child.stdout, "", "Runtime unexpectedly logged output");
}
console.log("V2-020B1 Node runtime: 3/3 isolated synthetic configuration/auth checks PASS; zero provider requests");
