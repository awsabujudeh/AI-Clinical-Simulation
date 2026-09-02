import { z } from "zod";

export const AssessmentIssueCodeSchema = z.enum([
  "INVALID_ASSESSMENT_INPUT",
  "PINNED_ASSESSMENT_MISMATCH",
  "RUBRIC_PROVENANCE_INVALID",
  "TIMING_WINDOW_REFERENCE_INVALID",
  "FINALIZATION_BOUNDARY_INVALID",
  "DISCLOSURE_CONTEXT_INVALID",
  "DISCLOSURE_PROVENANCE_MISMATCH",
  "FINAL_ASSESSMENT_REQUIRED",
  "ASSESSMENT_EVALUATION_FAILED",
  "ASSESSMENT_RESULT_INVALID"
]);
export type AssessmentIssueCode = z.infer<typeof AssessmentIssueCodeSchema>;

export const AssessmentIssueSchema = z.strictObject({
  code: AssessmentIssueCodeSchema,
  path: z.string().trim().min(1).max(400),
  message: z.string().trim().min(1).max(600),
  related_ids: z.array(z.string().trim().min(1).max(160)).max(16)
});
export type AssessmentIssue = z.infer<typeof AssessmentIssueSchema>;

export function assessmentIssue(
  input: z.input<typeof AssessmentIssueSchema>
): AssessmentIssue {
  return AssessmentIssueSchema.parse(input);
}

export function sortAssessmentIssues(
  issues: readonly AssessmentIssue[]
): AssessmentIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = `${left.path}\u0000${left.code}\u0000${left.related_ids.join("\u0000")}\u0000${left.message}`;
    const rightKey = `${right.path}\u0000${right.code}\u0000${right.related_ids.join("\u0000")}\u0000${right.message}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function assessmentIssuesFromZodError(
  pathPrefix: string,
  error: z.ZodError
): AssessmentIssue[] {
  return sortAssessmentIssues(error.issues.map((issue) => assessmentIssue({
    code: "INVALID_ASSESSMENT_INPUT",
    path: issue.path.length === 0
      ? pathPrefix
      : `${pathPrefix}.${issue.path.map(String).join(".")}`,
    message: issue.message,
    related_ids: []
  })));
}
