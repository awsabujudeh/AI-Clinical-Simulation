import { z } from "zod";

const identifierSegment = "[a-z0-9]+(?:-[a-z0-9]+)*";

function prefixedIdentifier(prefix: string) {
  return z
    .string()
    .min(prefix.length + 2)
    .max(160)
    .regex(
      new RegExp(`^${prefix}\\.${identifierSegment}(?:\\.${identifierSegment})*$`),
      `Expected a stable ${prefix}.* identifier`
    );
}

const namespacedIdentifier = z
  .string()
  .min(3)
  .max(160)
  .regex(
    new RegExp(`^${identifierSegment}(?:\\.${identifierSegment})+$`),
    "Expected a lowercase namespaced identifier"
  );

function opaqueOperationalIdentifier(label: string, maxLength = 128) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._~:-]*$/u,
      `Expected a bounded, runtime-safe opaque ${label}`
    );
}

export const CaseIdSchema = prefixedIdentifier("case").brand<"CaseId">();
export type CaseId = z.infer<typeof CaseIdSchema>;

export const CaseVersionIdSchema = prefixedIdentifier("case-version").brand<"CaseVersionId">();
export type CaseVersionId = z.infer<typeof CaseVersionIdSchema>;

export const CasePackageIdSchema = prefixedIdentifier("case-package").brand<"CasePackageId">();
export type CasePackageId = z.infer<typeof CasePackageIdSchema>;

export const SessionIdSchema = opaqueOperationalIdentifier("session identifier").brand<"SessionId">();
export type SessionId = z.infer<typeof SessionIdSchema>;

export const CommandIdSchema = opaqueOperationalIdentifier("command identifier").brand<"CommandId">();
export type CommandId = z.infer<typeof CommandIdSchema>;

// Physical Architecture M.4 fixes persisted event identity to canonical UUIDs.
export const EventIdSchema = z.uuid().brand<"EventId">();
export type EventId = z.infer<typeof EventIdSchema>;

// Action IDs follow the frozen catalogue examples such as medication.aspirin.
export const ActionIdSchema = namespacedIdentifier.brand<"ActionId">();
export type ActionId = z.infer<typeof ActionIdSchema>;

export const ActionDefinitionIdSchema = prefixedIdentifier("action-definition").brand<"ActionDefinitionId">();
export type ActionDefinitionId = z.infer<typeof ActionDefinitionIdSchema>;

export const IntentCandidateIdSchema = opaqueOperationalIdentifier("intent candidate identifier").brand<"IntentCandidateId">();
export type IntentCandidateId = z.infer<typeof IntentCandidateIdSchema>;

export const ActionRequestIdSchema = opaqueOperationalIdentifier("action request identifier").brand<"ActionRequestId">();
export type ActionRequestId = z.infer<typeof ActionRequestIdSchema>;

export const ActionProposalIdSchema = opaqueOperationalIdentifier("action proposal identifier").brand<"ActionProposalId">();
export type ActionProposalId = z.infer<typeof ActionProposalIdSchema>;

export const RuleIdSchema = prefixedIdentifier("rule").brand<"RuleId">();
export type RuleId = z.infer<typeof RuleIdSchema>;

export const RubricIdSchema = prefixedIdentifier("rubric").brand<"RubricId">();
export type RubricId = z.infer<typeof RubricIdSchema>;

export const AssessmentIdSchema = opaqueOperationalIdentifier("assessment identifier").brand<"AssessmentId">();
export type AssessmentId = z.infer<typeof AssessmentIdSchema>;

export const FeedbackFindingIdSchema = opaqueOperationalIdentifier("feedback finding identifier").brand<"FeedbackFindingId">();
export type FeedbackFindingId = z.infer<typeof FeedbackFindingIdSchema>;

// Institution identities are canonical lowercase slugs and remain open to future institutions.
export const InstitutionIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, "Expected a lowercase institution slug")
  .brand<"InstitutionId">();
