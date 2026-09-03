import { z } from "zod";

import {
  EventTypeSchema,
  PinnedReviewClinicalPolicyEnvelopeSchema,
  PinnedClinicalPolicyEnvelopeSchema,
  type ActionType,
  type EventType
} from "../../../contracts/src/index.ts";
import {
  CaseActionDefinitionSchema,
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema,
  createPinnedClinicalPolicy,
  createPinnedReviewClinicalPolicy
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
  repeat_policy: true,
  investigation: true
});

export const PinnedSessionActionDefinitionSchema = PinnedActionBaseSchema.extend({
  execution_event_type: EventTypeSchema
}).superRefine((action, context) => {
  if (action.action_type === "INVESTIGATION" && action.investigation === undefined) {
    context.addIssue({
      code: "custom",
      path: ["investigation"],
      message: "A pinned INVESTIGATION action requires its Case-owned diagnostic definition."
    });
  }
  if (action.action_type !== "INVESTIGATION" && action.investigation !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["investigation"],
      message: "Only a pinned INVESTIGATION action may carry a diagnostic definition."
    });
  }
  if (action.investigation?.execution_mode === "BLOCKING_PATIENT_UNAVAILABLE") {
    context.addIssue({
      code: "custom",
      path: ["investigation", "execution_mode"],
      message: "Blocking/patient-unavailable investigations are not supported by this Session runtime."
    });
  }
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

const pinnedSessionContextCommonShape = {
  context_schema_version: z.literal(PINNED_SESSION_CASE_CONTEXT_SCHEMA_VERSION),
  case_package_id: PinnedClinicalPolicyEnvelopeSchema.shape.case_package_id,
  case_version_id: PinnedClinicalPolicyEnvelopeSchema.shape.case_version_id,
  case_version: PinnedClinicalPolicyEnvelopeSchema.shape.case_version,
  action_catalogue: z.array(PinnedSessionActionDefinitionSchema).max(256)
} as const;

function refinePinnedSessionContext(
  value: {
    case_package_id: string;
    case_version_id: string;
    case_version: string;
    action_catalogue: readonly PinnedSessionActionDefinition[];
    clinical_policy: {
      case_package_id: string;
      case_version_id: string;
      case_version: string;
    };
  },
  context: z.RefinementCtx
): void {
  const identityFields = [
    ["case_package_id", value.case_package_id, value.clinical_policy.case_package_id],
    ["case_version_id", value.case_version_id, value.clinical_policy.case_version_id],
    ["case_version", value.case_version, value.clinical_policy.case_version]
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
}

export const PinnedSessionCaseContextSchema = z.strictObject({
  ...pinnedSessionContextCommonShape,
  execution_authority: z.literal("PUBLISHED_PRODUCTION"),
  package_hash: PinnedClinicalPolicyEnvelopeSchema.shape.package_hash,
  clinical_policy: PinnedClinicalPolicyEnvelopeSchema
}).superRefine((value, context) => {
  refinePinnedSessionContext(value, context);
  if (value.package_hash !== value.clinical_policy.package_hash) {
    context.addIssue({
      code: "custom",
      path: ["package_hash"],
      message: "Pinned Session Case package hash must match its Clinical policy binding."
    });
  }
});
export type PinnedSessionCaseContext = z.infer<typeof PinnedSessionCaseContextSchema>;

export const PinnedReviewSessionCaseContextSchema = z.strictObject({
  ...pinnedSessionContextCommonShape,
  execution_authority: z.literal("REVIEW_ONLY"),
  review_execution_hash: PinnedReviewClinicalPolicyEnvelopeSchema.shape.review_execution_hash,
  review_subject_hash: PinnedReviewClinicalPolicyEnvelopeSchema.shape.review_subject_hash,
  clinical_policy: PinnedReviewClinicalPolicyEnvelopeSchema
}).superRefine((value, context) => {
  refinePinnedSessionContext(value, context);
  if (value.review_execution_hash !== value.clinical_policy.review_execution_hash) {
    context.addIssue({
      code: "custom",
      path: ["review_execution_hash"],
      message: "Pinned review Session hash must match its Clinical policy binding."
    });
  }
  if (value.review_subject_hash !== value.clinical_policy.review_subject_hash) {
    context.addIssue({
      code: "custom",
      path: ["review_subject_hash"],
      message: "Pinned review subject hash must match its Clinical policy binding."
    });
  }
});
export type PinnedReviewSessionCaseContext = z.infer<
  typeof PinnedReviewSessionCaseContextSchema
>;

export const ExecutablePinnedSessionCaseContextSchema = z.union([
  PinnedSessionCaseContextSchema,
  PinnedReviewSessionCaseContextSchema
]);
export type ExecutablePinnedSessionCaseContext = z.infer<
  typeof ExecutablePinnedSessionCaseContextSchema
>;

export type PinnedSessionCaseContextResult =
  | { success: true; issues: []; context: PinnedSessionCaseContext }
  | { success: false; issues: SessionCommandIssue[] };

export type PinnedReviewSessionCaseContextResult =
  | { success: true; issues: []; context: PinnedReviewSessionCaseContext }
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
      execution_authority: "PUBLISHED_PRODUCTION",
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
        ...(action.investigation === undefined
          ? {}
          : { investigation: action.investigation }),
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

/** Derives the review Session view only from one immutable review artifact. */
export function createPinnedReviewSessionCaseContext(
  reviewArtifactInput: unknown
): PinnedReviewSessionCaseContextResult {
  const artifact = ReviewExecutionArtifactSchema.safeParse(reviewArtifactInput);
  if (!artifact.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_SESSION_AGGREGATE",
        "$.review_execution_artifact",
        artifact.error
      )
    };
  }

  try {
    const clinicalPolicy = createPinnedReviewClinicalPolicy(artifact.data);
    const casePackage = artifact.data.source_case;
    const context = PinnedReviewSessionCaseContextSchema.safeParse({
      context_schema_version: PINNED_SESSION_CASE_CONTEXT_SCHEMA_VERSION,
      execution_authority: "REVIEW_ONLY",
      case_package_id: artifact.data.source_identity.case_package_id,
      case_version_id: artifact.data.source_identity.case_version_id,
      case_version: artifact.data.source_identity.case_version,
      review_execution_hash: artifact.data.review_execution_hash,
      review_subject_hash: artifact.data.review_subject_hash,
      clinical_policy: clinicalPolicy,
      action_catalogue: casePackage.action_catalogue.actions.map((action) => ({
        action_id: action.action_id,
        action_type: action.action_type,
        parameter_definitions: action.parameter_definitions,
        prerequisite_action_ids: action.prerequisite_action_ids,
        confirmation_policy: action.confirmation_policy,
        repeat_policy: action.repeat_policy,
        ...(action.investigation === undefined ? {} : { investigation: action.investigation }),
        execution_event_type: executionEventTypeForActionType(action.action_type)
      }))
    });
    return context.success
      ? { success: true, issues: [], context: context.data }
      : {
          success: false,
          issues: sessionCommandIssuesFromZodError(
            "INVALID_SESSION_AGGREGATE",
            "$.pinned_review_case",
            context.error
          )
        };
  } catch (error) {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "INVALID_SESSION_AGGREGATE",
        path: "$.review_execution_artifact",
        message: error instanceof Error
          ? error.message
          : "Review artifact could not produce a pinned review Clinical policy."
      })]
    };
  }
}
