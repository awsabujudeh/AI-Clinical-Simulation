import {
  ASSESSMENT_DEBRIEF_EVIDENCE_SCHEMA_VERSION,
  AssessmentResultSchema,
  DebriefEvidencePackageSchema,
  type DebriefEvidencePackage
} from "../../../contracts/src/index.ts";

import {
  assessmentIssue,
  assessmentIssuesFromZodError,
  type AssessmentIssue
} from "../validation/assessment-issues.ts";

export type DebriefEvidencePackageResult =
  | { success: true; issues: []; evidence: DebriefEvidencePackage }
  | { success: false; issues: AssessmentIssue[] };

/** Packages final deterministic facts without generating feedback or conclusions. */
export function createDebriefEvidencePackage(
  assessmentResultInput: unknown
): DebriefEvidencePackageResult {
  const result = AssessmentResultSchema.safeParse(assessmentResultInput);
  if (!result.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.assessment_result", result.error)
    };
  }
  if (
    result.data.evaluation_phase !== "FINAL"
    || result.data.finalization_boundary === undefined
  ) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "FINAL_ASSESSMENT_REQUIRED",
        path: "$.assessment_result.evaluation_phase",
        message: "Debrief evidence can be created only from final assessment truth.",
        related_ids: [result.data.assessment_id]
      })]
    };
  }

  const evidence = DebriefEvidencePackageSchema.safeParse({
    debrief_schema_version: ASSESSMENT_DEBRIEF_EVIDENCE_SCHEMA_VERSION,
    authority: "DETERMINISTIC_ASSESSMENT_EVIDENCE",
    finalization_boundary: result.data.finalization_boundary,
    assessment_result: result.data
  });
  if (!evidence.success) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "ASSESSMENT_RESULT_INVALID",
        path: "$.debrief_evidence",
        message: "Final assessment truth could not form a strict debrief evidence package.",
        related_ids: [result.data.assessment_id]
      })]
    };
  }
  return { success: true, issues: [], evidence: evidence.data };
}
