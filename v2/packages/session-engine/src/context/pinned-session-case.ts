import { z } from "zod";

import {
  EventTypeSchema,
  PinnedClinicalPolicyEnvelopeSchema,
  type ActionType,
  type EventType
} from "../../../contracts/src/index.ts";
import {
  CaseActionDefinitionSchema,
  CompiledCasePackageSchema,
  createPinnedClinicalPolicy
} from "../../../case-schema/src/index.ts";

import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export const PINNED_SESSION_CASE_CONTEXT_SCHEMA_VERSION = "1.0" as const;

const PinnedActionBaseSchema = CaseActionDefinitionSchema.pick({
  action_id: true,
  action_type: true,
  parameter_definitions: true,
  prerequisite_action_ids: true,
  confirmation_policy: true,
  repeat_policy: true
});

export const PinnedSessionActionDefinitionSchema = PinnedActionBaseSchema.extend({
  execution_event_type: EventTypeSchema
});
export type PinnedSessionActionDefinition = z.infer<
  typeof PinnedSessionActionDefinitionSchema
>;

function executionEventTypeForActionType(actionType: ActionType): EventType {
  switch (actionType) {
    case "EXAMINATION": return "EXAM_PERFORMED";
    case "INVESTIGATION": return "INVESTIGATION_ORDERED";
    case "MEDICATION": return "MEDICATION_ORDERED";
    case "PROCEDURE": return "PROCEDURE_ORDERED";
    case "CONSULT": return "CONSULT_REQUESTED";
    case "DIAGNOSIS": return "DIAGNOSIS_SUBMITTED";
    case "DISPOSITION": return "DISPOSITION_SELECTED";
  }
}

export const PinnedSessionCaseContextSchema = z.strictObject({
  context_schema_version: z.literal(PINNED_SESSION_CASE_CONTEXT_SCHEMA_VERSION),
  case_package_id: PinnedClinicalPolicyEnvelopeSchema.shape.case_package_id,
  case_version_id: PinnedClinicalPolicyEnvelopeSchema.shape.case_version_id,
  case_version: PinnedClinicalPolicyEnvelopeSchema.shape.case_version,
  package_hash: PinnedClinicalPolicyEnvelopeSchema.shape.package_hash,
  clinical_policy: PinnedClinicalPolicyEnvelopeSchema,
  action_catalogue: z.array(PinnedSessionActionDefinitionSchema).max(256)
}).superRefine((value, context) => {
  const identityFields = [
    ["case_package_id", value.case_package_id, value.clinical_policy.case_package_id],
    ["case_version_id", value.case_version_id, value.clinical_policy.case_version_id],
    ["case_version", value.case_version, value.clinical_policy.case_version],
    ["package_hash", value.package_hash, value.clinical_policy.package_hash]
  ] as const;
  for (const [field, outer, policy] of identityFields) {
    if (outer !== policy) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `Pinned Session Case ${field} must match its Clinical policy binding.`
      });
    }
  }

  const actionIds = new Set<string>();
  for (const [index, action] of value.action_catalogue.entries()) {
    if (actionIds.has(action.action_id)) {
      context.addIssue({
        code: "custom",
        path: ["action_catalogue", index, "action_id"],
        message: "Pinned Session action identities must be unique."
      });
    }
    actionIds.add(action.action_id);
    if (action.execution_event_type !== executionEventTypeForActionType(action.action_type)) {
      context.addIssue({
        code: "custom",
        path: ["action_catalogue", index, "execution_event_type"],
        message: "Execution event type must match the generic action taxonomy."
      });
    }
  }
});
export type PinnedSessionCaseContext = z.infer<typeof PinnedSessionCaseContextSchema>;

export type PinnedSessionCaseContextResult =
  | { success: true; issues: []; context: PinnedSessionCaseContext }
  | { success: false; issues: SessionCommandIssue[] };

/**
 * Derives the minimal Session-owned view from one validated immutable package.
 * Callers cannot supply a raw action or Clinical-policy sidecar to this boundary.
 */
export function createPinnedSessionCaseContext(
  compiledCasePackageInput: unknown
): PinnedSessionCaseContextResult {
  const casePackage = CompiledCasePackageSchema.safeParse(compiledCasePackageInput);
  if (!casePackage.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_SESSION_AGGREGATE",
        "$.compiled_case_package",
        casePackage.error
      )
    };
  }

  try {
    const clinicalPolicy = createPinnedClinicalPolicy(casePackage.data);
    const context = PinnedSessionCaseContextSchema.safeParse({
      context_schema_version: PINNED_SESSION_CASE_CONTEXT_SCHEMA_VERSION,
      case_package_id: casePackage.data.manifest.case_package_id,
      case_version_id: casePackage.data.manifest.case_version_id,
      case_version: casePackage.data.manifest.case_version,
      package_hash: casePackage.data.package_hash,
      clinical_policy: clinicalPolicy,
      action_catalogue: casePackage.data.action_catalogue.actions.map((action) => ({
        action_id: action.action_id,
        action_type: action.action_type,
        parameter_definitions: action.parameter_definitions,
        prerequisite_action_ids: action.prerequisite_action_ids,
        confirmation_policy: action.confirmation_policy,
        repeat_policy: action.repeat_policy,
        execution_event_type: executionEventTypeForActionType(action.action_type)
      }))
    });
    if (!context.success) {
      return {
        success: false,
        issues: sessionCommandIssuesFromZodError(
          "INVALID_SESSION_AGGREGATE",
          "$.pinned_case",
          context.error
        )
      };
    }
    return { success: true, issues: [], context: context.data };
  } catch (error) {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "INVALID_SESSION_AGGREGATE",
        path: "$.compiled_case_package.validation.reviews",
        message: error instanceof Error
          ? error.message
          : "Compiled Case Package could not produce a pinned Clinical policy."
      })]
    };
  }
}
