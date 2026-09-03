import { z } from "zod";

import {
  CasePackageIdSchema,
  CaseVersionIdSchema,
  RubricIdSchema,
  SchemaVersionSchema,
  SemanticVersionSchema,
  Sha256DigestSchema
} from "../../../contracts/src/index.ts";
import {
  AssessmentRubricModuleSchema,
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema
} from "../../../case-schema/src/index.ts";

import {
  assessmentIssue,
  assessmentIssuesFromZodError,
  type AssessmentIssue
} from "../validation/assessment-issues.ts";

export const PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION = "1.0" as const;

export const PinnedAssessmentContextSchema = z.strictObject({
  context_schema_version: z.literal(PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION),
  execution_authority: z.literal("PUBLISHED_PRODUCTION"),
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  package_hash: Sha256DigestSchema,
  rubric_id: RubricIdSchema,
  rubric_version: SemanticVersionSchema,
  rubric_module_schema_version: SchemaVersionSchema,
  rubric_module_hash: Sha256DigestSchema,
  rubric: AssessmentRubricModuleSchema,
  timing_windows: CompiledCasePackageSchema.shape.timeline_policy.shape.timing_windows
}).superRefine((value, context) => {
  if (value.rubric.rubric_id !== value.rubric_id) {
    context.addIssue({
      code: "custom",
      path: ["rubric_id"],
      message: "Pinned rubric identity must match the embedded immutable rubric."
    });
  }
  if (value.rubric.rubric_version !== value.rubric_version) {
    context.addIssue({
      code: "custom",
      path: ["rubric_version"],
      message: "Pinned rubric version must match the embedded immutable rubric."
    });
  }
  if (value.rubric.module_schema_version !== value.rubric_module_schema_version) {
    context.addIssue({
      code: "custom",
      path: ["rubric_module_schema_version"],
      message: "Pinned rubric module schema version must match its immutable module."
    });
  }
});
export type PinnedAssessmentContext = z.infer<typeof PinnedAssessmentContextSchema>;

export const PinnedReviewAssessmentContextSchema = z.strictObject({
  context_schema_version: z.literal(PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION),
  execution_authority: z.literal("REVIEW_ONLY"),
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  review_execution_hash: Sha256DigestSchema,
  review_subject_hash: Sha256DigestSchema,
  rubric_id: RubricIdSchema,
  rubric_version: SemanticVersionSchema,
  rubric_module_schema_version: SchemaVersionSchema,
  rubric_module_hash: Sha256DigestSchema,
  rubric: AssessmentRubricModuleSchema,
  timing_windows: CompiledCasePackageSchema.shape.timeline_policy.shape.timing_windows
}).superRefine((value, context) => {
  if (value.rubric.rubric_id !== value.rubric_id) {
    context.addIssue({ code: "custom", path: ["rubric_id"], message: "Pinned review rubric identity must match its module." });
  }
  if (value.rubric.rubric_version !== value.rubric_version) {
    context.addIssue({ code: "custom", path: ["rubric_version"], message: "Pinned review rubric version must match its module." });
  }
  if (value.rubric.module_schema_version !== value.rubric_module_schema_version) {
    context.addIssue({ code: "custom", path: ["rubric_module_schema_version"], message: "Pinned review rubric schema version must match its module." });
  }
});
export type PinnedReviewAssessmentContext = z.infer<
  typeof PinnedReviewAssessmentContextSchema
>;

export type PinnedAssessmentContextResult =
  | { success: true; issues: []; context: PinnedAssessmentContext }
  | { success: false; issues: AssessmentIssue[] };

