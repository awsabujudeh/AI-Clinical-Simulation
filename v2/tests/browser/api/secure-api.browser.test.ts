import { beforeAll, describe, expect, it } from "vitest";

import {
  API_REQUEST_BODY_LIMIT_BYTES,
  createSupabaseJwtVerifier
} from "../../../packages/api-core/src/index.ts";
import {
  API_V1_SCHEMA_VERSION,
  ApiErrorResponseSchema,
  SafeSessionProjectionSchema,
  StartSessionRequestSchema,
  SubmitClinicalActionRequestSchema,
  SubmitQuestionRequestSchema
} from "../../../packages/contracts/src/index.ts";
import {
  actionBody,
  apiHeaders,
  createApiTestHarness,
  startBody,
  type ApiTestHarness
} from "../../fixtures/api/secure-api.ts";
import { STEMI_PORTABILITY_SNAPSHOT_SHA256 } from "../../fixtures/cases/stemi-review.ts";

const EXPECTED_STEMI_REVIEW_SUBJECT_HASH =
  "46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f";
const EXPECTED_STEMI_REVIEW_EXECUTION_HASH =
  "a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7";

async function json(response: Response) {
  return await response.json() as Record<string, any>;
}

async function start(harness: ApiTestHarness, input?: {
  key?: string;
  token?: string;
  body?: Record<string, unknown>;
  review?: boolean;
}) {
  const artifact = input?.review ? harness.reviewArtifact : harness.productionPackage;
  if (artifact === undefined) throw new Error("Missing requested test artifact.");
  const caseId = "package_hash" in artifact
    ? artifact.manifest.case_id
    : artifact.source_case.manifest.case_id;
  const response = await harness.app.request(input?.review ? "/v1/review-sessions" : "/v1/sessions", {
    method: "POST",
    headers: apiHeaders({
      token: input?.token,
      idempotency: input?.key ?? "idempotency.api.start-001"
    }),
    body: JSON.stringify(input?.body ?? startBody(caseId))
  });
  return { response, body: await json(response) };
}

describe("V2-013 shared transport contracts", () => {
  it("pins the API schema version independently of Case versions", () => {
    expect(API_V1_SCHEMA_VERSION).toBe("1.0");
  });

  it("strictly rejects authority-bearing start fields", () => {
    expect(StartSessionRequestSchema.safeParse({
      ...startBody("case.synthetic.neutral"),
      user_id: "10000000-0000-4000-8000-000000000099"
    }).success).toBe(false);
    expect(StartSessionRequestSchema.safeParse({
      ...startBody("case.synthetic.neutral"),
      role: "ADMIN"
    }).success).toBe(false);
    expect(StartSessionRequestSchema.safeParse({
      ...startBody("case.synthetic.neutral"),
      institution_id: "just"
    }).success).toBe(false);
  });

  it("rejects clinical outcome authority in action requests", () => {
    for (const forbidden of [
      { patient_state: {} }, { vitals: {} }, { effects: [] }, { score: 100 },
      { clinical_time: 500 }, { event_sequence: 4 }, { execution_status: "EXECUTED" },
      { package_hash: "a".repeat(64) }, { role: "FACULTY" }
    ]) {
      expect(SubmitClinicalActionRequestSchema.safeParse({ ...actionBody(), ...forbidden }).success)
        .toBe(false);
    }
  });

  it("strictly validates the future Patient question envelope", () => {
    expect(SubmitQuestionRequestSchema.safeParse({
      text: "How do you feel?",
      locale: "en-US",
      source: "TEXT",
      utterance_id: "utterance.api.001"
    }).success).toBe(true);
    expect(SubmitQuestionRequestSchema.safeParse({
      text: "x",
      locale: "en",
      source: "TEXT",
      utterance_id: "utterance.api.001"
    }).success).toBe(false);
    expect(SubmitQuestionRequestSchema.safeParse({
      text: "x".repeat(4_001),
      locale: "en-US",
      source: "TEXT",
      utterance_id: "utterance.api.001"
    }).success).toBe(false);
  });
});

