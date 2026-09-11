import { createServer } from "node:http";
import { readElevenLabsRuntimeConfig } from "../packages/api-core/src/voice/runtime-config.ts";
import { createElevenLabsTokenProvider } from "../packages/api-core/src/voice/elevenlabs-token-provider.ts";
import { createMemorySpeechTokenBroker } from "../packages/api-core/src/voice/token-broker.ts";
import { SpeechTokenRequestSchema, PatientVoiceProfileSchema } from "../packages/contracts/src/voice.ts";
import { IdempotencyKeySchema } from "../packages/contracts/src/index.ts";

export const SMOKE_HOST = "127.0.0.1";
export const SMOKE_PORT = 4183;
export const SMOKE_ORIGIN = "http://127.0.0.1:4182";
export const SMOKE_TOKEN_PATH = "/__diagnostic/voice-smoke/token";
export const SMOKE_PROFILES_PATH = "/__diagnostic/voice-smoke/profiles";

/** Loopback diagnostic infrastructure, not production authentication. No side effects on import. */
export function createVoiceSmokeHost({ getEnv, fetch, now = Date.now }) {
  try {
    if (getEnv("V2_ALLOW_LIVE_ELEVENLABS_VOICE_SMOKE") !== "1") return { success: false, code: "LIVE_SMOKE_OPT_IN_REQUIRED" };
  } catch { return { success: false, code: "LIVE_SMOKE_OPT_IN_REQUIRED" }; }
  const configuration = readElevenLabsRuntimeConfig(getEnv);
  if (!configuration.success) return configuration;
  let profiles;
  try {
    // Non-secret trusted presentation configuration. No live/default voice ID is invented.
    const ids = (getEnv("ELEVENLABS_SMOKE_VOICE_IDS") ?? "").split(",").filter(Boolean);
    if (ids.length > 8 || new Set(ids).size !== ids.length) throw Error();
    profiles = ids.map((id, index) => PatientVoiceProfileSchema.parse({
      profile_version: "2.0", profile_id: `voice-profile.smoke-${index + 1}`, provider: "ELEVENLABS",
      model_id: "eleven_v3_conversational", voices: { "ar-JO": id, "en-US": id }
    }));
  } catch { return { success: false, code: "VOICE_PROFILE_CONFIGURATION_INVALID" }; }
  const broker = createMemorySpeechTokenBroker(createElevenLabsTokenProvider({ ...configuration.config, fetch }), now, profiles);
  const server = createServer((request, response) => {
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff" });
      response.end(JSON.stringify(body));
    };
    if (request.headers.host !== `${SMOKE_HOST}:${SMOKE_PORT}` || request.headers.origin !== SMOKE_ORIGIN) {
      send(403, { code: "SMOKE_ORIGIN_REJECTED" }); return;
    }
    if (![SMOKE_TOKEN_PATH, SMOKE_PROFILES_PATH].includes(request.url)) { send(404, { code: "SMOKE_ROUTE_REJECTED" }); return; }
    response.setHeader("Access-Control-Allow-Origin", SMOKE_ORIGIN); response.setHeader("Vary", "Origin");
    if (request.url === SMOKE_PROFILES_PATH) {
      if (request.method !== "GET") { send(405, { code: "SMOKE_METHOD_REJECTED" }); return; }
      send(200, { profiles }); return;
    }
    if (request.method === "OPTIONS") {
      const headers = (request.headers["access-control-request-headers"] ?? "").toLowerCase().split(",").map(x => x.trim()).sort();
      if (request.headers["access-control-request-method"] !== "POST" || headers.join(",") !== "content-type,idempotency-key") {
        send(403, { code: "SMOKE_PREFLIGHT_REJECTED" }); return;
      }
      response.setHeader("Access-Control-Allow-Methods", "POST");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key"); send(204); return;
    }
    if (request.method !== "POST") { send(405, { code: "SMOKE_METHOD_REJECTED" }); return; }
    if (request.headers["content-type"] !== "application/json") { send(415, { code: "SMOKE_CONTENT_TYPE_REJECTED" }); return; }
    if (!IdempotencyKeySchema.safeParse(request.headers["idempotency-key"]).success) { send(400, { code: "SMOKE_KEY_REQUIRED" }); return; }
    let body = ""; let rejected = false;
    request.setEncoding("utf8");
    request.on("data", chunk => {
      if (rejected) return; body += chunk;
      if (Buffer.byteLength(body) > 1024) { rejected = true; body = ""; send(413, { code: "SMOKE_BODY_TOO_LARGE" }); }
    });
    request.on("error", () => { rejected = true; });
    request.on("end", async () => {
      if (rejected) return;
      try {
        const parsed = SpeechTokenRequestSchema.safeParse(JSON.parse(body));
        if (!parsed.success || parsed.data.session_id !== "session.voice-smoke" || parsed.data.locale !== "ar-JO") {
          send(400, { code: "SMOKE_REQUEST_REJECTED" }); return;
        }
        const result = await broker.issue("local.voice-smoke", parsed.data, request.headers["idempotency-key"]);
        if (!result.success) { send(result.error.http_status, { code: "TOKEN_UNAVAILABLE" }); return; }
        send(200, result.data);
      } catch { send(400, { code: "SMOKE_REQUEST_REJECTED" }); }
    });
  });
  server.requestTimeout = 10_000; server.headersTimeout = 5_000;
  return { success: true, server };
}
export async function listenVoiceSmokeHost(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(SMOKE_PORT, SMOKE_HOST, () => { server.off("error", reject); resolve(); });
  });
}
