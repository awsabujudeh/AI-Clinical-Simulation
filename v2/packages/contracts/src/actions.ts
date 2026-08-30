import { z } from "zod";

import {
  ActionDefinitionIdSchema,
  ActionIdSchema,
  ActionProposalIdSchema,
  ActionRequestIdSchema,
  CaseVersionIdSchema,
  ClinicalTimeSchema,
  CommandIdSchema,
  IdempotencyKeySchema,
  IntentCandidateIdSchema,
  ProposalVersionSchema,
  SchemaVersionSchema,
  SessionIdSchema,
  StateVersionSchema
} from "./ids.ts";
import { JsonObjectSchema } from "./json.ts";
import { LocalizationKeySchema } from "./locales.ts";

export const ActionTypeSchema = z.enum([
  "EXAMINATION",
  "INVESTIGATION",
  "MEDICATION",
  "PROCEDURE",
  "CONSULT",
  "DIAGNOSIS",
  "DISPOSITION"
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionRequestSourceSchema = z.enum(["UI", "NATURAL_LANGUAGE"]);
export type ActionRequestSource = z.infer<typeof ActionRequestSourceSchema>;

export const ActionReferenceResolutionSchema = z.discriminatedUnion("resolution", [
  z.strictObject({
    resolution: z.literal("MATCHED"),
    authority: z.literal("INTERPRETATION_ONLY"),
    action_id: ActionIdSchema
  }),
  z.strictObject({
    resolution: z.literal("UNKNOWN"),
    authority: z.literal("INTERPRETATION_ONLY"),
    raw_action_id: z.string().trim().min(1).max(160),
    issue_code: z.literal("UNKNOWN_ACTION_ID")
  })
]);
export type ActionReferenceResolution = z.infer<typeof ActionReferenceResolutionSchema>;

export const IntentCandidateSchema = z.strictObject({
  intent_candidate_id: IntentCandidateIdSchema,
  authority: z.literal("NON_AUTHORITATIVE"),
  action_reference: ActionReferenceResolutionSchema,
  parameters: JsonObjectSchema,
  confidence: z.number().finite().min(0).max(1),
  is_ambiguous: z.boolean(),
  missing_fields: z.array(z.string().min(1).max(80)).max(32),
  requires_confirmation: z.boolean()
});
export type IntentCandidate = z.infer<typeof IntentCandidateSchema>;

export const ApprovedActionDefinitionIdentitySchema = z.strictObject({
  action_definition_id: ActionDefinitionIdSchema,
  action_id: ActionIdSchema,
  case_version_id: CaseVersionIdSchema,
  action_type: ActionTypeSchema,
  approval_status: z.literal("APPROVED")
});
export type ApprovedActionDefinitionIdentity = z.infer<typeof ApprovedActionDefinitionIdentitySchema>;

export const ActionRequestSchema = z.strictObject({
  action_request_id: ActionRequestIdSchema,
  catalogue_membership: z.literal("UNVERIFIED"),
  command_id: CommandIdSchema,
  session_id: SessionIdSchema,
  action_id: ActionIdSchema,
  request_schema_version: SchemaVersionSchema,
  expected_state_version: StateVersionSchema,
  requested_at_clinical_time: ClinicalTimeSchema,
  parameters: JsonObjectSchema,
  source: ActionRequestSourceSchema,
  idempotency_key: IdempotencyKeySchema
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const ValidationOutcomeStatusSchema = z.enum([
  "VALID",
  "INVALID",
  "NEEDS_CLARIFICATION"
]);
export type ValidationOutcomeStatus = z.infer<typeof ValidationOutcomeStatusSchema>;

export const ValidationIssueSchema = z.strictObject({
  code: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u),
  message_key: LocalizationKeySchema,
  field: z.string().min(1).max(120).optional()
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationOutcomeSchema = z.strictObject({
  status: ValidationOutcomeStatusSchema,
  issues: z.array(ValidationIssueSchema),
  confirmation_required: z.boolean()
});
export type ValidationOutcome = z.infer<typeof ValidationOutcomeSchema>;

export const ConfirmationStateSchema = z.enum([
  "NOT_REQUIRED",
  "PENDING",
  "CONFIRMED",
  "CANCELLED"
]);
export type ConfirmationState = z.infer<typeof ConfirmationStateSchema>;

export const ActionExecutionStatusSchema = z.enum([
  "PROPOSED",
  "REJECTED",
  "NEEDS_CLARIFICATION",
  "PENDING_CONFIRMATION",
  "EXECUTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
]);
export type ActionExecutionStatus = z.infer<typeof ActionExecutionStatusSchema>;

export const ActionProposalSchema = z.strictObject({
  action_proposal_id: ActionProposalIdSchema,
  proposal_version: ProposalVersionSchema,
  action_request_id: ActionRequestIdSchema,
  session_id: SessionIdSchema,
  action_id: ActionIdSchema,
  parameters: JsonObjectSchema,
  validation: ValidationOutcomeSchema,
  confirmation_state: ConfirmationStateSchema,
  execution_status: ActionExecutionStatusSchema,
  proposed_at_clinical_time: ClinicalTimeSchema
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;