describe("V2-013 HTTP authentication, validation, and transport safety", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness({ include_stemi: false }); });

  it("starts as a local Edge-compatible Hono fetch application", async () => {
    const response = await harness.app.request("/health");
    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({ status: "OK", api_version: "v1" });
  });

  it("denies anonymous private access without leaking resource existence", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/state", {
      headers: {
        "X-Api-Schema-Version": "1.0",
        "X-Request-Id": "request.api.anon",
        "X-Correlation-Id": "correlation.api.anon"
      }
    });
    expect(response.status).toBe(401);
    expect((await json(response)).error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("does not accept an arbitrary decoded or malformed token", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/state", {
      headers: apiHeaders({ token: "forged" })
    });
    expect(response.status).toBe(401);
  });

  it("rejects inactive identity before resource authorization", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/state", {
      headers: apiHeaders({ token: "inactive" })
    });
    expect(response.status).toBe(401);
  });

  it("rejects unsupported API versions", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/state", {
      headers: apiHeaders({ version: "2.0" })
    });
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("API_VERSION_UNSUPPORTED");
  });

  it("returns a safe deterministic error when request identity headers are malformed", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/state", {
      headers: {
        ...apiHeaders(),
        "X-Request-Id": "<invalid request>",
        "X-Correlation-Id": "<invalid correlation>"
      }
    });
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body.request_id).toBe("request.unavailable");
    expect(body.error.correlation_id).toBe("correlation.unavailable");
    expect(ApiErrorResponseSchema.safeParse(body).success).toBe(true);
  });

  it("rejects malformed JSON and wrong content type", async () => {
    const malformed = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.malformed" }),
      body: "{"
    });
    expect(malformed.status).toBe(400);
    const wrongType = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: { ...apiHeaders({ idempotency: "idempotency.api.type" }), "Content-Type": "text/plain" },
      body: "{}"
    });
    expect(wrongType.status).toBe(415);
  });

  it("rejects unsupported methods deterministically", async () => {
    const response = await harness.app.request("/v1/sessions", {
      method: "PUT",
      headers: apiHeaders()
    });
    expect(response.status).toBe(400);
  });

  it("exposes only the frozen clinical-action proposal path", async () => {
    const response = await harness.app.request("/v1/sessions/session.unknown/actions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.old-action-path" }),
      body: JSON.stringify(actionBody())
    });
    expect(response.status).toBe(404);
  });

  it("enforces a 16 KiB request body limit", async () => {
    const response = await harness.app.request("/v1/faculty/cases", {
      method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: "idempotency.api.large" }),
      body: JSON.stringify({ value: "x".repeat(API_REQUEST_BODY_LIMIT_BYTES) })
    });
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("REQUEST_BODY_TOO_LARGE");
  });

  it("never emits wildcard CORS for an origin-less same-origin request", async () => {
    const response = await harness.app.request("/health");
    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("uses a stable safe error envelope without internal diagnostics", async () => {
    const response = await harness.app.request("/v1/not-real", { headers: apiHeaders() });
    const body = await json(response);
    expect(ApiErrorResponseSchema.safeParse(body).success).toBe(true);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/postgres|sql|service.?role|stack|file:/iu);
  });
});

