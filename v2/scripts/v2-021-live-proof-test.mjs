import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareV2_021LiveProof } from "../runtime/v2-021-live-proof.mjs";

// Synthetic configuration and injected I/O only. Never consult process.env.
const environment = {
  V2_ALLOW_LIVE_V2_021_VOICE_PROOF: "1", OPENAI_API_KEY: "synthetic-patient-secret",
  ELEVENLABS_API_KEY: "synthetic-voice-secret", ELEVENLABS_SMOKE_VOICE_IDS: "syntheticVoice001"
};
function prepare(overrides = {}, transport = async () => { throw Error("Unexpected I/O"); }) {
  const values = { ...environment, ...overrides };
  return prepareV2_021LiveProof({ getEnv: name => values[name], fetch: transport, now: () => 1000 });
}
const request = { model: "gpt-5.6-terra", instructions: "Synthetic instructions", user_content: "Synthetic question",
  output_schema_name: "synthetic", output_json_schema: { type: "object", properties: {}, additionalProperties: false },
  max_output_tokens: 64, max_attempts: 2, timeout_ms: 1000, reasoning_effort: "low" };
const tokenRequest = { capability: "TTS", session_id: "session.live-proof",
  locale: "ar-JO", voice_profile_id: "voice-profile.stemi-review" };

test("live proof reads no credentials and does no I/O without explicit opt-in", () => {
  const names = [];
  const result = prepareV2_021LiveProof({ getEnv(name) { names.push(name); return undefined; },
    fetch: () => assert.fail("Unexpected I/O") });
  assert.deepEqual(result, { success: false, code: "LIVE_PROOF_OPT_IN_REQUIRED" });
  assert.deepEqual(names, ["V2_ALLOW_LIVE_V2_021_VOICE_PROOF"]);
});

test("missing keys or missing/ambiguous voice profile fail closed without I/O", () => {
  assert.equal(prepare({ OPENAI_API_KEY: "" }).code, "PATIENT_PROVIDER_KEY_REQUIRED");
  assert.equal(prepare({ ELEVENLABS_API_KEY: "" }).code, "VOICE_KEY_REQUIRED");
  assert.equal(prepare({ ELEVENLABS_SMOKE_VOICE_IDS: "" }).code, "ONE_APPROVED_VOICE_REQUIRED");
  assert.equal(prepare({ ELEVENLABS_SMOKE_VOICE_IDS: "voiceOne,voiceTwo" }).code, "ONE_APPROVED_VOICE_REQUIRED");
});

test("prepared profile is credential-free and preparation never makes provider calls", () => {
  const result = prepare(); assert.equal(result.success, true);
  assert.deepEqual(result.counts(), { patient_http_attempts: 0, tts_token_attempts: 0 });
  assert.equal(result.profile.model_id, "eleven_v3_conversational");
  assert.equal(result.profile.provider, "ELEVENLABS");
  assert.equal(JSON.stringify(result.profile).includes("secret"), false);
});

test("one Patient invocation uses the unchanged provider with store false and no tools", async () => {
  let calls = 0;
  const result = prepare({}, async (url, options) => {
    calls++; assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-5.6-terra"); assert.equal(body.store, false);
    assert.deepEqual(body.tools, []); assert.equal(body.tool_choice, "none");
    return new Response(JSON.stringify({ id: "response.synthetic", model: request.model, status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }));
  });
  assert.equal((await result.patient_provider.execute(request)).success, true);
  assert.equal((await result.patient_provider.execute(request)).code, "AI_BUDGET_EXCEEDED");
  assert.equal(calls, 1);
});

test("provider reliability failure cannot create a second question or extra retry budget", async () => {
  let calls = 0;
  const result = prepare({}, async () => { calls++; return new Response("", { status: 503 }); });
  assert.equal((await result.patient_provider.execute(request)).success, false);
  assert.equal((await result.patient_provider.execute(request)).code, "AI_BUDGET_EXCEEDED");
  assert.equal(calls, 2);
});

test("TTS mints only one ttd_websocket token; STT and further minting are unavailable", async () => {
  let calls = 0;
  const result = prepare({}, async (url, options) => {
    calls++; assert.equal(url, "https://api.elevenlabs.io/v1/single-use-token/ttd_websocket");
    assert.equal(options.redirect, "error");
    return Response.json({ token: "synthetic-single-use-token" });
  });
  const broker = result.speech_token_broker;
  const { voice_profile_id: _profile, ...stt } = tokenRequest;
  assert.equal((await broker.issue("principal.synthetic", { ...stt, capability: "STT" }, "idempotency.stt")).success, false);
  const issued = await broker.issue("principal.synthetic", tokenRequest, "idempotency.tts");
  assert.equal(issued.success, true); assert.equal(issued.data.token_type, "ttd_websocket");
  assert.equal((await broker.issue("principal.synthetic", tokenRequest, "idempotency.tts-again")).success, false);
  assert.equal(calls, 1);
});

test("failed TTS issuance remains an explicit failure with no extra live mint attempt", async () => {
  let calls = 0;
  const result = prepare({}, async () => { calls++; throw Error("Synthetic failure"); });
  const broker = result.speech_token_broker;
  assert.equal((await broker.issue("principal.synthetic", tokenRequest, "idempotency.failure")).success, false);
  assert.equal((await broker.issue("principal.synthetic", tokenRequest, "idempotency.failure-again")).success, false);
  assert.equal(calls, 1);
});
