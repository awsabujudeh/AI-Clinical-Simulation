import { describe, it, expect } from "vitest";
import { createMemorySpeechTokenBroker, createElevenLabsTokenProvider } from "../../../packages/api-core/src/index.ts";
import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { SpeechTokenRequestSchema, SpeechTokenResponseSchema } from "../../../packages/contracts/src/index.ts";
import { SYNTHETIC_VOICE_PROFILE } from "../../fixtures/voice/mock-speech.ts";
async function setup() {
  let calls = 0; let now = 1000; let fail = false; const types: string[] = [];
  const broker = createMemorySpeechTokenBroker({ async issue(type) { types.push(type); calls++;
    if (fail) throw Error("private provider detail"); return { single_use_token: `synthetic-token-${calls}` }; } }, () => now, [SYNTHETIC_VOICE_PROFILE]);
  const h = await createApiTestHarness({ include_stemi: false, speech_token_broker: broker });
  const started = await h.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "start.voice" }), body: JSON.stringify(startBody(h.productionPackage.manifest.case_id)) });
  const session = (await started.json() as any).data.session;
  const req = { session_id: session.session_id, locale: "ar-JO", capability: "STT" };
  return { h, session, req, broker, types, calls: () => calls, now(v: number) { now = v; }, fail() { fail = true; },
    send(body: unknown = req, headers: Record<string, string> = apiHeaders({ idempotency: "issue.voice" })) {
      return h.app.request("/v1/voice/token", { method: "POST", headers, body: JSON.stringify(body) });
    } };
}
describe("authorized single-use speech tokens", () => {
  it.each(["ar-JO", "en-US"])("issues strictly bound %s token without clinical mutation", async locale => {
    const t = await setup(); const before = JSON.stringify([...t.h.store.sessions]);
    const response = await t.send({ ...t.req, locale }); expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const value = SpeechTokenResponseSchema.parse((await response.json() as any).data);
    expect(value).toMatchObject({ provider: "ELEVENLABS", voice_schema_version: "2.0", token_type: "realtime_scribe",
      model_id: "scribe_v2_realtime", language_code: locale === "ar-JO" ? "ar" : "en", expires_at_ms: 901000 });
    expect(JSON.stringify([...t.h.store.sessions])).toBe(before);
  });
  it("auth, Session ownership and issuance key precede provider call", async () => {
    const t = await setup(); expect((await t.send(t.req, {})).status).toBe(401);
    expect((await t.send(t.req, apiHeaders({ token: "other-learner", idempotency: "other.voice" }))).status).toBe(404);
    expect((await t.send(t.req, apiHeaders())).status).toBe(400); expect(t.calls()).toBe(0);
  });
  it.each([{ provider: "OTHER" }, { model_id: "other" }, { api_key: "untrusted" }, { effects: [] }, { locale: "en" }])("rejects override %j", async override => {
    const t = await setup(); expect((await t.send({ ...t.req, ...override })).status).toBe(400); expect(t.calls()).toBe(0);
  });
  it("concurrent duplicates never replay a credential; explicit reconnect gets a fresh token", async () => {
    const t = await setup(); const result = await Promise.all([t.send(), t.send()]);
    expect(result.map(x => x.status).sort()).toEqual([200, 409]); expect(t.calls()).toBe(1);
    expect((await t.send()).status).toBe(409);
    const next = await t.send(t.req, apiHeaders({ idempotency: "reconnect.voice" }));
    expect(next.status).toBe(200); expect((await next.json() as any).data.single_use_token).toBe("synthetic-token-2");
  });
  it("failed/ambiguous issuance leaves a tombstone, not a credential replay", async () => {
    const t = await setup(); t.fail(); const failed = await t.send(); expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private"); expect((await t.send()).status).toBe(409); expect(t.calls()).toBe(1);
  });
  it("trusted TTS profile determines token type/model/voice; arbitrary profile fails", async () => {
    const t = await setup();
    expect((await t.send({ ...t.req, capability: "TTS", voice_profile_id: "voice-profile.unknown" })).status).toBe(503);
    expect(t.calls()).toBe(0);
    const response = await t.send({ ...t.req, capability: "TTS", voice_profile_id: SYNTHETIC_VOICE_PROFILE.profile_id });
    expect(response.status).toBe(200); expect(t.types).toEqual(["tts_websocket"]);
    expect((await response.json() as any).data).toMatchObject({ model_id: "eleven_v3_conversational", voice_id: "syntheticArabicVoice" });
  });
  it("rate limits bound fresh/prototype keys and retain no clinical authority", async () => {
    const t = await setup();
    expect((await t.send(t.req, apiHeaders({ idempotency: "__proto__" }))).status).toBe(400);
    for (const key of ["constructor", "toString", "one", "two", "three", "four"]) expect((await t.send(t.req, apiHeaders({ idempotency: key }))).status).toBe(200);
    expect((await t.send(t.req, apiHeaders({ idempotency: "seven" }))).status).toBe(503); expect(t.calls()).toBe(6);
  });
  it("malformed provider credentials cannot cross response contract", async () => {
    const broker = createMemorySpeechTokenBroker({ async issue() { return { single_use_token: "x".repeat(8193) }; } }, () => 100);
    expect((await broker.issue("constructor", SpeechTokenRequestSchema.parse({ session_id: "constructor", locale: "ar-JO", capability: "STT" }), "constructor")).success).toBe(false);
  });
  it.each(["realtime_scribe", "tts_websocket"] as const)("official %s mint is fixed, no redirects/retries/secrets in output", async type => {
    let calls = 0;
    const provider = createElevenLabsTokenProvider({ api_key: "synthetic-secret", fetch: async (url, init) => {
      calls++; expect(url).toBe(`https://api.elevenlabs.io/v1/single-use-token/${type}`);
      expect(init?.redirect).toBe("error"); expect(init?.method).toBe("POST");
      return Response.json({ token: "synthetic-token", unrelated_account: "discard" });
    } });
    expect(await provider.issue(type)).toEqual({ single_use_token: "synthetic-token" }); expect(calls).toBe(1);
    const failing = createElevenLabsTokenProvider({ api_key: "synthetic-secret", fetch: async () => { throw Error("private"); } });
    await expect(failing.issue(type)).rejects.toThrow("Voice token unavailable.");
  });
});
