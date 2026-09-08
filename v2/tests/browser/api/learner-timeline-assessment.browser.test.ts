import { beforeAll, describe, expect, it } from "vitest";

import {
  SafeAssessmentApiProjectionSchema,
  SafeLearnerTimelineProjectionSchema
} from "../../../packages/contracts/src/index.ts";
import {
  actionBody,
  apiHeaders,
  createApiTestHarness,
  startBody,
  type ApiTestHarness
} from "../../fixtures/api/secure-api.ts";

async function body(response: Response) {
  return await response.json() as Record<string, any>;
}

let startCounter = 0;

async function start(harness: ApiTestHarness, mode: "ASSESSMENT" | "PRACTICE_DEMO" = "ASSESSMENT") {
  startCounter += 1;
  const response = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: `idempotency.v2-017.start.${mode}.${startCounter}` }),
    body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id, { mode }))
  });
  return (await body(response)).data.session as Record<string, any>;
}

describe("V2-017 learner-safe timeline API", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness({ include_stemi: false }); });

  it("projects only committed learner-relevant items in authoritative sequence", async () => {
    const session = await start(harness);
    await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-017.action" }),
      body: JSON.stringify(actionBody(session.state_version))
    });
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/timeline`, {
      headers: apiHeaders()
    });
    const projection = (await body(response)).data;
    expect(response.status).toBe(200);
    expect(SafeLearnerTimelineProjectionSchema.safeParse(projection).success).toBe(true);
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]).toMatchObject({
      sequence_no: 1,
      clinical_time: 0,
      item_type: "ACTION_COMMITTED",
      action_id: "examination.synthetic-check"
    });
  });

  it("never exposes raw event, rule, scheduler, effect, score, Case hash, or governance data", async () => {
    const session = await start(harness, "PRACTICE_DEMO");
    await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-017.minimized-action" }),
      body: JSON.stringify(actionBody(session.state_version))
    });
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/timeline`, {
      headers: apiHeaders()
    });
    const projection = (await body(response)).data;
    expect(Object.keys(projection).sort()).toEqual([
      "event_sequence_through",
      "items",
      "session_id",
      "timeline_schema_version"
    ]);
    expect(Object.keys(projection.items[0]).sort()).toEqual([
      "action_id", "clinical_time", "event_id", "item_type", "labels", "sequence_no"
    ]);
    expect(JSON.stringify(projection)).not.toMatch(
      /payload|rule_id|scheduler|effect|patient_state|diagnosis|rubric|score|package_hash|review|approval|future/iu
    );
  });

  it("denies cross-user and cross-tenant timeline reads without revealing existence", async () => {
    const session = await start(harness);
    for (const token of ["other-learner", "cross-reviewer"]) {
      const response = await harness.app.request(`/v1/sessions/${session.session_id}/timeline`, {
        headers: apiHeaders({ token })
      });
      expect(response.status).toBe(404);
      expect((await body(response)).error.code).toBe("RESOURCE_NOT_ACCESSIBLE");
    }
  });

  it("does not expose future or uncommitted internal proposals", async () => {
    const session = await start(harness);
    const aggregate = harness.store.sessions.get(session.session_id)!;
    expect(aggregate.committed_events).toHaveLength(0);
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/timeline`, {
      headers: apiHeaders()
    });
    expect((await body(response)).data.items).toEqual([]);
  });
});

describe("V2-017 Assessment disclosure API", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness({ include_stemi: false }); });

  it("withholds all scoring and correctness during active Assessment", async () => {
    const session = await start(harness);
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/assessment`, {
      headers: apiHeaders()
    });
    const projection = (await body(response)).data;
    expect(SafeAssessmentApiProjectionSchema.safeParse(projection).success).toBe(true);
    expect(projection.projection_type).toBe("ACTIVE_ASSESSMENT_WITHHELD");
    expect(JSON.stringify(projection)).not.toMatch(
      /overall_score|domain_score|correct|unsafe|rubric|debrief|expected_action/iu
    );
  });

  it("returns a strict learner-safe six-domain final projection only after authoritative end", async () => {
    const session = await start(harness);
    const endResponse = await harness.app.request(`/v1/sessions/${session.session_id}/end`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-017.end" }),
      body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
    });
    expect(endResponse.status).toBe(200);
    const response = await harness.app.request(`/v1/sessions/${session.session_id}/assessment`, {
      headers: apiHeaders()
    });
    const projection = (await body(response)).data;
    expect(projection.assessment_status).toBe("FINAL");
    expect(projection.domain_scores).toHaveLength(6);
    expect(projection.domain_scores.every((domain: Record<string, any>) => domain.labels.length > 0)).toBe(true);
    expect(JSON.stringify(projection)).not.toMatch(
      /rubric_item_id|criterion|trace_code|package_hash|review_subject|scheduler|approval/iu
    );
  });

  it("denies cross-user and cross-tenant Assessment reads", async () => {
    const session = await start(harness);
    for (const token of ["other-learner", "cross-reviewer"]) {
      const response = await harness.app.request(`/v1/sessions/${session.session_id}/assessment`, {
        headers: apiHeaders({ token })
      });
      expect(response.status).toBe(404);
    }
  });
});
