import { z } from "zod";

import { CaseControlledValueSchema } from "../../../contracts/src/index.ts";

export const ProjectionIssueCodeSchema = z.enum([
  "INVALID_PATIENT_STATE",
  "DUPLICATE_ACTIVE_INTERVENTION_ID",
  "DUPLICATE_ACTIVE_COMPLICATION_ID",
  "INVALID_PROJECTION_DEFINITION",
  "MISSING_HEMODYNAMIC_PROJECTION",
  "MISSING_RESPIRATORY_PROJECTION",
  "MISSING_OXYGENATION_PROJECTION",
  "MISSING_TEMPERATURE_PROJECTION",
  "MISSING_CONSCIOUSNESS_PROJECTION",
  "MISSING_RHYTHM_PROJECTION"
]);
export type ProjectionIssueCode = z.infer<typeof ProjectionIssueCodeSchema>;

export const ProjectionValidationIssueSchema = z.strictObject({
  code: ProjectionIssueCodeSchema,
  path: z.string().min(1).max(300),
  state_value: CaseControlledValueSchema.optional(),
  message: z.string().trim().min(1).max(500)
});
export type ProjectionValidationIssue = z.infer<typeof ProjectionValidationIssueSchema>;

export function createProjectionIssue(
  issue: z.input<typeof ProjectionValidationIssueSchema>
): ProjectionValidationIssue {
  return ProjectionValidationIssueSchema.parse(issue);
}

export function sortProjectionIssues(
  issues: readonly ProjectionValidationIssue[]
): ProjectionValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = [left.path, left.code, left.state_value ?? "", left.message].join("\u0000");
    const rightKey = [right.path, right.code, right.state_value ?? "", right.message].join("\u0000");
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function formatPath(rootPath: string, path: PropertyKey[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${String(segment)}]`;
    }

    return `${result}.${String(segment)}`;
  }, rootPath);
}

export function issuesFromZodError(
  code: "INVALID_PATIENT_STATE" | "INVALID_PROJECTION_DEFINITION",
  rootPath: string,
  error: z.ZodError
): ProjectionValidationIssue[] {
  return error.issues.map((zodIssue) => createProjectionIssue({
    code,
    path: formatPath(rootPath, zodIssue.path),
    message: zodIssue.message
  }));
}
