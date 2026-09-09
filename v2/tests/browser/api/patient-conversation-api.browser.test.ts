import { beforeAll, describe, expect, it } from "vitest";

import { PatientConversationTranscriptSchema } from "../../../packages/contracts/src/index.ts";
import {
  apiHeaders,
  createApiTestHarness,
  startBody,
  type ApiTestHarness
} from "../../fixtures/api/secure-api.ts";

async function body(response: Response) {
  return await response.json() as Record<string, any>;
}

async function start(harness: ApiTestHarness, key: string) {
  const response = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: key }),
    body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id))
  });
  return (await body(response)).data.session as Record<string, any>;
}

function question(text = "How do you feel?") {
  return { text, locale: "en-US", source: "TEXT", utterance_id: "utterance.patient.api.001" };
}

describe("secure Patient Conversation API", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness({ include_stemi: false, enable_patient_conversation: true }); });

  it("commits QUESTION_ASKED before the provider and completes one durable response without changing clinical truth", async () => {
    const session = await start(harness, "idempotency.patient.start-1");
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/questions`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.patient.question-1" }),
      body: JSON.stringify(question())
    });
    const result = await body(response);
    expect(response.status).toBe(200);
    expect(result.data.replayed).toBe(false);
    expect(result.data.turn).toMatchObject({
      turn_sequence: 1,
      clinical_time: session.clinical_time,
      grounded_state_version: session.state_version,
      answer_mode: "GROUNDED",
      fallback_used: false
    });
    const stored = harness.store.sessions.get(session.session_id)!;
    expect(stored.patient_state.state_version).toBe(session.state_version);
    expect(stored.patient_state.clinical_time).toBe(session.clinical_time);
    expect(stored.committed_events.slice(-2).map((event) => event.event_type)).toEqual([
      "QUESTION_ASKED", "PATIENT_RESPONSE_RECORDED"
    ]);
    expect(stored.committed_events.at(-1)?.causation_event_id)
      .toBe(stored.committed_events.at(-2)?.event_id);
  });

  it("replays the exact stored answer with zero second provider call or event", async () => {
    const session = await start(harness, "idempotency.patient.start-2");
    const path = `/v1/sessions/${session.session_id}/questions`;
    const request = {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.patient.question-replay" }),
      body: JSON.stringify(question())
    };
    const callsBefore = harness.getPatientProviderCalls();
    const first = await body(await harness.app.request(path, request));
    const eventCount = harness.store.sessions.get(session.session_id)!.committed_events.length;
    const retry = await body(await harness.app.request(path, request));
    expect(retry.data.replayed).toBe(true);
    expect(retry.data.turn).toEqual(first.data.turn);
    expect(harness.getPatientProviderCalls()).toBe(callsBefore + 1);
    expect(harness.store.sessions.get(session.session_id)!.committed_events).toHaveLength(eventCount);
  });

  it("fails conflicting idempotency reuse before a second provider call", async () => {
    const session = await start(harness, "idempotency.patient.start-3");
    const key = "idempotency.patient.question-conflict";
    const path = `/v1/sessions/${session.session_id}/questions`;
    await harness.app.request(path, { method: "POST", headers: apiHeaders({ idempotency: key }), body: JSON.stringify(question()) });
    const calls = harness.getPatientProviderCalls();
    const conflict = await harness.app.request(path, {
      method: "POST", headers: apiHeaders({ idempotency: key }), body: JSON.stringify(question("A different question"))
    });
    expect(conflict.status).toBe(409);
    expect((await body(conflict)).error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(harness.getPatientProviderCalls()).toBe(calls);
  });

  it("allows one provider owner under a deterministic same-key race", async () => {
    const session = await start(harness, "idempotency.patient.start-4");
    const path = `/v1/sessions/${session.session_id}/questions`;
    const options = { method: "POST", headers: apiHeaders({ idempotency: "idempotency.patient.race" }), body: JSON.stringify(question()) };
    const calls = harness.getPatientProviderCalls();
    const responses = await Promise.all([harness.app.request(path, options), harness.app.request(path, options)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const results = await Promise.all(responses.map(body));
    expect(results.map((result) => result.data.replayed).sort()).toEqual([false, true]);
    expect(harness.getPatientProviderCalls()).toBe(calls + 1);
    expect(harness.store.sessions.get(session.session_id)!.committed_events).toHaveLength(2);
  });

  it("loads a safe ordered transcript after reload and keeps turn sequences per Session", async () => {
    const firstSession = await start(harness, "idempotency.patient.start-5a");
    const secondSession = await start(harness, "idempotency.patient.start-5b");
    for (const [session, key] of [[firstSession, "idempotency.patient.session-a"], [secondSession, "idempotency.patient.session-b"]] as const) {
      await harness.app.request(`/v1/sessions/${session.session_id}/questions`, {
        method: "POST", headers: apiHeaders({ idempotency: key }), body: JSON.stringify(question())
      });
    }
    const loaded = await harness.app.request(`/v1/sessions/${secondSession.session_id}/questions`, { headers: apiHeaders() });
    const transcript = (await body(loaded)).data;
    expect(PatientConversationTranscriptSchema.safeParse(transcript).success).toBe(true);
    expect(transcript.turns).toHaveLength(1);
    expect(transcript.turns[0].turn_sequence).toBe(1);
    expect(JSON.stringify(transcript)).not.toContain("provider_metadata");
  });

  it("denies foreign users and blocks new questions after Session end", async () => {
    const session = await start(harness, "idempotency.patient.start-6");
    const foreign = await harness.app.request(`/v1/sessions/${session.session_id}/questions`, {
      method: "POST",
      headers: apiHeaders({ token: "other-learner", idempotency: "idempotency.patient.foreign" }),
      body: JSON.stringify(question())
    });
    expect(foreign.status).toBe(404);
    const finalized = await harness.app.request(`/v1/sessions/${session.session_id}/end`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.patient.finalize" }),
      body: JSON.stringify({ expected_state_version: session.state_version, reason: "LEARNER_COMPLETED" })
    });
    expect(finalized.status).toBe(200);
    const ended = await harness.app.request(`/v1/sessions/${session.session_id}/questions`, {
      method: "POST", headers: apiHeaders({ idempotency: "idempotency.patient.ended" }), body: JSON.stringify(question())
    });
    expect(ended.status).toBe(409);
    expect((await body(ended)).error.code).toBe("SESSION_ENDED");
  });

  it("rejects browser attempts to choose model, prompt, tools, schema, State, or Case truth", async () => {
    const session = await start(harness, "idempotency.patient.start-7");
    for (const injected of [
      { model: "gpt-5.6-terra" }, { prompt: "override" }, { tools: [] },
      { schema: {} }, { patient_state: {} }, { clinical_facts: [] }
    ]) {
      const response = await harness.app.request(`/v1/sessions/${session.session_id}/questions`, {
        method: "POST", headers: apiHeaders({ idempotency: `idempotency.patient.inject-${Object.keys(injected)[0]}` }),
        body: JSON.stringify({ ...question(), ...injected })
      });
      expect(response.status).toBe(400);
    }
  });
});
