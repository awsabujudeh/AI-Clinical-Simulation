import { z } from "zod";

import {
  CaseControlledValueSchema,
  RuleEffectIdSchema,
  RuleIdSchema,
  ScheduledItemIdSchema
} from "../../../contracts/src/index.ts";

export const ClinicalTransitionIssueCodeSchema = z.enum([
  "INVALID_TRANSITION_INPUT",
  "INVALID_RULE_DEFINITION",
  "INVALID_SCHEDULER_STATE",
  "DUPLICATE_SCHEDULED_ITEM_ID",
  "CLINICAL_TIME_REGRESSION",
  "SCHEDULED_TIME_IN_PAST",
  "SCHEDULER_NON_PROGRESS",
  "SCHEDULED_TIME_NONFINITE",
  "UNRESOLVED_EFFECT_CONFLICT",
  "MIXED_CONFLICT_POLICIES",
  "IDENTITY_CONFLICT",
  "EVALUATION_BUDGET_EXCEEDED",
  "PINNED_POLICY_MISMATCH",
  "INVALID_NEXT_PATIENT_STATE",
  "OBSERVATION_PROJECTION_FAILED",
  "CYCLE_DETECTED",
  "CYCLE_GUARD_EXCEEDED"
]);
export type ClinicalTransitionIssueCode = z.infer<
  typeof ClinicalTransitionIssueCodeSchema
>;

export const ClinicalTransitionIssueSchema = z.strictObject({
  code: ClinicalTransitionIssueCodeSchema,
  path: z.string().min(1).max(300),
  message: z.string().trim().min(1).max(500),
  rule_id: RuleIdSchema.optional(),
  effect_id: RuleEffectIdSchema.optional(),
  scheduled_item_id: ScheduledItemIdSchema.optional(),
  state_channel: z.string().min(1).max(160).optional(),
  detail_code: CaseControlledValueSchema.optional()
});
export type ClinicalTransitionIssue = z.infer<typeof ClinicalTransitionIssueSchema>;

export function createTransitionIssue(
  input: z.input<typeof ClinicalTransitionIssueSchema>
): ClinicalTransitionIssue {
  return ClinicalTransitionIssueSchema.parse(input);
}

export function sortTransitionIssues(
  issues: readonly ClinicalTransitionIssue[]
): ClinicalTransitionIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = [
      left.path,
      left.code,
      left.rule_id ?? "",
      left.effect_id ?? "",
      left.scheduled_item_id ?? "",
      left.state_channel ?? "",
      left.detail_code ?? "",
      left.message
    ].join("\u0000");
    const rightKey = [
      right.path,
      right.code,
      right.rule_id ?? "",
      right.effect_id ?? "",
      right.scheduled_item_id ?? "",
      right.state_channel ?? "",
      right.detail_code ?? "",
      right.message
    ].join("\u0000");

    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

export function transitionIssuesFromZodError(
  code: "INVALID_TRANSITION_INPUT" | "INVALID_RULE_DEFINITION" | "INVALID_SCHEDULER_STATE",
  rootPath: string,
  error: z.ZodError
): ClinicalTransitionIssue[] {
  return error.issues.map((zodIssue) => {
    const suffix = zodIssue.path.reduce<string>((result, segment) =>
      typeof segment === "number"
        ? `${result}[${String(segment)}]`
        : `${result}.${String(segment)}`, "");

    return createTransitionIssue({
      code,
      path: `${rootPath}${suffix}`,
      message: zodIssue.message
    });
  });
}