/** Derives assessment authority only from one validated immutable Case Package. */
export function createPinnedAssessmentContext(
  compiledCasePackageInput: unknown
): PinnedAssessmentContextResult {
  const casePackage = CompiledCasePackageSchema.safeParse(compiledCasePackageInput);
  if (!casePackage.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.compiled_case_package", casePackage.error)
    };
  }

  const rubricModuleHash = casePackage.data.manifest.module_hashes.assessment_rubric;
  if (rubricModuleHash === undefined) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "RUBRIC_PROVENANCE_INVALID",
        path: "$.compiled_case_package.manifest.module_hashes.assessment_rubric",
        message: "Compiled Case Package must bind the assessment rubric module hash.",
        related_ids: [casePackage.data.assessment_rubric.rubric_id]
      })]
    };
  }

  const context = PinnedAssessmentContextSchema.safeParse({
    context_schema_version: PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    case_package_id: casePackage.data.manifest.case_package_id,
    case_version_id: casePackage.data.manifest.case_version_id,
    case_version: casePackage.data.manifest.case_version,
    package_hash: casePackage.data.package_hash,
    rubric_id: casePackage.data.assessment_rubric.rubric_id,
    rubric_version: casePackage.data.assessment_rubric.rubric_version,
    rubric_module_schema_version: casePackage.data.assessment_rubric.module_schema_version,
    rubric_module_hash: rubricModuleHash,
    rubric: casePackage.data.assessment_rubric,
    timing_windows: casePackage.data.timeline_policy.timing_windows
  });
  if (!context.success) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "RUBRIC_PROVENANCE_INVALID",
        path: "$.compiled_case_package.assessment_rubric",
        message: "Compiled assessment rubric could not form a pinned immutable context.",
        related_ids: [casePackage.data.assessment_rubric.rubric_id]
      })]
    };
  }
  return { success: true, issues: [], context: context.data };
}

export type PinnedReviewAssessmentContextResult =
  | { success: true; issues: []; context: PinnedReviewAssessmentContext }
  | { success: false; issues: AssessmentIssue[] };

/** Derives deterministic scoring authority only from a review artifact. */
export function createPinnedReviewAssessmentContext(
  reviewArtifactInput: unknown
): PinnedReviewAssessmentContextResult {
  const artifact = ReviewExecutionArtifactSchema.safeParse(reviewArtifactInput);
  if (!artifact.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.review_execution_artifact", artifact.error)
    };
  }
  const sourceCase = artifact.data.source_case;
  const rubricModuleHash = artifact.data.module_hashes.assessment_rubric;
  if (rubricModuleHash === undefined) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "RUBRIC_PROVENANCE_INVALID",
        path: "$.review_execution_artifact.module_hashes.assessment_rubric",
        message: "Review artifact must bind the assessment rubric module hash.",
        related_ids: [sourceCase.assessment_rubric.rubric_id]
      })]
    };
  }
  const context = PinnedReviewAssessmentContextSchema.safeParse({
    context_schema_version: PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION,
    execution_authority: "REVIEW_ONLY",
    case_package_id: artifact.data.source_identity.case_package_id,
    case_version_id: artifact.data.source_identity.case_version_id,
    case_version: artifact.data.source_identity.case_version,
    review_execution_hash: artifact.data.review_execution_hash,
    review_subject_hash: artifact.data.review_subject_hash,
    rubric_id: sourceCase.assessment_rubric.rubric_id,
    rubric_version: sourceCase.assessment_rubric.rubric_version,
    rubric_module_schema_version: sourceCase.assessment_rubric.module_schema_version,
    rubric_module_hash: rubricModuleHash,
    rubric: sourceCase.assessment_rubric,
    timing_windows: sourceCase.timeline_policy.timing_windows
  });
  return context.success
    ? { success: true, issues: [], context: context.data }
    : {
        success: false,
        issues: [assessmentIssue({
          code: "RUBRIC_PROVENANCE_INVALID",
          path: "$.review_execution_artifact.source_case.assessment_rubric",
          message: "Review assessment rubric could not form a pinned immutable context.",
          related_ids: [sourceCase.assessment_rubric.rubric_id]
        })]
      };
}
