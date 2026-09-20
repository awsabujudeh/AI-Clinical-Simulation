import { z } from "zod";
import { AssessmentResultSchema, AssessmentCriterionResultSchema } from "./assessment.ts";
import { TutorOutputLocaleSchema } from "./locales.ts";
import { KnowledgeEvidenceSchema } from "./knowledge.ts";
import { Sha256DigestSchema, RubricItemIdSchema } from "./ids.ts";

// No client-provided evidence, score, Case, institution, model or prompt.
export const TutorDebriefRequestSchema = z.strictObject({ locale: TutorOutputLocaleSchema });
export const TutorCriterionCardSchema = z.strictObject({
  criterion: AssessmentCriterionResultSchema,
  action_labels: z.array(z.string()).max(32),
  event_types: z.array(z.string()).max(32),
  timing_description: z.string().nullable()
});
export const TutorEvidencePacketSchema = z.strictObject({
  schema_version: z.literal("1.0"), authority: z.literal("DETERMINISTIC_CASE_FEEDBACK"),
  mode: z.enum(["FINAL_DEBRIEF", "REVIEW_SNAPSHOT"]), locale: TutorOutputLocaleSchema,
  assessment: AssessmentResultSchema,
  domain_labels: z.array(z.strictObject({ domain_id: z.string(), label: z.string() })).length(6),
  criteria: z.array(TutorCriterionCardSchema).max(1024),
  authored_competencies: z.array(z.string()).max(512),
  clinical_source_status: z.enum(["AVAILABLE", "SOURCE_PENDING", "RETRIEVAL_UNAVAILABLE"]),
  curriculum_status: z.enum(["APPROVED_MAPPING_AVAILABLE", "CURRICULUM_SOURCE_PENDING"]),
  clinical_evidence: z.array(KnowledgeEvidenceSchema).max(6),
  curriculum_evidence: z.array(KnowledgeEvidenceSchema).max(6)
});
export type TutorEvidencePacket = z.infer<typeof TutorEvidencePacketSchema>;

// Provider selects references, not new clinical prose or authoritative facts.
// The server renders localized explanations from the immutable evidence packet.
export const TutorPlanSchema = z.strictObject({
  priority_criterion_ids: z.array(RubricItemIdSchema).max(5),
  evidence_chunk_ids: z.array(z.string().min(1).max(160)).max(6)
});
export type TutorPlan = z.infer<typeof TutorPlanSchema>;
export const TutorDebriefSchema = z.strictObject({
  schema_version: z.literal("1.0"), authority: z.literal("NON_AUTHORITATIVE_EDUCATIONAL_FEEDBACK"),
  packet_hash: Sha256DigestSchema, packet: TutorEvidencePacketSchema,
  tutor_status: z.enum(["AI_ASSISTED", "TEMPLATE_FALLBACK"]),
  failure_code: z.enum(["NONE", "TUTOR_UNAVAILABLE", "TUTOR_OUTPUT_REJECTED"]),
  prompt_version: z.literal("1.0"), model_policy: z.literal("model-policy.tutor.terra-v1"),
  plan: TutorPlanSchema
});
export type TutorDebrief = z.infer<typeof TutorDebriefSchema>;
