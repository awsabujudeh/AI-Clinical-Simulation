import { describe, it, expect } from "vitest";
import { createMemorySpeechTokenBroker, createAzureSpeechTokenProvider } from "../../../packages/api-core/src/index.ts";
import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { SpeechTokenRequestSchema } from "../../../packages/contracts/src/index.ts";

async function setup() {
  let calls = 0; let now = 1000; let fail = false;
  const broker = createMemorySpeechTokenBroker({ async issue() { calls++; if (fail) throw Error("private provider detail"); return { authorization_token: "synthetic-ephemeral-token", region: "regiontest" }; } }, () => now);
  const h = await createApiTestHarness({ include_stemi: false, speech_token_broker: broker });
  const started = await h.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "idempotency.voice.start" }), body: JSON.stringify(startBody(h.productionPackage.manifest.case_id)) });
  const session = (await started.json() as any).data.session;
  const req = { session_id: session.session_id, locale: "ar-JO", capability: "STT" };
  return { h, session, req, broker, calls: () => calls, now(v: number) { now = v; }, fail() { fail = true; },
    send(body = req, headers: Record<string, string> = apiHeaders({ idempotency: "idempotency.voice.refresh" })) {
      return h.app.request("/v1/voice/token", { method: "POST", headers, body: JSON.stringify(body) });
    } };
}
describe("session-authorized Speech token route", () => {
  it.each(["ar-JO", "en-US"])("issues %s ephemeral token with no clinical side effects", async locale => {
    const t = await setup(); const before = JSON.stringify(t.h.store.sessions.get(t.session.session_id));
    const response = await t.send({ ...t.req, locale });
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json() as any;
    expect(body.data).toMatchObject({ locale, expires_at_ms: 481000 });
    expect(Object.keys(body.data).sort()).toEqual(["authorization_token", "capability", "expires_at_ms", "issued_at_ms", "locale", "region", "session_id", "voice_schema_version"]);
    expect(JSON.stringify(t.h.store.sessions.get(t.session.session_id))).toBe(before);
  });
  it("requires authentication, session ownership, and idempotency before provider call", async () => {
    const t = await setup();
    expect((await t.send(t.req, {})).status).toBe(401);
    expect((await t.send(t.req, apiHeaders({ token: "other-learner", idempotency: "idempotency.voice.other" }))).status).toBe(404);
    expect((await t.send(t.req, apiHeaders())).status).toBe(400);
    expect(t.calls()).toBe(0);
  });
  it("rejects unknown locale and keys", async () => {
    const t = await setup();
    expect((await t.send({ ...t.req, locale: "en" })).status).toBe(400);
    expect((await t.send({ ...t.req, effects: [] } as any)).status).toBe(400);
    expect(t.calls()).toBe(0);
  });
  it("replays one refresh window, conflicts on changed binding, refreshes after expiry", async () => {
    const t = await setup();
    const [a, b] = await Promise.all([t.send(), t.send()]);
    expect(await a.json()).toEqual(await b.json()); expect(t.calls()).toBe(1);
    expect((await t.send({ ...t.req, capability: "TTS" })).status).toBe(409);
    t.now(481001); expect((await t.send()).status).toBe(200); expect(t.calls()).toBe(2);
  });
  it("safe provider failure is bounded and does not leak details", async () => {
    const t = await setup(); t.fail(); const response = await t.send();
    expect(response.status).toBe(503); const text = await response.text();
    expect(text).toContain("VOICE_TOKEN_UNAVAILABLE"); expect(text).not.toContain("private provider");
    await t.send(); expect(t.calls()).toBe(1);
  });
  it("bounds per-session token issuance and rejects prototype-key confusion", async () => {
    const t = await setup();
    for (let i = 0; i < 6; i++) expect((await t.send(t.req, apiHeaders({ idempotency: `idempotency.voice.${i}` }))).status).toBe(200);
    expect((await t.send(t.req, apiHeaders({ idempotency: "constructor" }))).status).toBe(503);
    expect(t.calls()).toBe(6);
  });
  it("rejects malformed provider token rather than returning unbounded credential data", async () => {
    const broker = createMemorySpeechTokenBroker({ async issue() { return { authorization_token: "x".repeat(8193), region: "region" }; } }, () => 100);
    const result = await broker.issue("constructor", SpeechTokenRequestSchema.parse({ session_id: "constructor", locale: "ar-JO", capability: "STT" }), "idempotency.constructor");
    expect(result.success).toBe(false);
  });
  it("Azure server adapter uses fixed regional STS, rejects redirects and sanitizes failures", async () => {
    let captured: RequestInit | undefined;
    const provider = createAzureSpeechTokenProvider({ subscription_key: "synthetic-test-secret-not-real", region: "regiontest",
      fetch: (async (url, init) => { expect(url).toBe("https://regiontest.api.cognitive.microsoft.com/sts/v1.0/issueToken"); captured = init; return new Response("synthetic-access-token"); }) as typeof fetch });
    expect(await provider.issue()).toEqual({ authorization_token: "synthetic-access-token", region: "regiontest" });
    expect(captured?.redirect).toBe("error"); expect(captured?.method).toBe("POST");
    const failing = createAzureSpeechTokenProvider({ subscription_key: "synthetic-test-secret-not-real", region: "regiontest",
      fetch: (async () => { throw Error("private credentials"); }) as typeof fetch });
    await expect(failing.issue()).rejects.toThrow("Speech token unavailable.");
    expect(() => createAzureSpeechTokenProvider({ subscription_key: "synthetic", region: "evil.example/path", fetch })).toThrow();
  });
});
