import type { HashAdapter, OwnerAttestedMedicalReview } from "../../contracts/src/index.ts";
import { canonicalSerialize } from "./canonical.ts";
import { prepareReviewExecutionArtifact } from "./review-execution.ts";
import { ReviewExecutionArtifactSchema, type ReviewExecutionArtifact } from "./schemas.ts";

/** The execution hash continues to identify immutable source/review bytes.
 * Approval is a separate trusted envelope bound to that hash, never hashed into
 * the bytes it approves. This cannot manufacture a formal production review. */
export async function approveExpoExecution(
  input: unknown, approval: OwnerAttestedMedicalReview, hash: HashAdapter,
): Promise<ReviewExecutionArtifact> {
  const source = ReviewExecutionArtifactSchema.parse(input);
  if (source.execution_authority !== "REVIEW_ONLY") throw Error("EXPO_SOURCE_MUST_BE_REVIEW_SNAPSHOT");
  const artifact = ReviewExecutionArtifactSchema.parse({ ...source, execution_authority: "APPROVED_EXPO", medical_approval: approval });
  if (!await verifyExpoExecution(artifact, hash)) throw Error("EXPO_APPROVAL_INTEGRITY_FAILED");
  return artifact;
}

/** Recompute all source hashes and technical eligibility before trusted use.
 * Parsing metadata alone is not integrity verification or owner authorization. */
export async function verifyExpoExecution(input: unknown, hash: HashAdapter): Promise<boolean> {
  const parsed = ReviewExecutionArtifactSchema.safeParse(input);
  if (!parsed.success || parsed.data.execution_authority !== "APPROVED_EXPO") return false;
  const a = parsed.data;
  const rebuilt = await prepareReviewExecutionArtifact(a.source_case, hash);
  if (!rebuilt.success) return false;
  const { medical_approval: _approval, ...snapshot } = a;
  return canonicalSerialize({ ...snapshot, execution_authority: "REVIEW_ONLY" }) === canonicalSerialize(rebuilt.artifact);
}
