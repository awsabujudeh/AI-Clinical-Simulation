import { z } from "zod";
import { CaseIdSchema, CaseVersionIdSchema, SemanticVersionSchema, Sha256DigestSchema } from "./ids.ts";

/** External governance evidence, never a Student command. No invented reviewer
 * identity or physician timestamp. A formal ReviewRecord remains a separate,
 * stronger evidence type and retains every existing production requirement. */
export const OwnerAttestedMedicalReviewSchema = z.strictObject({
  evidence_schema_version: z.literal("1.0"),
  review_evidence_type: z.literal("OWNER_ATTESTED_PHYSICIAN_REVIEW"),
  medical_review_status: z.literal("APPROVED_FOR_EXPO"),
  reviewer_role: z.literal("PHYSICIAN"),
  reviewer_identity_status: z.literal("NOT_FORMALLY_RECORDED"),
  review_timestamp_status: z.literal("NOT_FORMALLY_RECORDED"),
  attested_by: z.literal("OWNER"),
  attestation_status: z.literal("CONFIRMED"),
  production_publication: z.literal("NOT_PUBLISHED"),
  case_id: CaseIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  reviewed_execution_hash: Sha256DigestSchema,
  review_subject_hash: Sha256DigestSchema,
  shared_catalogue_id: z.string().min(1).max(160),
  shared_catalogue_version: SemanticVersionSchema,
});
export type OwnerAttestedMedicalReview = z.infer<typeof OwnerAttestedMedicalReviewSchema>;
