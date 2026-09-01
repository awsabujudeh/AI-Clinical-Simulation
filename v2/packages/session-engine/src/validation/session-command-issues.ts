import { z } from "zod";

export const SessionCommandIssueCodeSchema = z.enum([
  "INVALID_SESSION_AGGREGATE",
  "INVALID_COMMAND_INPUT",
  "COMMAND_FINGERPRINT_FAILED",
  "SESSION_ID_MISMATCH",
  "PINNED_CASE_MISMATCH",
  "STATE_VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "UNKNOWN_ACTION_ID",
  "ACTION_PARAMETER_INVALID",
  "ACTION_CONFIRMATION_REQUIRED",
  "ACTION_POLICY_UNSUPPORTED",
  "ACTION_PREREQUISITE_UNMET",
  "ACTION_NOT_REPEATABLE",
  "DUE_WORK_FAILED",
  "COMMAND_WORK_BUDGET_EXCEEDED",
  "CLINICAL_ENGINE_FAILURE",
  "EVENT_CONVERSION_FAILED",
  "EVENT_SEQUENCE_INVALID",
  "INVALID_COORDINATOR_INPUT",
  "SESSION_NOT_FOUND",
  "SESSION_VERSION_CONFLICT",
  "SESSION_ADAPTER_FAILURE",
  "TRUSTED_TIME_REGRESSION",
  "TRUSTED_TIME_PRECISION_INVALID",
  "TIME_SYNCHRONIZATION_FAILED"
]);
export type SessionCommandIssueCode = z.infer<typeof SessionCommandIssueCodeSchema>;

export const SessionCommandIssueSchema = z.strictObject({
  code: SessionCommandIssueCodeSchema,
  path: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(500),
  related_id: z.string().trim().min(1).max(160).optional()
});
export type SessionCommandIssue = z.infer<typeof SessionCommandIssueSchema>;

export function createSessionCommandIssue(
  input: z.input<typeof SessionCommandIssueSchema>
): SessionCommandIssue {
  return SessionCommandIssueSchema.parse(input);
}

export function sortSessionCommandIssues(
  issues: readonly SessionCommandIssue[]
): SessionCommandIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = `${left.path}\u0000${left.code}\u0000${left.related_id ?? ""}\u0000${left.message}`;
    const rightKey = `${right.path}\u0000${right.code}\u0000${right.related_id ?? ""}\u0000${right.message}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function sessionCommandIssuesFromZodError(
  code: Extract<
    SessionCommandIssueCode,
    "INVALID_SESSION_AGGREGATE" | "INVALID_COMMAND_INPUT" | "INVALID_COORDINATOR_INPUT"
  >,
  pathPrefix: string,
  error: z.ZodError
): SessionCommandIssue[] {
  return sortSessionCommandIssues(error.issues.map((issue) => createSessionCommandIssue({
    code,
    path: issue.path.length === 0
      ? pathPrefix
      : `${pathPrefix}.${issue.path.map(String).join(".")}`,
    message: issue.message
  })));
}
