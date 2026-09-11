import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createVoiceSmokeHost, listenVoiceSmokeHost, SMOKE_HOST, SMOKE_PORT, SMOKE_ORIGIN, SMOKE_TOKEN_PATH } from "../runtime/voice-smoke-host.mjs";
import { SpeechTokenResponseSchema } from "../packages/contracts/src/voice.ts";

// Synthetic injection only; never read the actual process credential/environment.
const key = "synthetic-smoke-credential-not-real";
const environment = { V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE: "1", ELEVENLABS_API_KEY: key, ELEVENLABS_SMOKE_VOICE_IDS: "syntheticVoiceOne,syntheticVoiceTwo" };
const body = { session_id: "session.voice-smoke", locale: "ar-JO", capability: "STT" };
let exchanges = 0;
function make(env = environment, fetch = async (url, init) => {
  exchanges++;
  assert.match(url, /^https:\/\/api\.elevenlabs\.io\/v1\/single-use-token\/(realtime_scribe|tts_websocket)$/u);
  assert.equal(init.redirect, "error");
  assert.equal(init.headers["xi-api-key"], key);
  return Response.json({ token: `synthetic-token-${exchanges}` });
}) { return createVoiceSmokeHost({ getEnv: name => env[name], fetch, now: () => 1000 }); }
function call({ method = "POST", path = SMOKE_TOKEN_PATH, origin = SMOKE_ORIGIN, headers = {}, data = JSON.stringify(body) } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: SMOKE_HOST, port: SMOKE_PORT, method, path, agent: false,
      headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": "smoke.issuance", "Content-Length": Buffer.byteLength(data), ...headers } }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", part => { text += part; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", reject); req.end(data);
  });
}
for (const [label, env, code] of [
  ["opt-in absent", {}, "LIVE_SMOKE_OPT_IN_REQUIRED"],
  ["key absent", { V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE: "1" }, "VOICE_KEY_REQUIRED"],
  ["empty key", { ...environment, ELEVENLABS_API_KEY: " " }, "VOICE_KEY_REQUIRED"],
  ["invalid voice configuration", { ...environment, ELEVENLABS_SMOKE_VOICE_IDS: "bad voice" }, "VOICE_PROFILE_CONFIGURATION_INVALID"]
]) test(label, () => { assert.deepEqual(make(env), { success: false, code }); assert.equal(exchanges, 0); });
test("guard refuses before reading secret; getter exceptions sanitized", () => {
  const reads = [];
  const result = createVoiceSmokeHost({ getEnv(name) { reads.push(name); throw Error("unsafe detail"); }, fetch() { throw Error("No network"); } });
  assert.equal(result.code, "LIVE_SMOKE_OPT_IN_REQUIRED");
  assert.deepEqual(reads, ["V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE"]);
});
test("loopback diagnostic HTTP boundary: origin/path/method/body, cache and sanitized response", async () => {
  const host = make(); assert.equal(host.success, true); assert.equal(exchanges, 0);
  await listenVoiceSmokeHost(host.server);
  try {
    assert.equal(host.server.address().address, "127.0.0.1");
    assert.equal(host.server.address().port, 4183);
    for (const attempt of [
      { origin: "https://untrusted.example" }, { origin: "" },
      { headers: { Host: "rebind.example:4183" } },
      { path: "/" }, { path: "/.env" }, { path: "/debug" }, { path: "/v1/voice/token" },
      { path: SMOKE_TOKEN_PATH + "?debug=1" }, { method: "GET" }, { method: "PUT" },
      { headers: { "Content-Type": "text/plain" } },
      { data: "{" }, { data: "x".repeat(1025) },
      { data: JSON.stringify({ ...body, capability: "TTS" }) },
      { data: JSON.stringify({ ...body, session_id: "session.other" }) },
      { data: JSON.stringify({ ...body, locale: "en-US" }) },
      { data: JSON.stringify({ ...body, arbitrary: "rejected" }) },
      { method: "OPTIONS", data: "", headers: { "Access-Control-Request-Method": "GET" } }
    ]) {
      const response = await call(attempt);
      assert.ok(response.status >= 400); assert.ok(!response.text.includes(key));
      assert.equal(exchanges, 0, "Rejected traffic must not reach provider");
    }
    const preflight = await call({ method: "OPTIONS", data: "", headers: {
      "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,idempotency-key" } });
    assert.equal(preflight.status, 204); assert.equal(exchanges, 0);
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], SMOKE_ORIGIN);
    assert.equal(response.headers["cache-control"], "no-store");
    const token = SpeechTokenResponseSchema.parse(JSON.parse(response.text));
    assert.equal(token.expires_at_ms - token.issued_at_ms, 900000);
    assert.equal(response.text.includes(key), false);
    assert.equal(response.text.includes("subscription"), false);
    assert.equal((await call()).status, 409); assert.equal(exchanges, 1);
    const reconnected = await call({ headers: { "Idempotency-Key": "smoke.reconnect" } });
    assert.equal(reconnected.status, 200); assert.notEqual(reconnected.text, response.text); assert.equal(exchanges, 2);
    const profiles = await call({ method: "GET", path: "/__diagnostic/voice-smoke/profiles", data: "" });
    assert.equal(profiles.status, 200); assert.equal(JSON.parse(profiles.text).profiles.length, 2);
    for (const index of [1, 2]) {
      const tts = await call({ headers: { "Idempotency-Key": `smoke.tts.${index}` }, data: JSON.stringify({
        ...body, capability: "TTS", voice_profile_id: `voice-profile.smoke-${index}` }) });
      assert.equal(tts.status, 200); assert.equal(JSON.parse(tts.text).token_type, "tts_websocket");
    }
  } finally { host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve)); }
});
test("provider failure cannot expose its body or credentials", async () => {
  const host = make(environment, async () => { throw Error(key); });
  await listenVoiceSmokeHost(host.server);
  try {
    const response = await call(); assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(response.text), { code: "TOKEN_UNAVAILABLE" });
  } finally { host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve)); }
});
test("actual launcher refuses without opt-in in an empty isolated environment", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./v2-020c1-voice-smoke.mjs", import.meta.url))], {
    env: {}, encoding: "utf8", timeout: 15000, windowsHide: true
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /LIVE_SMOKE_OPT_IN_REQUIRED/u);
  assert.equal(result.stdout, "");
});
test("real DEV route loads only in smoke mode without microphone/provider traffic", async () => {
  // No token host and no credential environment. Browser cannot send any external request.
  const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "--mode", "voice-smoke", "--host", "127.0.0.1", "--port", "4182", "--strictPort"], {
    cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)), env: {}, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Mock-only dev server startup timeout")), 15000);
      child.stdout.on("data", data => { if (data.toString().includes("4182")) { clearTimeout(timer); resolve(); } });
      child.once("error", () => { clearTimeout(timer); reject(Error("Dev child unavailable")); });
      child.once("exit", () => { clearTimeout(timer); reject(Error("Dev child exited before test")); });
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(); const external = [];
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin === SMOKE_ORIGIN) return route.continue();
      if (url.href === "http://127.0.0.1:4183/__diagnostic/voice-smoke/profiles") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ profiles: [] }), headers: { "Access-Control-Allow-Origin": SMOKE_ORIGIN } });
      external.push(url.origin); return route.abort();
    });
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw Error("Test forbids microphone use"); };
    });
    await page.goto(`${SMOKE_ORIGIN}/__dev/voice-smoke`);
    await page.getByRole("heading", { name: "Local ElevenLabs Voice smoke" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Start recording" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Stop recording" }).isDisabled(), true);
    assert.deepEqual(external, []);
    await page.goto(`${SMOKE_ORIGIN}/`);
    assert.equal(await page.getByRole("heading", { name: "Local ElevenLabs Voice smoke" }).count(), 0);
  } finally {
    await browser?.close();
    if (child.exitCode === null) await new Promise(resolve => { child.once("exit", resolve); child.kill(); });
  }
});
