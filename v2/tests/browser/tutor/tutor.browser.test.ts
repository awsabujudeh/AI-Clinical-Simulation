import { describe, it, expect } from "vitest";
import { TutorDebriefSchema, TutorDebriefRequestSchema, TutorOutputLocaleSchema } from "../../../packages/contracts/src/index.ts";
import { buildTutorEvidence, generateTutorDebrief, createKnowledgeRetrieval } from "../../../packages/ai-gateway/src/index.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import { tutorFixture, tutorSnapshot, tutorTestGateway } from "../../fixtures/tutor.ts";
import { knowledgeFixture, clinicalQuery } from "../../fixtures/knowledge/synthetic-knowledge.ts";

describe("evidence-bound Expo Tutor", () => {
  it("keeps immutable deterministic score, six domains, criteria and evidence outside AI authority", async () => {
    const f = await tutorFixture(); const before = canonicalSerialize(f.packet);
    const r = await generateTutorDebrief({ ...f, gateway: tutorTestGateway().gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
    expect(r.tutor_status).toBe("AI_ASSISTED"); expect(r.packet.assessment).toEqual(f.assessment);
    expect(r.packet.assessment.domain_scores).toHaveLength(6); expect(canonicalSerialize(f.packet)).toBe(before);
    expect(TutorDebriefSchema.safeParse(r).success).toBe(true);
  });
  it.each([
    { priority_criterion_ids: [], evidence_chunk_ids: [], overall_score_basis_points: 10000 },
    { priority_criterion_ids: ["rubric-item.invented"], evidence_chunk_ids: [] },
    { priority_criterion_ids: [], evidence_chunk_ids: ["invented-citation"] },
    { priority_criterion_ids: [], evidence_chunk_ids: [], narrative: "Official JU guideline approval" }
  ])("rejects model-authored scores, new findings, fabricated citations and alignment", async output => {
    const f = await tutorFixture(); const r = await generateTutorDebrief({ ...f, gateway: tutorTestGateway(output).gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
    expect(r.tutor_status).toBe("TEMPLATE_FALLBACK"); expect(r.packet.assessment).toEqual(f.assessment);
    expect(r.plan.evidence_chunk_ids).toEqual([]);
  });
  it("maps missed critical actions and exact Clinical-Time evidence without interpreting UI time", async () => {
    const missed = await tutorFixture(); const done = await tutorFixture(true);
    expect(missed.packet.criteria.some(c => c.criterion.criterion_kind === "CRITICAL_ACTION" && c.criterion.status === "TRIGGERED")).toBe(true);
    expect(done.packet.assessment.evidence_records.some(e => e.evidence_kind === "COMMITTED_EVENT" && e.clinical_time === 30)).toBe(true);
    expect(done.packet.criteria.some(c => c.timing_description !== null)).toBe(true);
    expect(done.packet.criteria.map(c => c.criterion)).toEqual(done.assessment.criterion_results);
  });
  it("no completed criterion can be presented as an AI learning failure", async () => {
    const f = await tutorFixture(true); const id = f.packet.criteria.find(c => c.criterion.status === "SATISFIED")!.criterion.rubric_item_id;
    const r = await generateTutorDebrief({ ...f, gateway: tutorTestGateway({ priority_criterion_ids: [id], evidence_chunk_ids: [] }).gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
    expect(r.tutor_status).toBe("TEMPLATE_FALLBACK"); expect(r.plan.priority_criterion_ids).not.toContain(id);
  });
  it("AI outage keeps all assessment and case feedback; unavailable RAG supplies no citations/alignment", async () => {
    const f = await tutorFixture(); const r = await generateTutorDebrief({ ...f, gateway: tutorTestGateway(undefined, true).gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
    expect(r.tutor_status).toBe("TEMPLATE_FALLBACK"); expect(r.packet.assessment).toEqual(f.assessment);
    expect(r.packet.clinical_source_status).toBe("RETRIEVAL_UNAVAILABLE"); expect(r.packet.curriculum_status).toBe("CURRICULUM_SOURCE_PENDING");
    expect(r.packet.clinical_evidence).toEqual([]); expect(r.packet.curriculum_evidence).toEqual([]);
  });
  it("rejects package/rubric mismatches and non-final production assessment", async () => {
    const f = await tutorFixture(); const common = { artifact: f.artifact, locale: TutorOutputLocaleSchema.parse("en-US"), institution_id: "ju" };
    expect(buildTutorEvidence({ ...common, assessment: { ...f.assessment, package_hash: "0".repeat(64) } })).toBeUndefined();
    expect(buildTutorEvidence({ ...common, assessment: { ...f.assessment, rubric_module_hash: "0".repeat(64) } })).toBeUndefined();
    expect(buildTutorEvidence({ ...common, assessment: { ...f.assessment, evaluation_phase: "LIVE", finalization_boundary: undefined } })).toBeUndefined();
  });
  it("request cannot inject a score, raw rubric, model, curriculum, Case facts or action", () => {
    for (const key of ["score", "rubric", "model", "curriculum", "case", "action"])
      expect(TutorDebriefRequestSchema.safeParse({ locale: "en-US", [key]: {} }).success).toBe(false);
  });
  it("accepts only exact approved retrieval references; no fabricated metadata or curriculum claims", async () => {
    const f = await tutorFixture(); const k = await knowledgeFixture();
    const service = await createKnowledgeRetrieval({ ...k, expected_bundle_hash: k.bundle.bundle_hash }); if (!service.success) throw Error(service.code);
    const retrieval = await service.retrieve(clinicalQuery());
    const packet = buildTutorEvidence({ artifact: f.artifact, assessment: f.assessment, locale: TutorOutputLocaleSchema.parse("en-US"), institution_id: "ju", retrieval })!;
    const id = retrieval.clinical_evidence[0]!.chunk_id;
    const r = await generateTutorDebrief({ packet, hash: f.hash, gateway: tutorTestGateway({ priority_criterion_ids: [packet.criteria[0]!.criterion.rubric_item_id], evidence_chunk_ids: [id] }).gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
    expect(r.tutor_status).toBe("AI_ASSISTED"); expect(r.packet.clinical_evidence).toEqual(retrieval.clinical_evidence);
    expect(r.packet.curriculum_status).toBe("CURRICULUM_SOURCE_PENDING");
  });
  it("Browser canonical snapshot is deterministic", async () => {
    const a = await tutorSnapshot(), b = await tutorSnapshot();
    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
    const f = await tutorFixture();
    expect(await f.hash.sha256(canonicalSerialize(a))).toBe("d193339fbe2a1f9c3891932c3f1b7ed3f440a67275c3650ec09209e22808a5ad");
  });
});
