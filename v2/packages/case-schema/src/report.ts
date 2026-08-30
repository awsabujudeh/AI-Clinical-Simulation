import { z } from "zod";

import { CaseModuleNameSchema } from "./schemas.ts";

export const ValidationModeSchema = z.enum(["DRAFT", "CANDIDATE", "PUBLICATION"]);
export type ValidationMode = z.infer<typeof ValidationModeSchema>;

export const ValidationIssueSeveritySchema = z.enum(["ERROR", "WARNING", "INFO"]);
export type ValidationIssueSeverity = z.infer<typeof ValidationIssueSeveritySchema>;

export const ValidationIssueCodeSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u, "Expected a stable validation issue code");
export type ValidationIssueCode = z.infer<typeof ValidationIssueCodeSchema>;

export const CaseValidationIssueSchema = z.strictObject({
  code: ValidationIssueCodeSchema,
  severity: ValidationIssueSeveritySchema,
  module: CaseModuleNameSchema.optional(),
  path: z.string().min(1).max(300),
  related_ids: z.array(z.string().min(1).max(200)).max(64),
  message: z.string().trim().min(1).max(500)
});
export type CaseValidationIssue = z.infer<typeof CaseValidationIssueSchema>;

export const CaseValidationReportSchema = z.strictObject({
  mode: ValidationModeSchema,
  valid: z.boolean(),
  publishable: z.boolean(),
  issues: z.array(CaseValidationIssueSchema)
});
export type CaseValidationReport = z.infer<typeof CaseValidationReportSchema>;

const severityOrder: Record<ValidationIssueSeverity, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2
};

export function sortValidationIssues(
  issues: readonly CaseValidationIssue[]
): CaseValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = [
      String(severityOrder[left.severity]),
      left.module ?? "",
      left.path,
      left.code,
      left.related_ids.join("|"),
      left.message
    ].join("\u0000");
    const rightKey = [
      String(severityOrder[right.severity]),
      right.module ?? "",
      right.path,
      right.code,
      right.related_ids.join("|"),
      right.message
    ].join("\u0000");

    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function createValidationReport(
  mode: ValidationMode,
  issues: readonly CaseValidationIssue[]
): CaseValidationReport {
  const sortedIssues = sortValidationIssues(issues).map((issue) =>
    CaseValidationIssueSchema.parse(issue)
  );
  const valid = !sortedIssues.some((issue) => issue.severity === "ERROR");

  return CaseValidationReportSchema.parse({
    mode,
    valid,
    publishable: mode === "PUBLICATION" && valid,
    issues: sortedIssues
  });
}

export function formatValidationReport(report: CaseValidationReport): string {
  const lines = [
    "CASE_SCHEMA_VALIDATION_REPORT",
    `mode=${report.mode}`,
    `valid=${String(report.valid)}`,
    `publishable=${String(report.publishable)}`,
    `issue_count=${String(report.issues.length)}`
  ];

  if (report.issues.length === 0) {
    lines.push("NO_ISSUES");
  } else {
    for (const issue of report.issues) {
      const moduleText = issue.module ?? "package";
      const relatedText = issue.related_ids.length === 0
        ? "-"
        : issue.related_ids.join(",");
      lines.push(
        `[${issue.severity}] ${issue.code} module=${moduleText} path=${issue.path} related=${relatedText} :: ${issue.message}`
      );
    }
  }

  return lines.join("\n");
}
