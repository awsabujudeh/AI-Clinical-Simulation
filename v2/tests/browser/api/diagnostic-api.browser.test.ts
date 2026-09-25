import { beforeAll, describe, expect, it } from "vitest";

import {
  CanonicalEventEnvelopeSchema
} from "../../../packages/contracts/src/index.ts";
import {
  CompiledCasePackageSchema,
  compileCasePackage
} from "../../../packages/case-schema/src/index.ts";
import {
  InMemorySessionAggregateSchema
} from "../../../packages/session-engine/src/index.ts";
import {
  createDiagnosticPublicationFixture
} from "../../fixtures/cases/synthetic-diagnostic-case.ts";
import { TEST_HASH_ADAPTER } from "../../fixtures/cases/synthetic-case.ts";
import {
  apiHeaders,
  createApiTestHarness,
  startBody,
  type ApiTestHarness
} from "../../fixtures/api/secure-api.ts";

async function body(response: Response) {
  return await response.json() as Record<string, any>;
}

describe("V2-013 safe diagnostic milestone projection", () => {
  let harness: ApiTestHarness;
  let sessionId: string;
  const actionId = "investigation.synthetic-ecg";
  const resultId = "diagnostic-result.synthetic.ecg";

  beforeAll(async () => {
    const fixture = await createDiagnosticPublicationFixture();
    const compiled = await compileCasePackage(fixture.approved, fixture.approval, TEST_HASH_ADAPTER);
    if (!compiled.success) throw new Error(JSON.stringify(compiled.report));
    harness = await createApiTestHarness({
      include_stemi: false,
      production_package: CompiledCasePackageSchema.parse(compiled.package)
    });
    const started = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.diagnostic-start" }),
      body: JSON.stringify(startBody(compiled.package.manifest.case_id))
    });
    sessionId = (await body(started)).data.session.session_id;
  });

  function commitMilestones(eventTypes: Array<
    "INVESTIGATION_IMAGE_AVAILABLE" | "INVESTIGATION_RESULT_AVAILABLE" | "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
  >) {
    const session = harness.store.sessions.get(sessionId)!;
    const events = (["INVESTIGATION_ORDERED", ...eventTypes] as const).map((eventType, index) => CanonicalEventEnvelopeSchema.parse({
      event_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      session_id: sessionId,
      sequence_no: index + 1,
      event_schema_version: "1.0",
      clinical_time: index + 1,
      real_time_utc: `2026-09-06T10:00:0${index + 1}Z`,
      actor_type: eventType === "INVESTIGATION_ORDERED" ? "LEARNER" : "SYSTEM",
      source: eventType === "INVESTIGATION_ORDERED" ? "UI" : "ENGINE",
      correlation_id: `correlation.api.diagnostic-${index + 1}`,
      action_id: actionId,
      event_type: eventType,
      parameters: {},
      status: "COMMITTED",
      payload: {},
      clinical_effect_ids: [],
      state_version_before: 0,
      state_version_after: 0,
      scoring_evidence_refs: [],
      case_version: session.pinned_case.case_version,
      idempotency_key: `idempotency.api.diagnostic-${index + 1}`,
      request_id: `request.api.diagnostic-${index + 1}`
    }));
    harness.store.sessions.set(sessionId, InMemorySessionAggregateSchema.parse({
      ...session,
      patient_state: {...session.patient_state, clinical_time: events.length},
      clinical_clock: {...session.clinical_clock, clinical_time: events.length},
      committed_events: events,
      next_sequence_no: events.length + 1
    }));
  }

  it("does not reveal a known result before an availability milestone", async () => {
    const response = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, {
      headers: apiHeaders()
    });
    expect(response.status).toBe(422);
    const value = await body(response);
    expect(value.error.code).toBe("RESULT_PENDING");
    expect(JSON.stringify(value)).not.toContain("measurement.synthetic");
  });

  it("keeps image, structured result, and formal report milestones distinct", async () => {
    commitMilestones(["INVESTIGATION_IMAGE_AVAILABLE"]);
    const imageResponse = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, {
      headers: apiHeaders()
    });
    const image = await body(imageResponse);
    expect(image.data.component_status).toEqual({
      structured_result: "PENDING",
      media: "AVAILABLE",
      machine_interpretation: "WITHHELD",
      formal_report: "PENDING"
    });
    expect(image.data.media_assets).toHaveLength(1);
    expect(image.data).not.toHaveProperty("structured_result");
    expect(image.data).not.toHaveProperty("formal_report_key");

    commitMilestones([
      "INVESTIGATION_IMAGE_AVAILABLE",
      "INVESTIGATION_RESULT_AVAILABLE",
      "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
    ]);
    const resultResponse = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, {
      headers: apiHeaders()
    });
    const result = await body(resultResponse);
    expect(result.data.component_status.structured_result).toBe("AVAILABLE");
    expect(result.data.structured_result.result_type).toBe("ECG");
    expect(result.data.component_status.formal_report).toBe("PENDING");
    expect(result.data).not.toHaveProperty("formal_report_key");
  });

  it("returns safe not-found for unknown diagnostic and foreign Session access", async () => {
    const unknown = await harness.app.request(`/v1/sessions/${sessionId}/investigations/diagnostic-result.synthetic.unknown`, {
      headers: apiHeaders()
    });
    expect(unknown.status).toBe(404);
    const foreign = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, {
      headers: apiHeaders({ token: "other-learner" })
    });
    expect(foreign.status).toBe(404);
    expect((await body(foreign)).error.code).toBe("RESOURCE_NOT_ACCESSIBLE");
  });

  it("Session end cannot reveal an unordered investigation", async () => {
    const previous = harness.store.sessions.get(sessionId)!;
    harness.store.sessions.set(sessionId, InMemorySessionAggregateSchema.parse({ ...previous, committed_events: [], next_sequence_no: 1 }));
    try {
      const end = await harness.app.request(`/v1/sessions/${sessionId}/end`, {
        method: "POST", headers: apiHeaders({idempotency:"idempotency.diagnostic.end-unordered"}),
        body: JSON.stringify({expected_state_version:previous.patient_state.state_version,reason:"LEARNER_COMPLETED"}),
      });
      expect(end.status).toBe(200);
      const response = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, { headers: apiHeaders() });
      expect(response.status).toBe(422);
      expect((await body(response)).error.code).toBe("RESULT_PENDING");
    } finally { harness.store.sessions.set(sessionId, previous); }
  });

  it("Session end cannot replace missing result/report availability", async () => {
    commitMilestones([]);
    const previous = harness.store.sessions.get(sessionId)!;
    try {
      const end = await harness.app.request(`/v1/sessions/${sessionId}/end`, {
        method: "POST", headers: apiHeaders({idempotency:"idempotency.diagnostic.end-future"}),
        body: JSON.stringify({expected_state_version:previous.patient_state.state_version,reason:"LEARNER_COMPLETED"}),
      });
      expect(end.status).toBe(200);
      const response = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, { headers: apiHeaders() });
      expect(response.status).toBe(422);
      expect((await body(response)).error.code).toBe("RESULT_PENDING");
    } finally { harness.store.sessions.set(sessionId, previous); }
  });

  it("future result/report receipts cannot reveal results before Clinical Time", async () => {
    commitMilestones(["INVESTIGATION_RESULT_AVAILABLE", "INVESTIGATION_FORMAL_REPORT_AVAILABLE"]);
    const previous = harness.store.sessions.get(sessionId)!;
    harness.store.sessions.set(sessionId, InMemorySessionAggregateSchema.parse({
      ...previous,
      patient_state: { ...previous.patient_state, clinical_time: 1 },
      clinical_clock: { ...previous.clinical_clock, clinical_time: 1 },
    }));
    try {
      const response = await harness.app.request(`/v1/sessions/${sessionId}/investigations/${resultId}`, { headers: apiHeaders() });
      expect(response.status).toBe(422);
      expect((await body(response)).error.code).toBe("RESULT_PENDING");
    } finally { harness.store.sessions.set(sessionId, previous); }
  });
});
