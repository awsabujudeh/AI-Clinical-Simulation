import { beforeAll, describe, expect, it } from "vitest";

import {
  SafeLearnerActionCatalogueSchema,
  SafeSessionProjectionSchema
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

async function start(harness: ApiTestHarness, token = "learner", review = false) {
  const caseId = review
    ? harness.reviewArtifact!.source_case.manifest.case_id
    : harness.productionPackage.manifest.case_id;
  const response = await harness.app.request(review ? "/v1/review-sessions" : "/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ token, idempotency: `idempotency.v2-016.${token}.${review}` }),
    body: JSON.stringify(startBody(caseId))
  });
  return { response, json: await body(response) };
}

describe("V2-016 disclosure-safe learner action discovery", () => {
  let harness: ApiTestHarness;
  beforeAll(async () => { harness = await createApiTestHarness(); });

  it("projects only a strict server-derived learner catalogue on start and state reads", async () => {
    const started = await start(harness);
    expect(started.response.status).toBe(201);
    const session = SafeSessionProjectionSchema.parse(started.json.data.session);
    expect(SafeLearnerActionCatalogueSchema.safeParse(session.learner_action_catalogue).success)
      .toBe(true);
    expect(session.learner_action_catalogue.actions.length).toBeGreaterThan(0);

    const stateResponse = await harness.app.request(
      `/v1/sessions/${session.session_id}/state`,
      { headers: apiHeaders() }
    );
    const state = (await body(stateResponse)).data;
    expect(state.learner_action_catalogue).toEqual(session.learner_action_catalogue);
  });

  it("does not disclose raw Case package authority or hidden clinical/scoring data", async () => {
    const started = await start(harness, "learner", false);
    const catalogue = started.json.data.session.learner_action_catalogue;
    const serialized = JSON.stringify(catalogue);
    expect(Object.keys(catalogue).sort()).toEqual(["actions", "catalogue_schema_version"]);
    for (const action of catalogue.actions) {
      expect(Object.keys(action).sort()).toEqual([
        "action_id",
        "action_type",
        "aliases",
        "confirmation_policy",
        "labels",
        "parameter_definitions",
        "repeat_policy"
      ]);
      for (const alias of action.aliases) {
        expect(Object.keys(alias).sort()).toEqual(["locale", "phrases"]);
      }
    }
    expect(serialized).not.toMatch(
      /rubric|expected_action|correct_action|rule_id|effect|patient_state|precondition|clinical_fact|scheduled|package_hash|review_status|approval/iu
    );
  });

  it("uses neutral deterministic action ordering and authored bilingual labels", async () => {
    const started = await start(harness);
    const actions = started.json.data.session.learner_action_catalogue.actions as Array<Record<string, any>>;
    const ids = actions.map((action) => action.action_id);
    expect(ids).toEqual([...ids].sort());
    expect(actions.every((action) => action.labels.every(
      (label: Record<string, unknown>) => label.locale === "ar-JO" || label.locale === "en-US"
    ))).toBe(true);
  });

  it("allows only a projected pinned action to reach authoritative proposal processing", async () => {
    const started = await start(harness);
    const session = started.json.data.session;
    const action = session.learner_action_catalogue.actions[0];
    const accepted = await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-016.accepted" }),
      body: JSON.stringify(actionBody(session.state_version, { action_id: action.action_id }))
    });
    expect(accepted.status).toBe(200);
    expect((await body(accepted)).data.execution_status).toBe("EXECUTED");

    const unknown = await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-016.unknown" }),
      body: JSON.stringify(actionBody(1, { action_id: "procedure.not-in-pinned-case" }))
    });
    expect(unknown.status).toBe(422);
  });

  it("preserves cross-principal and cross-tenant Session denial", async () => {
    const started = await start(harness);
    const sessionId = started.json.data.session.session_id;
    for (const token of ["other-learner", "cross-reviewer"]) {
      const read = await harness.app.request(`/v1/sessions/${sessionId}/state`, {
        headers: apiHeaders({ token })
      });
      const action = await harness.app.request(`/v1/sessions/${sessionId}/actions/propose`, {
        method: "POST",
        headers: apiHeaders({ token, idempotency: `idempotency.v2-016.cross.${token}` }),
        body: JSON.stringify(actionBody())
      });
      expect(read.status).toBe(404);
      expect(action.status).toBe(404);
    }
  });

  it("keeps UNDER_REVIEW STEMI out of learner production while making review authority explicit", async () => {
    const reviewArtifact = harness.reviewArtifact!;
    expect(reviewArtifact.source_case.manifest.status).toBe("UNDER_REVIEW");
    const learnerProduction = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.v2-016.stemi-production" }),
      body: JSON.stringify(startBody(reviewArtifact.source_case.manifest.case_id))
    });
    expect(learnerProduction.status).toBe(404);

    const review = await start(harness, "faculty", true);
    expect(review.response.status).toBe(201);
    expect(review.json.data.session.pinned_case.execution_authority).toBe("REVIEW_ONLY");
    expect(review.json.data.session.learner_action_catalogue.actions.length).toBeGreaterThan(0);
  });
});