describe("V2-013 production Session execution and disclosure", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness({ include_stemi: false }); });

  it("starts an authoritative production Session atomically and safely", async () => {
    const started = await start(harness);
    expect(started.response.status).toBe(201);
    expect(started.body.data.replayed).toBe(false);
    expect(SafeSessionProjectionSchema.safeParse(started.body.data.session).success).toBe(true);
    expect(harness.store.sessions.size).toBe(1);
    expect(harness.store.owners.get(started.body.data.session.session_id)).toBeTruthy();
  });

  it("replays exact start and conflicts on changed request under the same key", async () => {
    const key = "idempotency.api.start-replay";
    const first = await start(harness, { key });
    const retry = await start(harness, { key });
    expect(retry.response.status).toBe(201);
    expect(retry.body.data.replayed).toBe(true);
    expect(retry.body.data.session.session_id).toBe(first.body.data.session.session_id);
    const conflict = await start(harness, {
      key,
      body: startBody(harness.productionPackage.manifest.case_id, { patient_language: "ar-JO" })
    });
    expect(conflict.response.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("binds the verified learner and rejects another learner or tenant", async () => {
    const started = await start(harness, { key: "idempotency.api.ownership" });
    const sessionId = started.body.data.session.session_id;
    for (const token of ["other-learner", "cross-reviewer"]) {
      const response = await harness.app.request(`/v1/sessions/${sessionId}/state`, {
        headers: apiHeaders({ token })
      });
      expect(response.status).toBe(404);
      expect((await json(response)).error.code).toBe("RESOURCE_NOT_ACCESSIBLE");
    }
  });

  it("never serializes hidden Case, rubric, scheduler, review, or hash authority", async () => {
    const started = await start(harness, { key: "idempotency.api.minimization" });
    const serialized = JSON.stringify(started.body);
    for (const forbidden of [
      "clinical_facts", "assessment_rubric", "expected_action", "scheduler_state",
      "pending_items", "review_subject_hash", "review_execution_hash", "package_hash",
      "approval_record", "source_ids", "hidden diagnosis"
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("withholds live Assessment correctness and score", async () => {
    const started = await start(harness, { key: "idempotency.api.assessment-live" });
    const sessionId = started.body.data.session.session_id;
    const response = await harness.app.request(`/v1/sessions/${sessionId}/assessment`, {
      headers: apiHeaders()
    });
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.projection_type).toBe("ACTIVE_ASSESSMENT_WITHHELD");
    expect(JSON.stringify(body)).not.toMatch(/overall_score|criterion|correct|rubric/iu);
  });

  it("limits Practice disclosure to already-resolved deterministic findings", async () => {
    const started = await start(harness, {
      key: "idempotency.api.practice-live",
      body: startBody(harness.productionPackage.manifest.case_id, { mode: "PRACTICE_DEMO" })
    });
    const response = await harness.app.request(
      `/v1/sessions/${started.body.data.session.session_id}/assessment`,
      { headers: apiHeaders() }
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.projection_type).toBe("ACTIVE_PRACTICE_FEEDBACK");
    expect(body.data).toHaveProperty("resolved_findings");
    expect(JSON.stringify(body)).not.toMatch(/pending|future|answer.?key|rubric/iu);
  });

  it("submits intent through the real coordinator and exposes committed execution only", async () => {
    const started = await start(harness, { key: "idempotency.api.action-session" });
    const session = started.body.data.session;
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.action-001" }),
      body: JSON.stringify(actionBody(session.state_version))
    });
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.execution_status).toBe("EXECUTED");
    expect(body.data.committed_event_ids).toHaveLength(1);
    expect(body.data.session.state_version).toBeGreaterThan(session.state_version);
  });

  it("durably replays an exact action without duplicate event or sequence", async () => {
    const started = await start(harness, { key: "idempotency.api.action-replay-session" });
    const session = started.body.data.session;
    const path = `/v1/sessions/${session.session_id}/actions/propose`;
    const options = {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.action-replay" }),
      body: JSON.stringify(actionBody(session.state_version))
    };
    const firstResponse = await harness.app.request(path, options);
    const first = await json(firstResponse);
    const storedAfterFirst = harness.store.sessions.get(session.session_id)!;
    const retryResponse = await harness.app.request(path, options);
    const retry = await json(retryResponse);
    const storedAfterRetry = harness.store.sessions.get(session.session_id)!;
    expect(firstResponse.status).toBe(200);
    expect(retry.data.replayed).toBe(true);
    expect(retry.data.committed_event_ids).toEqual(first.data.committed_event_ids);
    expect(storedAfterRetry.next_sequence_no).toBe(storedAfterFirst.next_sequence_no);
  });

  it("maps conflicting idempotency and stale state to stable 409 responses", async () => {
    const started = await start(harness, { key: "idempotency.api.conflict-session" });
    const session = started.body.data.session;
    const path = `/v1/sessions/${session.session_id}/actions/propose`;
    const headers = apiHeaders({ idempotency: "idempotency.api.action-conflict" });
    await harness.app.request(path, { method: "POST", headers, body: JSON.stringify(actionBody(0)) });
    const conflict = await harness.app.request(path, {
      method: "POST",
      headers,
      body: JSON.stringify(actionBody(0, { command_id: "command.api.changed" }))
    });
    expect(conflict.status).toBe(409);
    expect((await json(conflict)).error.code).toBe("IDEMPOTENCY_CONFLICT");
    const stale = await harness.app.request(path, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.action-stale" }),
      body: JSON.stringify(actionBody(0, {
        command_id: "command.api.stale",
        action_request_id: "action-request.api.stale"
      }))
    });
    expect(stale.status).toBe(409);
    expect((await json(stale)).error.code).toBe("SESSION_VERSION_CONFLICT");
  });

  it("rejects an unknown action as non-execution with no committed mutation", async () => {
    const started = await start(harness, { key: "idempotency.api.reject-session" });
    const session = started.body.data.session;
    const before = harness.store.sessions.get(session.session_id)!;
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.reject" }),
      body: JSON.stringify(actionBody(0, { action_id: "action.unknown" }))
    });
    expect(response.status).toBe(422);
    expect(harness.store.sessions.get(session.session_id)!.next_sequence_no).toBe(before.next_sequence_no);
  });

  it("preserves one-winner semantics for concurrent different-key submissions", async () => {
    const started = await start(harness, { key: "idempotency.api.concurrent-session" });
    const session = started.body.data.session;
    const path = `/v1/sessions/${session.session_id}/actions/propose`;
    const [a, b] = await Promise.all([
      harness.app.request(path, {
        method: "POST",
        headers: apiHeaders({ idempotency: "idempotency.api.concurrent-a" }),
        body: JSON.stringify(actionBody(0, { command_id: "command.api.concurrent-a", action_request_id: "action-request.api.concurrent-a" }))
      }),
      harness.app.request(path, {
        method: "POST",
        headers: apiHeaders({ idempotency: "idempotency.api.concurrent-b" }),
        body: JSON.stringify(actionBody(0, { command_id: "command.api.concurrent-b", action_request_id: "action-request.api.concurrent-b" }))
      })
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(harness.store.sessions.get(session.session_id)!.committed_events).toHaveLength(1);
  });

  it("rolls back route-visible command state when persistence fails", async () => {
    const started = await start(harness, { key: "idempotency.api.failure-session" });
    const session = started.body.data.session;
    harness.store.failNextCommit = true;
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.failure" }),
      body: JSON.stringify(actionBody(0))
    });
    expect(response.status).toBe(503);
    expect(harness.store.sessions.get(session.session_id)!.committed_events).toHaveLength(0);
  });

  it("finalizes through Session authority and exposes deterministic final assessment", async () => {
    const started = await start(harness, { key: "idempotency.api.end-session" });
    const session = started.body.data.session;
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/end`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.end" }),
      body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
    });
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.session.status).toBe("ENDED");
    expect(body.data.assessment.assessment_status).toBe("FINAL");
    expect(harness.store.sessions.get(session.session_id)!.committed_events.at(-1)?.event_type)
      .toBe("SIMULATION_ENDED");
  });

  it("replays repeated finalization and rejects a different key", async () => {
    const started = await start(harness, { key: "idempotency.api.end-replay-session" });
    const session = started.body.data.session;
    const path = `/v1/sessions/${session.session_id}/end`;
    const request = { method: "POST", headers: apiHeaders({ idempotency: "idempotency.api.end-replay" }), body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" }) };
    await harness.app.request(path, request);
    const retry = await harness.app.request(path, request);
    expect(retry.status).toBe(200);
    expect((await json(retry)).data.replayed).toBe(true);
    const conflict = await harness.app.request(path, { ...request, headers: apiHeaders({ idempotency: "idempotency.api.end-different" }) });
    expect(conflict.status).toBe(409);
  });

  it("returns the same deterministic finalized evidence through assessment and debrief", async () => {
    const started = await start(harness, { key: "idempotency.api.final-debrief-session" });
    const session = started.body.data.session;
    const end = await harness.app.request(`/v1/sessions/${session.session_id}/end`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.final-debrief-end" }),
      body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
    });
    expect(end.status).toBe(200);
    const assessmentResponse = await harness.app.request(
      `/v1/sessions/${session.session_id}/assessment`,
      { headers: apiHeaders() }
    );
    const debriefResponse = await harness.app.request(
      `/v1/sessions/${session.session_id}/debriefs`,
      {
        method: "POST",
        headers: apiHeaders({ idempotency: "idempotency.api.final-debrief" }),
        body: "{}"
      }
    );
    const assessment = await json(assessmentResponse);
    const debrief = await json(debriefResponse);
    expect(assessmentResponse.status).toBe(200);
    expect(debriefResponse.status).toBe(200);
    expect(debrief.data).toEqual(assessment.data);
    expect(JSON.stringify(debrief)).not.toMatch(/package_hash|review_subject|approval|scheduler/iu);
  });

  it("does not expose final assessment through debrief before end", async () => {
    const started = await start(harness, { key: "idempotency.api.debrief-session" });
    const sessionId = started.body.data.session.session_id;
    const response = await harness.app.request(`/v1/sessions/${sessionId}/debriefs`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.debrief" }),
      body: "{}"
    });
    const body = await json(response);
    expect(body.data.projection_type).toBe("ACTIVE_ASSESSMENT_WITHHELD");
    expect(JSON.stringify(body)).not.toMatch(/overall_score|criterion/iu);
  });
});

describe("V2-013 review and future-capability safety", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness(); });

  it("denies real UNDER_REVIEW/REVIEW_ONLY STEMI to a production learner", async () => {
    const stemiCaseId = harness.reviewArtifact!.source_case.manifest.case_id;
    const response = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.stemi-learner" }),
      body: JSON.stringify(startBody(stemiCaseId))
    });
    expect([403, 404]).toContain(response.status);
  });

  it("allows only same-institution Faculty to resolve review authority", async () => {
    expect(harness.reviewArtifact!.review_subject_hash)
      .toBe(EXPECTED_STEMI_REVIEW_SUBJECT_HASH);
    expect(harness.reviewArtifact!.review_execution_hash)
      .toBe(EXPECTED_STEMI_REVIEW_EXECUTION_HASH);
    expect(STEMI_PORTABILITY_SNAPSHOT_SHA256)
      .toBe("14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58");
    const faculty = await start(harness, {
      key: "idempotency.api.stemi-faculty",
      token: "faculty",
      review: true
    });
    expect(faculty.response.status).toBe(201);
    expect(faculty.body.data.session.pinned_case.execution_authority).toBe("REVIEW_ONLY");
    const cross = await start(harness, {
      key: "idempotency.api.stemi-cross",
      token: "cross-reviewer",
      review: true
    });
    expect(cross.response.status).toBe(404);
  });

  it("does not let a reviewer promote review execution through production start", async () => {
    const response = await start(harness, {
      key: "idempotency.api.review-as-production",
      token: "faculty"
    });
    expect(response.response.status).toBe(403);
  });

  it("returns explicit unavailable for Patient AI after Session authorization", async () => {
    const started = await start(harness, { key: "idempotency.api.question-session" });
    const sessionId = started.body.data.session.session_id;
    const response = await harness.app.request(`/v1/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.question" }),
      body: JSON.stringify({ text: "How are you?", locale: "en-US", source: "TEXT", utterance_id: "utterance.api.001" })
    });
    expect(response.status).toBe(503);
    expect((await json(response)).error.code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("rejects malformed or oversized Patient questions before unavailability", async () => {
    const started = await start(harness, { key: "idempotency.api.question-validation-session" });
    const path = `/v1/sessions/${started.body.data.session.session_id}/questions`;
    for (const payload of [
      { text: "", locale: "en-US", source: "TEXT", utterance_id: "utterance.api.empty" },
      { text: "x".repeat(4_001), locale: "en-US", source: "TEXT", utterance_id: "utterance.api.large" },
      { text: "How are you?", locale: "en", source: "TEXT", utterance_id: "utterance.api.locale" },
      { text: "How are you?", locale: "en-US", source: "TEXT", utterance_id: "utterance.api.extra", role: "FACULTY" }
    ]) {
      const response = await harness.app.request(path, {
        method: "POST",
        headers: apiHeaders({ idempotency: "idempotency.api.question-validation" }),
        body: JSON.stringify(payload)
      });
      expect(response.status).toBe(400);
      expect((await json(response)).error.code).toBe("INVALID_REQUEST");
    }
  });

  it("does not fake Case Builder AI", async () => {
    const response = await harness.app.request("/v1/faculty/cases", {
      method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: "idempotency.api.case-builder" }),
      body: "{}"
    });
    expect(response.status).toBe(503);
  });

  it("exposes no Visual Engine or curriculum-RAG HTTP implementation", async () => {
    for (const path of ["/v1/visuals/resolve", "/v1/curriculum/context"]) {
      const response = await harness.app.request(path, { method: "POST", headers: apiHeaders() });
      expect(response.status).toBe(404);
    }
  });
});

