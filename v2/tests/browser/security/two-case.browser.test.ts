import { describe, expect, it } from "vitest";
import { twoCaseHarness, twoCaseSecuritySnapshot, TWO_CASE_SECURITY_EXPECTED } from "../../fixtures/security/two-case.ts";
import { apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { createSecureApiApp } from "../../../packages/api-core/src/index.ts";
import { createDanaReviewSession } from "../../../runtime/v2-026-review-composition.ts";

describe("V2-027 two-case adversarial API boundary", () => {
  it("Dana's actual review composition binds TTS to its boot-created Session only", async () => {
    let calls = 0;
    const review = await createDanaReviewSession({ namespace: "security-composition", voice_profile_id: "voice-profile.dana-security",
      patient_provider: { async execute() { throw Error("No question authorized in this test"); } },
      speech_token_broker: { async issue() { calls++; return { success: false, error: {
        code: "SYNTHETIC_ISSUANCE_PROBE", http_status: 503, message_key: "api.error.voice-token-unavailable", retryable: false } }; } }
    });
    const send = (voice_profile_id: string) => review.h.app.request("/v1/voice/token", { method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: "key.composition" }),
      body: JSON.stringify({ session_id: review.sessionId, locale: "ar-JO", capability: "TTS", voice_profile_id }) });
    expect((await send("voice-profile.stemi-security")).status).toBe(403); expect(calls).toBe(0);
    expect((await send("voice-profile.dana-security")).status).toBe(503); expect(calls).toBe(1);
  });
  it("pins patient/visual/result/voice identity in both directions (Browser/Deno snapshot)", async () => {
    expect(await twoCaseSecuritySnapshot()).toEqual(TWO_CASE_SECURITY_EXPECTED);
  });
  it("unknown binding fails closed even with a valid broker profile", async () => {
    const { cases, tokenCalls } = await twoCaseHarness(); const c = cases[0]!;
    const app = createSecureApiApp({ ...c.h.dependencies, resolve_voice_profile: undefined });
    const response = await app.request("/v1/voice/token", { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "key.unbound" }),
      body: JSON.stringify({ session_id: c.sessionId, locale: "ar-JO", capability: "TTS", voice_profile_id: c.profile.profile_id }) });
    expect(response.status).toBe(403); expect(tokenCalls()).toBe(0);
  });
  it("private API responses and authentication failures are explicitly non-cacheable", async () => {
    const { cases } = await twoCaseHarness(); const c = cases[0]!;
    for (const token of ["faculty", "invalid"]) {
      const response = await c.h.app.request(`/v1/sessions/${c.sessionId}/state`, { headers: apiHeaders({ token }) });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
  });
  it("keeps both real Cases review-only and forbids learner/cross-institution elevation", async () => {
    const { cases } = await twoCaseHarness();
    for (const c of cases) {
      expect(c.artifact.source_case.manifest.status).toBe("UNDER_REVIEW");
      const before = JSON.stringify([...c.h.store.sessions]);
      for (const token of ["learner", "cross-reviewer"]) {
        const r = await c.h.app.request("/v1/review-sessions", { method: "POST", headers: apiHeaders({ token, idempotency: "key.elevate" }),
          body: JSON.stringify(startBody(c.artifact.source_case.manifest.case_id)) });
        expect(r.status).not.toBe(201);
      }
      const published = await c.h.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "key.publish" }),
        body: JSON.stringify(startBody(c.artifact.source_case.manifest.case_id)) });
      expect(published.status).toBe(404);
      expect(JSON.stringify([...c.h.store.sessions])).toBe(before);
    }
  });
  it("rejects client-authored clinical/assessment/publication data before mutation", async () => {
    const { cases } = await twoCaseHarness();
    for (const c of cases) {
      const before = JSON.stringify([...c.h.store.sessions]);
      const action = { command_id: "command.security", action_request_id: "action-request.security", action_id: "action.unknown",
        expected_state_version: 0, parameters: {}, source: "UI" };
      for (const extra of [{ vitals: { heart_rate: 1 } }, { patient_state: {} }, { diagnosis: "cured" }, { result: {} },
        { effects: [] }, { outcome_flags: ["improved"] }, { score: 100 }, { critical_actions: [] }, { status: "PUBLISHED" }]) {
        const r = await c.h.app.request(`/v1/sessions/${c.sessionId}/actions/propose`, { method: "POST",
          headers: apiHeaders({ token: "faculty", idempotency: "key.malicious" }), body: JSON.stringify({ ...action, ...extra }) });
        expect(r.status).toBe(400);
      }
      expect(JSON.stringify([...c.h.store.sessions])).toBe(before);
    }
  });
  it("unsupported AI mutation falls back; Patient contexts and transcript stay Case-local", async () => {
    const { cases } = await twoCaseHarness();
    for (const c of cases) {
      const before = JSON.stringify(c.h.store.sessions.get(c.sessionId)!.patient_state);
      const request = { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "key.question" }),
        body: JSON.stringify({ text: "كيف بتحسي؟", locale: "ar-JO", source: "TEXT", utterance_id: "utterance.security" }) };
      const path = `/v1/sessions/${c.sessionId}/questions`;
      const response = await c.h.app.request(path, request); expect(response.status).toBe(200);
      const result = (await response.json()).data;
      expect(result.turn.fallback_used).toBe(true);
      expect(c.contexts).toHaveLength(1);
      expect(c.contexts[0]).toContain(`fact.${c.name}.`);
      expect(c.contexts[0]).not.toContain(`fact.${c.name === "dana" ? "stemi" : "dana"}.`);
      expect((await (await c.h.app.request(path, request)).json()).data.replayed).toBe(true);
      expect(c.contexts).toHaveLength(1);
      expect(JSON.stringify(c.h.store.sessions.get(c.sessionId)!.patient_state)).toBe(before);
    }
  });
  it("unauthenticated/foreign callers cannot invoke any provider route", async () => {
    const { cases, tokenCalls } = await twoCaseHarness();
    for (const c of cases) for (const token of ["invalid", "other-learner", "cross-reviewer"]) {
      for (const [path, payload] of [
        [`/v1/sessions/${c.sessionId}/questions`, { text: "hello", locale: "ar-JO", source: "TEXT", utterance_id: "utterance.security" }],
        ["/v1/voice/token", { session_id: c.sessionId, locale: "ar-JO", capability: "TTS", voice_profile_id: c.profile.profile_id }],
        [`/v1/sessions/${c.sessionId}/debriefs`, { locale: "en-US" }]
      ] as const) {
        expect((await c.h.app.request(path, { method: "POST", headers: apiHeaders({ token, idempotency: "key.denied" }), body: JSON.stringify(payload) })).status).toBe(token === "invalid" ? 401 : 404);
      }
      expect(c.contexts).toHaveLength(0);
    }
    expect(tokenCalls()).toBe(0);
  });
});
