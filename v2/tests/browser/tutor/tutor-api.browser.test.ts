import { describe, it, expect } from "vitest";
import { createApiTestHarness, apiHeaders, startBody, actionBody } from "../../fixtures/api/secure-api.ts";
import { tutorTestGateway } from "../../fixtures/tutor.ts";
import { TutorDebriefSchema } from "../../../packages/contracts/src/index.ts";
import { createStemiTutorRetrieval } from "../../../runtime/v2-024-tutor-composition.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";

async function start(h: Awaited<ReturnType<typeof createApiTestHarness>>, review = false) {
  const response = await h.app.request(review ? "/v1/review-sessions" : "/v1/sessions", { method: "POST",
    headers: apiHeaders({ token: review ? "faculty" : "learner", idempotency: "idempotency.tutor.start" }),
    body: JSON.stringify(startBody(review ? h.reviewArtifact!.source_case.manifest.case_id : h.productionPackage.manifest.case_id,
      { mode: review ? "PRACTICE_DEMO" : "ASSESSMENT" })) });
  expect(response.status).toBe(201); return (await response.json()).data.session;
}
const debrief = (h: Awaited<ReturnType<typeof createApiTestHarness>>, id: string, token = "learner", body: unknown = { locale: "en-US" }, key = "idempotency.tutor.generate") =>
  h.app.request(`/v1/sessions/${id}/debriefs`, { method: "POST", headers: apiHeaders({ token, idempotency: key }), body: JSON.stringify(body) });

describe("Tutor route disclosure and immutable evidence", () => {
  it("blocks active production disclosure; finalizes normally, debriefs, and replays without AI duplication", async () => {
    const ai = tutorTestGateway(); const h = await createApiTestHarness({ include_stemi: false, tutor: { gateway: ai.gateway } });
    const session = await start(h);
    expect((await debrief(h, session.session_id)).status).not.toBe(200); expect(ai.calls()).toBe(0);
    const action = await h.app.request(`/v1/sessions/${session.session_id}/actions/propose`, { method: "POST", headers: apiHeaders({ idempotency: "idempotency.tutor.action" }), body: JSON.stringify(actionBody(session.state_version)) });
    expect(action.status).toBe(200); const state = (await action.json()).data.session;
    const end = await h.app.request(`/v1/sessions/${session.session_id}/end`, { method: "POST", headers: apiHeaders({ idempotency: "idempotency.tutor.end" }), body: JSON.stringify({ expected_state_version: state.state_version, reason: "LEARNER_COMPLETED" }) });
    expect(end.status).toBe(200);
    const before = await h.store.load(session.session_id);
    const r = await debrief(h, session.session_id); expect(r.status).toBe(200);
    const data = (await r.json()).data; expect(TutorDebriefSchema.safeParse(data).success).toBe(true);
    expect(data.packet.mode).toBe("FINAL_DEBRIEF"); expect(data.packet.assessment.evaluation_phase).toBe("FINAL");
    const again = await debrief(h, session.session_id); expect((await again.json()).data).toEqual(data); expect(ai.calls()).toBe(1);
    expect(await h.store.load(session.session_id)).toEqual(before);
    expect((await debrief(h, session.session_id, "learner", { locale: "ar-JO" })).status).toBe(409);
  });
  it("STEMI stays REVIEW_ONLY with honest pending criteria; RAG failure cannot remove score or alter state", async () => {
    const h = await createApiTestHarness({ tutor: { retrieve: async () => { throw Error("OFFLINE"); } } });
    const session = await start(h, true); const before = await h.store.load(session.session_id);
    const response = await debrief(h, session.session_id, "faculty"); expect(response.status).toBe(200);
    const r = (await response.json()).data;
    expect(r.packet.mode).toBe("REVIEW_SNAPSHOT"); expect(r.packet.assessment.execution_authority).toBe("REVIEW_ONLY");
    expect(r.packet.assessment.evaluation_phase).toBe("LIVE"); expect(r.packet.assessment.finalization_boundary).toBeUndefined();
    expect(r.packet.criteria.some((c: any) => c.criterion.status === "PENDING")).toBe(true);
    expect(r.packet.assessment.domain_scores).toHaveLength(6); expect(r.tutor_status).toBe("TEMPLATE_FALLBACK");
    expect(r.packet.clinical_source_status).toBe("RETRIEVAL_UNAVAILABLE");
    expect(await h.store.load(session.session_id)).toEqual(before);
  });
  it("pending real registry gives no citations and no official JU/JUST alignment", async () => {
    const h = await createApiTestHarness({ tutor: { retrieve: await createStemiTutorRetrieval(PORTABLE_SHA256_ADAPTER) } });
    const session = await start(h, true); const r = (await (await debrief(h, session.session_id, "faculty")).json()).data;
    expect(r.packet.clinical_source_status).toBe("SOURCE_PENDING"); expect(r.packet.curriculum_status).toBe("CURRICULUM_SOURCE_PENDING");
    expect(r.packet.clinical_evidence).toEqual([]); expect(r.packet.curriculum_evidence).toEqual([]);
  });
  it("denies cross-user/institution and injected evidence/model before any provider call", async () => {
    const ai = tutorTestGateway(); const h = await createApiTestHarness({ tutor: { gateway: ai.gateway } }); const session = await start(h, true);
    for (const token of ["learner", "other-learner", "cross-reviewer"]) expect((await debrief(h, session.session_id, token)).status).not.toBe(200);
    expect((await debrief(h, session.session_id, "faculty", { locale: "en-US", score: 100 })).status).toBe(400);
    expect(ai.calls()).toBe(0);
  });
});
