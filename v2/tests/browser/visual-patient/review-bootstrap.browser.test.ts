import { it, expect } from "vitest";
import { createV2_021ReviewStartKey, createV2_021RequestIdentity, createV2_021QuestionBody,
  V2_021_PATIENT_LANGUAGE } from "../../../runtime/v2-021-review-bootstrap.ts";
import { IdempotencyKeySchema, SessionIdSchema, SubmitQuestionRequestSchema } from "../../../packages/contracts/src/index.ts";
import { createApiTestHarness, apiHeaders, startBody } from "../../fixtures/api/secure-api.ts";
import { prepareStemiConversationArtifact } from "../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import type { AiProvider } from "../../../packages/ai-gateway/src/index.ts";

const boot1 = "10000000-0000-4000-8000-000000000001";
const boot2 = "10000000-0000-4000-8000-000000000002";
const page1 = "20000000-0000-4000-8000-000000000001";
const page2 = "20000000-0000-4000-8000-000000000002";
const intent = { text: "متى بلش وجع صدرك؟", source: "TEXT" as const };

it("review request IDs remain bounded and cannot collide when boot/page counters reset", () => {
  const keys = new Set<string>();
  for (const [boot, page] of [[boot1, page1], [boot1, page2], [boot2, page1]]) {
    const id = createV2_021RequestIdentity(boot!, page!);
    const key = id("idempotency", 4);
    expect(IdempotencyKeySchema.safeParse(key).success).toBe(true);
    expect(SubmitQuestionRequestSchema.safeParse(createV2_021QuestionBody(intent, id("utterance", 4))).success).toBe(true);
    keys.add(key);
  }
  expect(keys.size).toBe(3);
  expect(createV2_021ReviewStartKey(boot1)).not.toBe(createV2_021ReviewStartKey(boot2));
});

it("fresh review boot identities create distinct ar-JO 2.0.1 Sessions with isolated exact replay", async () => {
  const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
  let calls = 0;
  const provider: AiProvider = { async execute(request) {
    calls++;
    return { success: true, provider: "OPENAI", provider_model: request.model,
      provider_response_id: `response.review-${calls}`, retry_count: 0,
      output_text: JSON.stringify({ output_schema_version: "1.0", locale: "ar-JO",
        utterance: "بلّش قبل حوالي 55 دقيقة، ولسه مستمر ما وقف.", answer_mode: "GROUNDED",
        grounding_fact_ids: ["fact.stemi.symptom-onset"], grounding_state_refs: [], safety_flags: [],
        disclosure_status: "WITHIN_PATIENT_BOUNDARY" }) };
  } };
  const h = await createApiTestHarness({ review_artifact: artifact, enable_patient_conversation: true, patient_provider: provider });
  const sessions: string[] = [];
  for (const boot of [boot1, boot2]) {
    const start = await h.app.request("/v1/review-sessions", { method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: createV2_021ReviewStartKey(boot) }),
      body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, {
        mode: "PRACTICE_DEMO", patient_language: V2_021_PATIENT_LANGUAGE })) });
    expect(start.status).toBe(201);
    const data = (await start.json()).data;
    expect(data.patient_language).toBe("ar-JO");
    expect(data.session.pinned_case).toMatchObject({ case_version: "2.0.1", execution_authority: "REVIEW_ONLY" });
    const session = SessionIdSchema.parse(data.session.session_id);
    sessions.push(session);
    const id = createV2_021RequestIdentity(boot, page1);
    const options = { method: "POST", headers: apiHeaders({ token: "faculty", idempotency: id("idempotency", 4) }),
      body: JSON.stringify(createV2_021QuestionBody(intent, id("utterance", 3))) };
    const response = await h.app.request(`/v1/sessions/${session}/questions`, options);
    expect(response.status).toBe(200);
    const result = (await response.json()).data;
    expect(result.turn).toMatchObject({ answer_mode: "GROUNDED", fallback_used: false, locale: "ar-JO" });
    const retry = await h.app.request(`/v1/sessions/${session}/questions`, options);
    expect(retry.status).toBe(200);
    expect((await retry.json()).data).toMatchObject({ replayed: true, turn: result.turn });
    expect(calls).toBe(sessions.length);
  }
  expect(new Set(sessions).size).toBe(2);
  expect(calls).toBe(2);
});
