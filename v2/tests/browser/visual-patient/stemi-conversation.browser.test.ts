import { describe, it, expect } from "vitest";
import { prepareStemiConversationArtifact, STEMI_CONVERSATION_PARENT } from "../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { prepareStemiReviewArtifact } from "../../fixtures/cases/stemi-review.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { buildPatientConversationContext } from "../../../packages/patient-conversation/src/index.ts";
import { initializeReviewInMemorySession } from "../../../packages/session-engine/src/index.ts";
import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { projectVisualPatient } from "../../../packages/api-core/src/service/visual-patient-projection.ts";
import type { AiProvider } from "../../../packages/ai-gateway/src/index.ts";
import { V2_021_PATIENT_LANGUAGE, createV2_021QuestionBody } from "../../../runtime/v2-021-review-bootstrap.ts";

function initialize(artifact: Awaited<ReturnType<typeof prepareStemiReviewArtifact>>) {
  const r = initializeReviewInMemorySession({ session_id: "session.stemi-conversation",
    mode: "PRACTICE_DEMO", review_execution_artifact: artifact, trusted_real_time_anchor_utc: "2026-09-20T00:00:00Z" });
  if (!r.success) throw Error("fixture initialization failed"); return r.session;
}

describe("V2-021 explicitly versioned STEMI conversation", () => {
  it("fresh Jordanian review bootstrap and English-shell question use ar-JO with the pinned successor", async () => {
    const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
    const intent = { text: "متى بلش وجع صدرك؟", locale: "en-US", source: "TEXT" as const };
    const body = createV2_021QuestionBody(intent, "utterance.review-bootstrap");
    expect(body).toEqual({ text: intent.text, locale: "ar-JO", source: "TEXT", utterance_id: "utterance.review-bootstrap" });
    expect(intent.locale).toBe("en-US"); // Do not change shell/global localization.
    const provider: AiProvider = { async execute(request) {
      return { success: true, provider: "OPENAI", provider_model: request.model,
        provider_response_id: "response.bootstrap", retry_count: 0,
        output_text: JSON.stringify({ output_schema_version: "1.0", locale: "ar-JO",
          utterance: "بلّش قبل حوالي 55 دقيقة، ولسه مستمر ما وقف.", answer_mode: "GROUNDED",
          grounding_fact_ids: ["fact.stemi.symptom-onset"], grounding_state_refs: [], safety_flags: [],
          disclosure_status: "WITHIN_PATIENT_BOUNDARY" }) };
    } };
    const h = await createApiTestHarness({ review_artifact: artifact, enable_patient_conversation: true, patient_provider: provider });
    const started = await h.app.request("/v1/review-sessions", { method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: "idempotency.bootstrap" }),
      body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, {
        mode: "PRACTICE_DEMO", patient_language: V2_021_PATIENT_LANGUAGE })) });
    expect(started.status).toBe(201);
    const data = (await started.json()).data;
    expect(data.patient_language).toBe("ar-JO");
    expect(data.session.pinned_case).toMatchObject({ case_version: "2.0.1", execution_authority: "REVIEW_ONLY" });
    expect(artifact.source_case.instructor_notes.patient_ai_access).toBe("ALLOWED");
    const response = await h.app.request(`/v1/sessions/${data.session.session_id}/questions`, {
      method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.bootstrap-question" }),
      body: JSON.stringify(body) });
    expect(response.status).toBe(200);
    expect((await response.json()).data.turn).toMatchObject({ locale: "ar-JO", answer_mode: "GROUNDED",
      fallback_used: false, grounding_fact_ids: ["fact.stemi.symptom-onset"] });
  });
  it("preserves original review hashes and changes only version/capability/evidence metadata", async () => {
    const old = await prepareStemiReviewArtifact(); const next = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
    expect(old.review_subject_hash).toBe(STEMI_CONVERSATION_PARENT.review_subject_hash);
    expect(old.review_execution_hash).toBe(STEMI_CONVERSATION_PARENT.review_execution_hash);
    expect(next.review_subject_hash).toBe("6a707cdb7e19b01084c68a40ab86b5e48ef6140959b5ba96aa1db96c1137f18e");
    expect(next.review_execution_hash).toBe("90b8bfa625ff217edaefd2f235deacf396f9a9d8af86268c0acf411f939046f1");
    expect(next.execution_authority).toBe("REVIEW_ONLY");
    expect(next.source_case.manifest.status).toBe("UNDER_REVIEW");
    for (const key of Object.keys(old.source_case) as (keyof typeof old.source_case)[]) {
      if (!["manifest", "initial_state", "validation", "instructor_notes"].includes(key)) expect(next.source_case[key]).toEqual(old.source_case[key]);
    }
    expect({ ...next.source_case.initial_state.patient_state, case_version: "2.0.0" }).toEqual(old.source_case.initial_state.patient_state);
    expect(next.source_case.initial_state.observation_projection).toEqual(old.source_case.initial_state.observation_projection);
    expect({ ...next.source_case.instructor_notes, patient_ai_access: "FORBIDDEN" }).toEqual(old.source_case.instructor_notes);
    expect((await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER)).review_execution_hash).toBe(next.review_execution_hash);
  });

  it("keeps the old forbidden case rejected and enables only the new pinned version", async () => {
    const old = await prepareStemiReviewArtifact(); const next = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
    const context = (a: typeof old) => buildPatientConversationContext({ case_package: a.source_case,
      patient_state: initialize(a).patient_state, locale: "en-US", history: [] });
    expect(context(old)).toMatchObject({ success: false, issues: [{ code: "PATIENT_AI_FORBIDDEN" }] });
    const result = context(next); expect(result.success).toBe(true); if (!result.success) return;
    expect(result.context.facts.some(f => f.fact_id === "fact.stemi.symptom-onset")).toBe(true);
    expect(result.context.facts.every(f => next.source_case.clinical_facts.facts.some(source => source.fact_id === f.fact_id && source.disclosure_mode === "on_direct_question"))).toBe(true);
    for (const secret of ["fact.stemi.hidden-diagnosis", "fact.stemi.ecg-inferior-findings", "instructor.stemi", "assessment_rubric", "rules", "active_complications"]) expect(JSON.stringify(result.context)).not.toContain(secret);
    expect(projectVisualPatient(initialize(next))).toMatchObject({ face: "pain", body: "pain_body" });
    const mismatched = initialize(next); mismatched.pinned_case.case_version = old.source_identity.case_version;
    expect(projectVisualPatient(mismatched)).toBeUndefined();
  });

  it("uses the existing question route, grounds the response and cannot change clinical truth", async () => {
    const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
    let calls = 0;
    const provider: AiProvider = { async execute(request) {
      calls++;
      expect(request.model).toBe("gpt-5.6-terra");
      expect(request.user_content).not.toContain("instructor.stemi");
      return { success: true, provider: "OPENAI", provider_model: request.model, provider_response_id: "response.stemi-conversation-test", retry_count: 0,
        output_text: JSON.stringify({ output_schema_version: "1.0", locale: "en-US", utterance: "It started about 55 minutes before I arrived, and it has not stopped.",
          answer_mode: "GROUNDED", grounding_fact_ids: ["fact.stemi.symptom-onset"], grounding_state_refs: [], safety_flags: [], disclosure_status: "WITHIN_PATIENT_BOUNDARY" }) };
    } };
    const h = await createApiTestHarness({ review_artifact: artifact, enable_patient_conversation: true, patient_provider: provider });
    const started = await h.app.request("/v1/review-sessions", { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.stemi-conversation-start" }), body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, { mode: "PRACTICE_DEMO" })) });
    expect(started.status).toBe(201); const sessionId = (await started.json()).data.session.session_id;
    const before = JSON.parse(JSON.stringify(h.store.sessions.get(sessionId)));
    const body = { text: "When did the chest pain start?", locale: "en-US", source: "TEXT", utterance_id: "utterance.stemi-conversation" };
    const submit = () => h.app.request(`/v1/sessions/${sessionId}/questions`, { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.stemi-conversation-question" }), body: JSON.stringify(body) });
    const response = await submit(); expect(response.status).toBe(200);
    const data = await response.json(); expect(data.data.turn.patient_utterance).toContain("55 minutes");
    const after = h.store.sessions.get(sessionId)!;
    expect(after.patient_state).toEqual(before.patient_state); expect(after.scheduler_state).toEqual(before.scheduler_state);
    expect(after.clinical_clock).toEqual(before.clinical_clock);
    expect(after.committed_events.slice(before.committed_events.length).map(e => e.event_type)).toEqual(["QUESTION_ASKED", "PATIENT_RESPONSE_RECORDED"]);
    expect((await submit()).status).toBe(200); expect(calls).toBe(1);
  });

  it("still rejects the original STEMI HTTP question before a provider call", async () => {
    const h = await createApiTestHarness({ enable_patient_conversation: true });
    const response = await h.app.request("/v1/review-sessions", { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.old-stemi-start" }), body: JSON.stringify(startBody(h.reviewArtifact!.source_case.manifest.case_id, { mode: "PRACTICE_DEMO" })) });
    const id = (await response.json()).data.session.session_id;
    const question = await h.app.request(`/v1/sessions/${id}/questions`, { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: "idempotency.old-stemi-question" }), body: JSON.stringify({ text: "When did pain start?", locale: "en-US", source: "TEXT", utterance_id: "utterance.old-stemi" }) });
    expect(question.status).toBe(422); expect(h.getPatientProviderCalls()).toBe(0);
  });
});
