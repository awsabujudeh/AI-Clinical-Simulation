import { describe, expect, it, vi } from "vitest";
import { createApiTestHarness, apiHeaders, startBody, actionBody } from "../../fixtures/api/secure-api.ts";
import { fetchAiHttpTransport } from "../../../packages/ai-gateway/src/provider.ts";

async function setup() {
  const h = await createApiTestHarness({ include_stemi: false, enable_clinical_interpreter: true, enable_patient_conversation: true });
  const r = await h.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "key.security.start" }), body: JSON.stringify(startBody(h.productionPackage.manifest.case_id)) });
  const id = (await r.json()).data.session.session_id as string;
  const send = (utterance_id = "utterance.security", text = "Perform the synthetic examination") => h.app.request(`/v1/sessions/${id}/actions/interpret`, {
    method: "POST", headers: apiHeaders(), body: JSON.stringify({ utterance_id, text, locale: "en-US" })
  });
  return { h, id, send };
}
describe("V2-027 provider spend and replay safeguards", () => {
  it("coalesces concurrent interpreter repeats; rejects conflicting reuse without execution", async () => {
    const t = await setup(); const before = JSON.stringify([...t.h.store.sessions]);
    const responses = await Promise.all([t.send(), t.send()]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(await responses[0]!.json()).toEqual(await responses[1]!.json());
    expect((await t.send()).status).toBe(200);
    expect((await t.send("utterance.security", "different text")).status).toBe(409);
    expect(t.h.getInterpreterProviderCalls()).toBe(1);
    expect(JSON.stringify([...t.h.store.sessions])).toBe(before);
  });
  it("retains failed interpreter outcomes; does not make second-chance calls", async () => {
    const t = await setup(); t.h.setInterpreterOutput({ patient_state: { cured: true } });
    expect((await t.send()).status).toBe(422); expect((await t.send()).status).toBe(422);
    expect(t.h.getInterpreterProviderCalls()).toBe(1);
  });
  it("does not replay an interpretation against a newer authoritative state", async () => {
    const t = await setup(); expect((await t.send()).status).toBe(200);
    const r = await t.h.app.request(`/v1/sessions/${t.id}/actions/propose`, { method: "POST",
      headers: apiHeaders({ idempotency: "key.execute" }), body: JSON.stringify(actionBody(0)) });
    expect(r.status).toBe(200); expect((await t.send()).status).toBe(409);
    expect(t.h.getInterpreterProviderCalls()).toBe(1);
  });
  it("bounds fresh interpreter identities at 64, without changing deterministic state", async () => {
    const t = await setup(); const before = JSON.stringify([...t.h.store.sessions]);
    for (let i = 0; i < 64; i++) expect((await t.send(`utterance.${i}`)).status).toBe(200);
    const blocked = await t.send("utterance.65"); expect(blocked.status).toBe(503);
    expect((await blocked.json()).error).toMatchObject({ code: "AI_REQUEST_LIMIT_REACHED", retryable: false });
    expect((await t.send("utterance.0")).status).toBe(200); expect(t.h.getInterpreterProviderCalls()).toBe(64);
    expect(JSON.stringify([...t.h.store.sessions])).toBe(before);
  }, 30000);
  it("bounds Patient claims at 64 but preserves exact durable replay and state", async () => {
    const t = await setup(); const before = JSON.stringify(t.h.store.sessions.get(t.id)!.patient_state);
    const send = (i: number) => t.h.app.request(`/v1/sessions/${t.id}/questions`, { method: "POST",
      headers: apiHeaders({ idempotency: `key.question-${i}` }),
      body: JSON.stringify({ text: "How do you feel?", locale: "en-US", source: "TEXT", utterance_id: `utterance.${i}` }) });
    for (let i = 0; i < 64; i++) expect((await send(i)).status).toBe(200);
    const events = t.h.store.sessions.get(t.id)!.committed_events.length;
    expect((await send(64)).status).toBe(503);
    expect((await (await send(0)).json()).data.replayed).toBe(true);
    expect(t.h.getPatientProviderCalls()).toBe(64);
    expect(t.h.store.sessions.get(t.id)!.committed_events).toHaveLength(events);
    expect(JSON.stringify(t.h.store.sessions.get(t.id)!.patient_state)).toBe(before);
  }, 30000);
  it("the default trusted transport refuses redirects without a real provider request", async () => {
    const fake = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.redirect).toBe("error"); throw Error("synthetic redirect refused");
    });
    vi.stubGlobal("fetch", fake);
    try {
      await expect(fetchAiHttpTransport.send({ url: "https://api.openai.com/v1/responses", method: "POST",
        headers: { Authorization: "Bearer synthetic-only" }, body: "{}", signal: new AbortController().signal })).rejects.toThrow("synthetic redirect refused");
      expect(fake).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