describe("V2-013 verified Supabase JWT boundary", () => {
  const encoder = new TextEncoder();
  let publicKey: CryptoKey;
  let privateKey: CryptoKey;
  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    publicKey = pair.publicKey;
    privateKey = pair.privateKey;
  });

  function base64url(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  }

  async function token(payload: Record<string, unknown>, key = privateKey) {
    const head = base64url(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
    const body = base64url(encoder.encode(JSON.stringify(payload)));
    const signature = new Uint8Array(await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(`${head}.${body}`)
    ));
    return `${head}.${body}.${base64url(signature)}`;
  }

  it("accepts only a cryptographically verified current Supabase principal", async () => {
    const verifier = createSupabaseJwtVerifier({
      public_key: publicKey,
      issuer: "https://auth.test.invalid/",
      audience: "authenticated",
      now_epoch_seconds: () => 2_000_000_000
    });
    const jwt = await token({
      iss: "https://auth.test.invalid/",
      sub: "10000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      exp: 2_000_000_100
    });
    const result = await verifier.verifyAuthorizationHeader(`Bearer ${jwt}`);
    expect(result.success).toBe(true);
    if (result.success) expect(result.principal).not.toHaveProperty("role");
  });

  it("rejects a valid-looking token with a forged signature or anonymous claim", async () => {
    const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const verifier = createSupabaseJwtVerifier({
      public_key: publicKey,
      issuer: "https://auth.test.invalid/",
      audience: "authenticated",
      now_epoch_seconds: () => 2_000_000_000
    });
    const base = {
      iss: "https://auth.test.invalid/",
      sub: "10000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      exp: 2_000_000_100
    };
    expect((await verifier.verifyAuthorizationHeader(`Bearer ${await token(base, other.privateKey)}`)).success).toBe(false);
    expect((await verifier.verifyAuthorizationHeader(`Bearer ${await token({ ...base, is_anonymous: true })}`)).success).toBe(false);
  });

  it("rejects expired, not-yet-valid, wrong-issuer, and wrong-audience claims", async () => {
    const verifier = createSupabaseJwtVerifier({
      public_key: publicKey,
      issuer: "https://auth.test.invalid/",
      audience: "authenticated",
      now_epoch_seconds: () => 2_000_000_000
    });
    const base = {
      iss: "https://auth.test.invalid/",
      sub: "10000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      exp: 2_000_000_100
    };
    for (const payload of [
      { ...base, exp: 2_000_000_000 },
      { ...base, nbf: 2_000_000_001 },
      { ...base, iss: "https://forged.invalid/auth/v1" },
      { ...base, aud: "service_role" }
    ]) {
      expect((await verifier.verifyAuthorizationHeader(`Bearer ${await token(payload)}`)).success)
        .toBe(false);
    }
  });
});
