import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFile(join(root, path), "utf8");
async function files(path) {
  const result = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const full = join(path, item.name);
    if (item.isDirectory()) result.push(...await files(full)); else result.push(full);
  }
  return result;
}
const main = await read("apps/web/src/main.tsx");
const page = await read("apps/web/src/features/voice/VoiceSmoke.tsx");
const launcher = await read("scripts/v2-020c1-voice-smoke.mjs");
assert.match(main, /if \(import\.meta\.env\.DEV && import\.meta\.env\.MODE === "voice-smoke"/u);
assert.match(main, /window\.location\.origin === "http:\/\/127\.0\.0\.1:4182"/u);
assert.match(main, /window\.location\.pathname === "\/__dev\/voice-smoke"/u);
assert.ok(main.indexOf('void import("./features/voice/VoiceSmoke")') > main.indexOf("import.meta.env.DEV"));
assert.ok(!(await read("apps/web/src/App.tsx")).includes("voice-smoke"));
assert.match(page, /createElevenLabsSpeechAdapter\(createSmokeTokenSource\(setToken\)\)/u);
assert.match(page, /createCaptureController\(/u);
assert.match(page, /onClick=.*controller\.start\(\)/u);
// Closed import allowlist: no downstream capability service can be introduced silently.
const imports = [...page.matchAll(/from\s+"([^"]+)"/gu)].map(match => match[1]).sort();
assert.deepEqual(imports, ["./elevenlabs-speech-adapter", "./capture-controller", "./voice-services", "@ai-clinical-simulation/contracts", "react"].sort());
assert.doesNotMatch(page, /submitQuestion|submitInterpret|actions\/propose|clinical-engine|assessment-engine|patient-conversation|\.review\(|MediaRecorder|localStorage|indexedDB|writeFile|sendBeacon|WebSocket/u);
assert.match(page, /text: SMOKE_REFERENCE/u);
assert.equal([...page.matchAll(/\btransport\(/gu)].length, 1);
assert.match(page, /body: JSON\.stringify\(request\)/u);
assert.match(launcher, /env: childEnv/u);
assert.match(launcher, /child\?\.kill\(\)/u);
assert.match(launcher, /"--host", "127\.0\.0\.1"/u);
assert.match(await read("apps/web/vite.config.mjs"), /mode === "voice-smoke" \? \{ envDir: false \}/u);

// A real completed production build is REQUIRED; includes source maps if generated.
const built = await files(join(root, "apps/web/dist"));
assert.ok(built.some(path => path.endsWith(".js")));
for (const path of built) {
  const text = await readFile(path, "utf8");
  assert.doesNotMatch(text, /__dev\/voice-smoke|__diagnostic\/voice-smoke|Local ElevenLabs Voice smoke|Capture started → first partial|V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE|4183|synthetic-smoke-credential-not-real/u,
    "Smoke route, host or test credential entered production bundle");
}
for (const directory of ["apps/web/src", "apps/web/dist", "tests/fixtures/voice", "evaluation/voice"]) {
  for (const path of await files(join(root, directory))) {
    assert.doesNotMatch(await readFile(path, "utf8"), /ELEVENLABS_API_KEY|xi-api-key|synthetic-smoke-credential-not-real|-----BEGIN .*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{24,}/u,
      "Credential/configuration signature entered browser/evaluation artifacts");
  }
}
console.log("V2-020B2A smoke isolation, adapter/controller reuse, transcript non-submission, DEV-only production build and secret audit: PASS");
