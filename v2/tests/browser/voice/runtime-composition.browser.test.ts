import { describe, expect, it } from "vitest";
import { createElevenLabsSecureApi, readElevenLabsRuntimeConfig } from "../../../packages/api-core/src/index.ts";
import { actionBody, apiHeaders, createApiTestHarness, startBody } from "../../fixtures/api/secure-api.ts";
describe("trusted speech runtime", () => {
  const fakeKey = "synthetic-runtime-key-not-a-credential";
  it("reads only the server key and does not log/serialize configuration in diagnostics", () => {
    const names: string[] = [];
    const config = readElevenLabsRuntimeConfig(name => { names.push(name); return fakeKey; });
    expect(names).toEqual(["ELEVENLABS_API_KEY"]); expect(config.success).toBe(true);
    if (!config.success) throw Error(); expect(Object.isFrozen(config.config)).toBe(true);
  });
  it.each([undefined, "", " \t"] )("missing key fails closed: %s", key => {
    expect(readElevenLabsRuntimeConfig(() => key)).toEqual({ success: false, code: "VOICE_KEY_REQUIRED" });
  });
  it("getter exception is sanitized", () => {
    expect(readElevenLabsRuntimeConfig(() => { throw Error(fakeKey); })).toEqual({ success: false, code: "VOICE_ENVIRONMENT_UNAVAILABLE" });
  });
  it.each([true, false])("configuration %s preserves auth and nonvoice API behavior", async configured => {
    const h = await createApiTestHarness({ include_stemi: false }); let calls = 0;
    const root = createElevenLabsSecureApi({ dependencies: h.dependencies, now: () => 1000,
      getEnv: () => configured ? fakeKey : undefined,
      fetch: async (url, init) => { calls++; expect(url).toBe("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
        expect(new Headers(init?.headers).get("xi-api-key")).toBe(fakeKey); expect(init?.redirect).toBe("error");
        return Response.json({ token: "synthetic-token" }); } });
    expect(calls).toBe(0);
    const response = await root.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "start.voice" }),
      body: JSON.stringify(startBody(h.productionPackage.manifest.case_id)) });
    const session = (await response.json() as any).data.session;
    const req = { session_id: session.session_id, locale: "ar-JO", capability: "STT" };
    const token = (headers: Record<string, string>) => root.app.request("/v1/voice/token", { method: "POST", headers, body: JSON.stringify(req) });
    expect((await token({})).status).toBe(401);
    expect((await token(apiHeaders({ token: "other-learner", idempotency: "other.voice" }))).status).toBe(404);
    expect(calls).toBe(0);
    const before = JSON.stringify([...h.store.sessions]);
    const issued = await token(apiHeaders({ idempotency: "issue.voice" }));
    expect(issued.status).toBe(configured ? 200 : 503); expect(await issued.text()).not.toContain(fakeKey);
    expect(JSON.stringify([...h.store.sessions])).toBe(before);
    expect((await root.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST", headers: apiHeaders({ idempotency: "manual.voice" }), body: JSON.stringify(actionBody(session.state_version)) })).status).toBe(200);
    expect(calls).toBe(configured ? 1 : 0);
  });
});
