import { describe, expect, it } from "vitest";

import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";

async function startInterpreterSession() {
  const harness = await createApiTestHarness({ enable_clinical_interpreter: true });
  const response = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: "idempotency.interpreter.start" }),
    body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id))
  });
  const body = await response.json() as { data: { session: { session_id: string } } };
  return { harness, sessionId: body.data.session.session_id };
}

function interpretationBody(overrides: Record<string, unknown> = {}) {
  return {
    text: "Perform the synthetic examination",
    locale: "en-US",
    utterance_id: "utterance.interpreter.001",
    ...overrides
  };
}

describe("V2-019B1 secure Clinical Interpreter API", () => {
  it("authorizes the Session and returns a non-authoritative pinned-catalogue match", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, {
      method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody())
    });
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.data.interpretation).toMatchObject({ authority: "NON_AUTHORITATIVE", status: "MATCH", candidate: { action_id: "examination.synthetic-check" } });
    expect(body.data.grounded_state_version).toBe(0);
    expect(harness.getInterpreterProviderCalls()).toBe(1);
  });

  it("does not mutate Patient State, Clinical Time, events, or action execution", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    const before = JSON.stringify(harness.store.sessions.get(sessionId));
    const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, {
      method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody())
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(harness.store.sessions.get(sessionId))).toBe(before);
  });

  it("fails closed as NO_MATCH when the provider proposes an unlisted action", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    harness.setInterpreterOutput({ output_schema_version: "2.0", status: "MATCH", ambiguity_reason: null, no_match_reason: null, candidates: [{ action_id: "procedure.hidden-action", parameters: [] }] });
    const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody()) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.interpretation).toMatchObject({ status: "NO_MATCH", no_match_reason: "UNAVAILABLE_ACTION" });
  });

  it("rejects malformed provider output through second local validation", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    harness.setInterpreterOutput({ output_schema_version: "2.0", status: "MATCH", ambiguity_reason: null, no_match_reason: null, candidates: [{ action_id: "examination.synthetic-check", parameters: [], execute: true }] });
    const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody()) });
    expect(response.status).toBe(422);
  });

  it("rejects browser model, prompt, schema, tool, and effect injection", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    for (const field of ["model", "prompt", "schema", "tools", "effects", "patient_state"]) {
      const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody({ [field]: true })) });
      expect(response.status).toBe(400);
    }
    expect(harness.getInterpreterProviderCalls()).toBe(0);
  });

  it("denies unauthenticated, disabled-member, foreign-user, and cross-tenant access before provider use", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    const requests = [
      apiHeaders({ token: "invalid" }),
      apiHeaders({ token: "inactive" }),
      apiHeaders({ token: "other-learner" }),
      apiHeaders({ token: "cross-reviewer" })
    ];
    const statuses = [];
    for (const headers of requests) {
      const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers, body: JSON.stringify(interpretationBody()) });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([401, 401, 404, 404]);
    expect(harness.getInterpreterProviderCalls()).toBe(0);
  });

  it("denies ended Sessions before provider use", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    const session = harness.store.sessions.get(sessionId)!;
    const finalized = await harness.app.request(`/v1/sessions/${sessionId}/end`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.interpreter.end" }),
      body: JSON.stringify({
        expected_state_version: session.patient_state.state_version,
        reason: "LEARNER_COMPLETED"
      })
    });
    expect(finalized.status).toBe(200);
    const response = await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody()) });
    expect(response.status).toBe(409);
    expect(harness.getInterpreterProviderCalls()).toBe(0);
  });

  it("keeps REVIEW_ONLY STEMI unavailable to a production learner", async () => {
    const harness = await createApiTestHarness({ include_stemi: true, enable_clinical_interpreter: true });
    const response = await harness.app.request("/v1/review-sessions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.interpreter.review" }),
      body: JSON.stringify(startBody(harness.reviewArtifact!.source_case.manifest.case_id))
    });
    expect(response.status).toBe(403);
    expect(harness.getInterpreterProviderCalls()).toBe(0);
  });

  it("returns unavailable without fabricating a candidate when capability is absent", async () => {
    const harness = await createApiTestHarness();
    const start = await harness.app.request("/v1/sessions", { method: "POST", headers: apiHeaders({ idempotency: "idempotency.interpreter.absent" }), body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id)) });
    const body = await start.json() as any;
    const response = await harness.app.request(`/v1/sessions/${body.data.session.session_id}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody()) });
    expect(response.status).toBe(503);
  });

  it("keeps final execution exclusively on the existing actions/propose route", async () => {
    const { harness, sessionId } = await startInterpreterSession();
    await harness.app.request(`/v1/sessions/${sessionId}/actions/interpret`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(interpretationBody()) });
    expect(harness.store.sessions.get(sessionId)?.committed_events).toHaveLength(0);
    const proposed = await harness.app.request(`/v1/sessions/${sessionId}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.interpreter.execute" }),
      body: JSON.stringify({ command_id: "command.interpreter.execute", action_request_id: "action-request.interpreter.execute", action_id: "examination.synthetic-check", expected_state_version: 0, parameters: {}, source: "NATURAL_LANGUAGE" })
    });
    expect(proposed.status).toBe(200);
    expect(harness.store.sessions.get(sessionId)?.committed_events.length).toBeGreaterThan(0);
  });
});
