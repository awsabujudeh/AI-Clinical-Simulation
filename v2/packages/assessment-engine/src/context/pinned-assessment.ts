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
  CompiledCasePackageSchema
} from "../../../case-schema/src/index.ts";

import {
  assessmentIssue,
  assessmentIssuesFromZodError,
  type AssessmentIssue
} from "../validation/assessment-issues.ts";

export const PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION = "1.0" as const;

export const PinnedAssessmentContextSchema = z.strictObject({
  context_schema_version: z.literal(PINNED_ASSESSMENT_CONTEXT_SCHEMA_VERSION),
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