export type InstitutionId = z.infer<typeof InstitutionIdSchema>;

export const CurriculumObjectiveIdSchema = prefixedIdentifier("objective").brand<"CurriculumObjectiveId">();
export type CurriculumObjectiveId = z.infer<typeof CurriculumObjectiveIdSchema>;

export const SourceIdSchema = prefixedIdentifier("source").brand<"SourceId">();
export type SourceId = z.infer<typeof SourceIdSchema>;

export const SourceVersionIdSchema = prefixedIdentifier("source-version").brand<"SourceVersionId">();
export type SourceVersionId = z.infer<typeof SourceVersionIdSchema>;

// Visual and media prefixes preserve the frozen visual.* and asset.* examples.
export const VisualManifestIdSchema = prefixedIdentifier("visual").brand<"VisualManifestId">();
export type VisualManifestId = z.infer<typeof VisualManifestIdSchema>;

export const MediaAssetIdSchema = prefixedIdentifier("asset").brand<"MediaAssetId">();
export type MediaAssetId = z.infer<typeof MediaAssetIdSchema>;

export const AiWorkflowRunIdSchema = opaqueOperationalIdentifier("AI workflow run identifier").brand<"AiWorkflowRunId">();
export type AiWorkflowRunId = z.infer<typeof AiWorkflowRunIdSchema>;

export const AiWorkflowRequestIdSchema = opaqueOperationalIdentifier("AI workflow request identifier").brand<"AiWorkflowRequestId">();
export type AiWorkflowRequestId = z.infer<typeof AiWorkflowRequestIdSchema>;

export const RequestIdSchema = opaqueOperationalIdentifier("request identifier").brand<"RequestId">();
export type RequestId = z.infer<typeof RequestIdSchema>;

export const CorrelationIdSchema = opaqueOperationalIdentifier("correlation identifier").brand<"CorrelationId">();
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

export const IdempotencyKeySchema = opaqueOperationalIdentifier("idempotency key").brand<"IdempotencyKey">();
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const ActorIdSchema = opaqueOperationalIdentifier("actor identifier").brand<"ActorId">();
export type ActorId = z.infer<typeof ActorIdSchema>;

export const ClinicalEffectIdSchema = prefixedIdentifier("clinical-effect").brand<"ClinicalEffectId">();
export type ClinicalEffectId = z.infer<typeof ClinicalEffectIdSchema>;

export const ScoringEvidenceRefIdSchema = prefixedIdentifier("scoring-evidence").brand<"ScoringEvidenceRefId">();
export type ScoringEvidenceRefId = z.infer<typeof ScoringEvidenceRefIdSchema>;

export const InterventionIdSchema = prefixedIdentifier("intervention").brand<"InterventionId">();
export type InterventionId = z.infer<typeof InterventionIdSchema>;

export const ComplicationIdSchema = prefixedIdentifier("complication").brand<"ComplicationId">();
export type ComplicationId = z.infer<typeof ComplicationIdSchema>;

export const StateVersionSchema = z.number().int().nonnegative().brand<"StateVersion">();
export type StateVersion = z.infer<typeof StateVersionSchema>;

export const SequenceNumberSchema = z.number().int().positive().brand<"SequenceNumber">();
export type SequenceNumber = z.infer<typeof SequenceNumberSchema>;

export const ProposalVersionSchema = z.number().int().positive().brand<"ProposalVersion">();
export type ProposalVersion = z.infer<typeof ProposalVersionSchema>;

export const ClinicalTimeSchema = z.number().finite().nonnegative().brand<"ClinicalTimeSeconds">();
export type ClinicalTime = z.infer<typeof ClinicalTimeSchema>;

export const SchemaVersionSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u, "Expected a major.minor schema version")
  .brand<"SchemaVersion">();
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

export const SemanticVersionSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u,
    "Expected a major.minor.patch semantic version"
  )
  .brand<"SemanticVersion">();
export type SemanticVersion = z.infer<typeof SemanticVersionSchema>;
