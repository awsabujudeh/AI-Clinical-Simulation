import { describe, it, expect, vi } from "vitest";
import { VisualPatientPresentationSchema, VisualExamRequestSchema } from "../../../packages/contracts/src/index.ts";
import { projectVisualPatient } from "../../../packages/api-core/src/service/visual-patient-projection.ts";
import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { observePatientAudio } from "../../../apps/web/src/features/voice/patient-audio-playback.ts";

async function review() {
  const h = await createApiTestHarness();
  const response = await h.app.request("/v1/review-sessions", { method: "POST",
    headers: apiHeaders({ token: "faculty", idempotency: "idempotency.visual.test" }),
    body: JSON.stringify(startBody(h.reviewArtifact!.source_case.manifest.case_id)) });
  expect(response.status).toBe(201);
  const result = await response.json();
  const aggregate = (await h.store.load(result.data.session.session_id));
  if (!aggregate.success) throw Error("missing session");
  return { h, projection: result.data.session, session: aggregate.session };
}
describe("case-bound downstream Visual Patient", () => {
  it("projects only approved display controls from exact pinned STEMI review", async () => {
    const { session, projection } = await review(); const before = JSON.stringify(session);
    expect(projection.visual_patient).toEqual(projectVisualPatient(session));
    expect(projection.visual_patient).toMatchObject({ face: "pain", position: "semi_fowler", hand: true });
    expect(JSON.stringify(session)).toBe(before);
    expect(Object.keys(projection.visual_patient).sort()).toEqual(["asset_id","blink","body","breathing","equipment","face","hand","living","position","presentation_schema_version"]);
    expect(projection.visual_patient.equipment).toEqual({bp_cuff:false,iv_access:false,iv_tubing:false});
  });
  it("does not invent relief from modest support or from displayed vitals", async () => {
    const { session } = await review(); session.patient_state.hemodynamic_state = "hemodynamics.stemi-modestly-supported" as never;
    session.patient_state.pain_state.severity_0_10 = 7;
    expect(projectVisualPatient(session)?.face).toBe("pain");
  });
  it("unknown state and impaired consciousness fall back, never show an alert stock patient", async () => {
    const { session } = await review(); session.patient_state.consciousness = "consciousness.gcs-14" as never;
    expect(projectVisualPatient(session)).toBeUndefined();
    session.patient_state.consciousness = "consciousness.gcs-15" as never; session.patient_state.hemodynamic_state = "constructor" as never;
    expect(projectVisualPatient(session)).toBeUndefined();
  });
  it("a changed case hash cannot inherit the display binding", async () => {
    const { session } = await review(); if (session.pinned_case.execution_authority !== "REVIEW_ONLY") throw Error();
    session.pinned_case.review_execution_hash = "a".repeat(64) as never;
    expect(projectVisualPatient(session)).toBeUndefined();
  });
  it("display contract rejects clinical writes, findings, speaking authority and unknown versions", async () => {
    const { projection } = await review();
    for (const change of [{ finding: "fake" }, { patient_state: {} }, { speaking: true }, { presentation_schema_version: "2.0" }])
      expect(VisualPatientPresentationSchema.safeParse({ ...projection.visual_patient, ...change }).success).toBe(false);
  });
  it("exam intent is strict and cannot carry a finding or execute an action", () => {
    const value = { type: "visual_exam_request", tool: "stethoscope", exam_mode: "AUSCULTATION", region_id: "CHEST", anchor_id: "Exam_Chest_Center", patient_position: "supine" };
    expect(VisualExamRequestSchema.safeParse(value).success).toBe(true);
    expect(VisualExamRequestSchema.safeParse({ ...value, finding: "normal" }).success).toBe(false);
    expect(VisualExamRequestSchema.safeParse({ ...value, action_id: "examination.arbitrary" }).success).toBe(false);
  });
});
describe("actual media lifecycle notification boundary", () => {
  it("playing, ended, cancel and error emit without treating available text/audio as playback", () => {
    const audio = document.createElement("audio"); const release = vi.fn(); const listener = vi.fn();
    const handle = observePatientAudio(audio, release); const off = handle.onPlayback!(listener);
    expect(listener).not.toHaveBeenCalled();
    for (const event of ["playing", "ended", "pause", "error"]) audio.dispatchEvent(new Event(event));
    expect(listener.mock.calls.map(x => x[0])).toEqual(["START","END","CANCEL","ERROR"]);
    off(); handle.close(); handle.close(); expect(release).toHaveBeenCalledTimes(1);
    audio.dispatchEvent(new Event("playing")); expect(listener).toHaveBeenCalledTimes(4);
  });
});
