import { describe, expect, it } from "vitest";
import { createAzureSpeechSecureApi, readAzureSpeechRuntimeConfig } from "../../../packages/api-core/src/index.ts";
import { SpeechTokenResponseSchema } from "../../../packages/contracts/src/voice.ts";
import { actionBody, apiHeaders, createApiTestHarness, startBody } from "../../fixtures/api/secure-api.ts";

const fakeKey = "synthetic-runtime-key-not-a-credential";
const env = (key: string | undefined = fakeKey, region: string | undefined = "uaenorth") =>
  (name: string) => name === "AZURE_SPEECH_KEY" ? key : name === "AZURE_SPEECH_REGION" ? region : undefined;

describe("trusted Azure runtime configuration", () => {
  it("reads exactly two names, normalizes region and preserves secret without exposing it in diagnostics", () => {
    const reads: string[] = [];
    const result = readAzureSpeechRuntimeConfig(name => { reads.push(name); return env(fakeKey, " UAENORTH ")(name); });
    expect(result.success).toBe(true);
    if (!result.success) throw Error("Synthetic configuration rejected");
    expect(result.config.region).toBe("uaenorth");
    expect(result.config.subscription_key === fakeKey).toBe(true);
    expect(Object.isFrozen(result.config)).toBe(true);
    expect(reads).toEqual(["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]);
  });
  it.each([undefined, "", " \t\n"])("missing/blank key fails closed: %s", key => {
    expect(readAzureSpeechRuntimeConfig(name => name === "AZURE_SPEECH_KEY" ? key : "uaenorth"))
      .toEqual({ success: false, code: "AZURE_SPEECH_KEY_REQUIRED" });
  });
  it.each([undefined, "", " \t\n"])("missing/blank region fails closed: %s", region => {
    const result = readAzureSpeechRuntimeConfig(name => name === "AZURE_SPEECH_KEY" ? fakeKey : region);
    expect(result).toEqual({ success: false, code: "AZURE_SPEECH_REGION_REQUIRED" });
    expect(JSON.stringify(result).includes(fakeKey)).toBe(false);
  });
  it.each(["https://evil.invalid", "uaenorth/../elsewhere", "a", "region.test"])("invalid region cannot select an endpoint: %s", region => {
    expect(readAzureSpeechRuntimeConfig(env(fakeKey, region))).toEqual({ success: false, code: "AZURE_SPEECH_REGION_INVALID" });
  });
  it("getter exception is safe and does not escape or reveal its message", () => {
    const result = readAzureSpeechRuntimeConfig(() => { throw Error(fakeKey); });
    expect(result).toEqual({ success: false, code: "AZURE_SPEECH_ENVIRONMENT_UNAVAILABLE" });
    expect(JSON.stringify(result).includes(fakeKey)).toBe(false);
  });
});

describe("existing secure API with trusted voice composition", () => {
  async function setup(configured: boolean) {
    const h = await createApiTestHarness({ include_stemi: false });
    let calls = 0;
    const root = createAzureSpeechSecureApi({ dependencies: h.dependencies,
      getEnv: configured ? env() : () => undefined, now: () => 1000,
      fetch: (async (url, init) => {
        calls++;
        expect(url).toBe("https://uaenorth.api.cognitive.microsoft.com/sts/v1.0/issueToken");
        expect(init?.method).toBe("POST"); expect(init?.redirect).toBe("error");
        expect(new Headers(init?.headers).get("Ocp-Apim-Subscription-Key") === fakeKey).toBe(true);
        return new Response("synthetic-short-lived-token");
      }) as typeof fetch });
    expect(calls).toBe(0);
    const started = await root.app.request("/v1/sessions", { method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.composition.start" }),
      body: JSON.stringify(startBody(h.productionPackage.manifest.case_id)) });
    expect(started.status).toBe(201);
    const session = (await started.json() as any).data.session;
    const body = { session_id: session.session_id, locale: "ar-JO", capability: "STT" };
    return { root, h, session, calls: () => calls,
      token(headers: Record<string, string> = apiHeaders({ idempotency: "idempotency.composition.token" })) {
        return root.app.request("/v1/voice/token", { method: "POST", headers, body: JSON.stringify(body) });
      }
    };
  }
  it("injects the regional provider through the protected broker; returns no key/config and preserves state", async () => {
    const t = await setup(true);
    expect(t.root.voice).toEqual({ available: true });
    const before = JSON.stringify([...t.h.store.sessions]);
    expect((await t.token({})).status).toBe(401);
    expect((await t.token(apiHeaders({ token: "other-learner", idempotency: "idempotency.other" }))).status).toBe(404);
    expect(t.calls()).toBe(0);
    const response = await t.token(); expect(response.status).toBe(200);
    const text = await response.text(); expect(text.includes(fakeKey)).toBe(false);
    expect(text).not.toContain("subscription_key"); expect(text).not.toContain("AZURE_SPEECH_KEY");
    const token = SpeechTokenResponseSchema.parse(JSON.parse(text).data);
    expect(token.region).toBe("uaenorth"); expect(token.expires_at_ms - token.issued_at_ms).toBe(480_000);
    expect(SpeechTokenResponseSchema.safeParse({ ...token, subscription_key: fakeKey }).success).toBe(false);
    await t.token(); expect(t.calls()).toBe(1);
    expect(JSON.stringify([...t.h.store.sessions])).toBe(before);
  });
  it("absent voice configuration leaves authorized Session read/manual text action paths usable", async () => {
    const t = await setup(false);
    expect(t.root.voice).toEqual({ available: false, code: "AZURE_SPEECH_KEY_REQUIRED" });
    expect((await t.token()).status).toBe(503); expect(t.calls()).toBe(0);
    expect((await t.root.app.request(`/v1/sessions/${t.session.session_id}/state`, { headers: apiHeaders() })).status).toBe(200);
    expect((await t.root.app.request(`/v1/sessions/${t.session.session_id}/actions/propose`, {
      method: "POST", headers: apiHeaders({ idempotency: "idempotency.composition.manual" }),
      body: JSON.stringify(actionBody(t.session.state_version))
    })).status).toBe(200);
    expect(t.calls()).toBe(0);
  });
});
