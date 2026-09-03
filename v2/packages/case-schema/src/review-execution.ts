import type { HashAdapter } from "../../contracts/src/index.ts";

import { computeModuleHashes, computeReviewSubjectHash, hashCanonicalJson } from "./hashing.ts";
import {
  CaseValidationIssueSchema,
  createValidationReport,
  type CaseValidationReport
} from "./report.ts";
import {
  CompiledCasePackageSchema,
  REVIEW_EXECUTION_ARTIFACT_SCHEMA_VERSION,
  ReviewExecutionSourceCaseSchema,
  ReviewExecutionArtifactSchema,
  type ReviewExecutionArtifact
} from "./schemas.ts";
import { validateForReviewExecution } from "./validation.ts";

export type ReviewExecutionArtifactResult =
  | { success: false; report: CaseValidationReport }
  | {
      success: true;
      report: CaseValidationReport;
      artifact: ReviewExecutionArtifact;
    };

/**
 * Builds the exact immutable REVIEW_ONLY bytes after technical validation.
 * review_execution_hash covers every field below except itself; no approval,
 * publication, reviewer identity, or operational timestamp is synthesized.
 */
export async function prepareReviewExecutionArtifact(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<ReviewExecutionArtifactResult> {
  const report = await validateForReviewExecution(input, hashAdapter);
  if (!report.valid) return { success: false, report };

  try {
    const sourceCase = ReviewExecutionSourceCaseSchema.parse(input);
    const moduleHashes = await computeModuleHashes(sourceCase, hashAdapter);
    const reviewSubjectHash = await computeReviewSubjectHash(sourceCase, hashAdapter);
    const withoutSelfHash = {
      artifact_kind: "REVIEW_EXECUTION_ARTIFACT" as const,
      artifact_schema_version: REVIEW_EXECUTION_ARTIFACT_SCHEMA_VERSION,
      execution_authority: "REVIEW_ONLY" as const,
      hash_algorithm: "SHA-256" as const,
      source_identity: {
        case_package_id: sourceCase.manifest.case_package_id,
        case_version_id: sourceCase.manifest.case_version_id,
        case_version: sourceCase.manifest.case_version,
        case_schema_version: sourceCase.manifest.schema_version,
        source_lifecycle: "UNDER_REVIEW" as const
      },
      module_hashes: moduleHashes,
      review_subject_hash: reviewSubjectHash,
      source_case: sourceCase
    };
    const reviewExecutionHash = await hashCanonicalJson(withoutSelfHash, hashAdapter);
    const artifact = ReviewExecutionArtifactSchema.safeParse({
      ...withoutSelfHash,
      review_execution_hash: reviewExecutionHash
    });
    if (!artifact.success) throw new Error("Review artifact schema validation failed.");
    return { success: true, report, artifact: artifact.data };
  } catch {
    return {
      success: false,
      report: createValidationReport("REVIEW_EXECUTION", [
        ...report.issues,
        CaseValidationIssueSchema.parse({
          code: "HASH_ADAPTER_FAILURE",
          severity: "ERROR",
          path: "$",
          related_ids: [],
          message: "The supplied hash adapter could not prepare a valid review execution artifact."
        })
      ])
    };
  }
}

/** Minimal production-playability boundary; REVIEW_ONLY artifacts fail it. */
export function isProductionPlayableCaseArtifact(
  input: unknown
): boolean {
  return CompiledCasePackageSchema.safeParse(input).success;
}
