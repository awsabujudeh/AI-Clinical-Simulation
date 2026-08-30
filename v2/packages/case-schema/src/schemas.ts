import { z } from "zod";

import {
  ActionIdSchema,
  ActionTypeSchema,
  AuthoredLocaleSchema,
  CaseControlledValueSchema,
  CaseIdSchema,
  CaseLifecycleSchema,
  CasePackageIdSchema,
  CaseReviewTypeSchema,
  CaseVersionIdSchema,
  CurriculumObjectiveIdSchema,
  EventTypeSchema,
  InstitutionIdSchema,
  InstitutionMetadataSchema,
  JsonValueSchema,
  LocalizationKeySchema,
  MediaAssetIdSchema,
  PatientLanguageSchema,
  PatientStateSchema,
  RealUtcTimeSchema,
  RuleIdSchema,
  RubricIdSchema,
  SchemaVersionSchema,
  SemanticVersionSchema,
  SourceIdSchema,
  SourceVersionIdSchema,
  VisualManifestIdSchema
} from "../../contracts/src/index.ts";

export const CASE_SCHEMA_VERSION = "2.0" as const;

export const CASE_MODULE_NAMES = [
  "manifest",
  "classification",
  "localization",
  "patient_profile",
  "presentation",
  "initial_state",
  "clinical_facts",
  "action_catalogue",
  "rules",
  "timeline_policy",
  "assessment_rubric",
  "dialogue_policy",
  "visual_manifest",
  "curriculum_mappings",
  "validation",
  "instructor_notes"
] as const;

export const REVIEW_SUBJECT_MODULE_NAMES = CASE_MODULE_NAMES.filter(
  (moduleName) => moduleName !== "manifest" && moduleName !== "validation"
);

export const CaseModuleNameSchema = z.enum(CASE_MODULE_NAMES);
export type CaseModuleName = z.infer<typeof CaseModuleNameSchema>;

const identifierSegment = "[a-z0-9]+(?:-[a-z0-9]+)*";

function caseScopedIdentifier(prefix: string) {
  return z
    .string()
    .min(prefix.length + 2)
    .max(160)
    .regex(
      new RegExp(`^${prefix}\\.${identifierSegment}(?:\\.${identifierSegment})*$`),
      `Expected a stable ${prefix}.* identifier`
    );
}

export const FactIdSchema = caseScopedIdentifier("fact").brand<"FactId">();
export type FactId = z.infer<typeof FactIdSchema>;

export const DialoguePolicyIdSchema = caseScopedIdentifier("dialogue").brand<"DialoguePolicyId">();
export type DialoguePolicyId = z.infer<typeof DialoguePolicyIdSchema>;

export const TimingWindowIdSchema = caseScopedIdentifier("window").brand<"TimingWindowId">();
export type TimingWindowId = z.infer<typeof TimingWindowIdSchema>;

export const VisualRecipeIdSchema = caseScopedIdentifier("recipe").brand<"VisualRecipeId">();
export type VisualRecipeId = z.infer<typeof VisualRecipeIdSchema>;

export const PreloadGroupIdSchema = caseScopedIdentifier("preload").brand<"PreloadGroupId">();
export type PreloadGroupId = z.infer<typeof PreloadGroupIdSchema>;

export const RubricItemIdSchema = caseScopedIdentifier("rubric-item").brand<"RubricItemId">();
export type RubricItemId = z.infer<typeof RubricItemIdSchema>;

export const CurriculumMappingIdSchema = caseScopedIdentifier("mapping").brand<"CurriculumMappingId">();
export type CurriculumMappingId = z.infer<typeof CurriculumMappingIdSchema>;

export const ReviewIdSchema = caseScopedIdentifier("review").brand<"ReviewId">();
export type ReviewId = z.infer<typeof ReviewIdSchema>;

export const ReviewerReferenceIdSchema = caseScopedIdentifier("reviewer").brand<"ReviewerReferenceId">();
export type ReviewerReferenceId = z.infer<typeof ReviewerReferenceIdSchema>;

export const CaseApprovalIdSchema = caseScopedIdentifier("approval").brand<"CaseApprovalId">();
export type CaseApprovalId = z.infer<typeof CaseApprovalIdSchema>;

export const ApproverReferenceIdSchema = caseScopedIdentifier("approver").brand<"ApproverReferenceId">();
export type ApproverReferenceId = z.infer<typeof ApproverReferenceIdSchema>;

export const PatientProfileIdSchema = caseScopedIdentifier("patient").brand<"PatientProfileId">();
export type PatientProfileId = z.infer<typeof PatientProfileIdSchema>;

export const HashDigestSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u, "Expected a lowercase SHA-256 hex digest")
  .brand<"HashDigest">();
export type HashDigest = z.infer<typeof HashDigestSchema>;

const ExtensionKeySchema = z
  .string()
  .min(3)
  .max(160)
  .regex(
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/u,
    "Expected a namespaced extension key"
  );

export const NamespacedExtensionsSchema = z.record(ExtensionKeySchema, JsonValueSchema);
export type NamespacedExtensions = z.infer<typeof NamespacedExtensionsSchema>;

const moduleBaseShape = {
  module_schema_version: SchemaVersionSchema,
  extensions: NamespacedExtensionsSchema.optional()
};

export const ModuleApprovalStatusSchema = z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED"]);
export type ModuleApprovalStatus = z.infer<typeof ModuleApprovalStatusSchema>;

export const ModuleDeclarationSchema = z.strictObject({
  module_name: CaseModuleNameSchema,
  schema_version: SchemaVersionSchema,
  compatible_package_schema_versions: z.array(SchemaVersionSchema).min(1).max(16),
  required: z.boolean(),
  approval_status: ModuleApprovalStatusSchema
});
export type ModuleDeclaration = z.infer<typeof ModuleDeclarationSchema>;

export const CaseManifestSchema = z.strictObject({
  case_id: CaseIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_package_id: CasePackageIdSchema,
  case_version: SemanticVersionSchema,
  schema_version: SchemaVersionSchema,
  status: CaseLifecycleSchema,
  modules: z.array(ModuleDeclarationSchema).min(1).max(CASE_MODULE_NAMES.length * 2),
  extensions: NamespacedExtensionsSchema.optional()
});
export type CaseManifest = z.infer<typeof CaseManifestSchema>;

export const ClassificationModuleSchema = z.strictObject({
  ...moduleBaseShape,
  setting_code: CaseControlledValueSchema,
  specialty_codes: z.array(CaseControlledValueSchema).min(1).max(16),
  acuity_code: CaseControlledValueSchema,
  difficulty_code: CaseControlledValueSchema,
  target_level_codes: z.array(CaseControlledValueSchema).min(1).max(16),
  estimated_duration_minutes: z.number().int().positive().max(480),
  tag_codes: z.array(CaseControlledValueSchema).max(32)
});
export type ClassificationModule = z.infer<typeof ClassificationModuleSchema>;

export const LocalizedEntrySchema = z.strictObject({
  key: LocalizationKeySchema,
  translations: z.array(z.strictObject({
    locale: AuthoredLocaleSchema,
    text: z.string().trim().min(1).max(4000)
  })).min(1).max(8)
});

export const LocalizationModuleSchema = z.strictObject({
  ...moduleBaseShape,
  fallback_locale: AuthoredLocaleSchema,
  entries: z.array(LocalizedEntrySchema).max(512)
});
export type LocalizationModule = z.infer<typeof LocalizationModuleSchema>;

export const PatientProfileModuleSchema = z.strictObject({
  ...moduleBaseShape,
  patient_id: PatientProfileIdSchema,
  default_language: PatientLanguageSchema,
  supported_languages: z.array(PatientLanguageSchema).min(1).max(2),
  persona_code: CaseControlledValueSchema,
  conversational_style_code: CaseControlledValueSchema,
  disclosure_policy_id: DialoguePolicyIdSchema
});
export type PatientProfileModule = z.infer<typeof PatientProfileModuleSchema>;

export const PresentationModuleSchema = z.strictObject({
  ...moduleBaseShape,
  chief_complaint_fact_id: FactIdSchema,
  arrival_context_code: CaseControlledValueSchema,
  triage_summary_key: LocalizationKeySchema,
  initial_public_fact_ids: z.array(FactIdSchema).max(64)
});
export type PresentationModule = z.infer<typeof PresentationModuleSchema>;

// A Case Package has no Session yet. This derives the authoritative state contract
// while fixing initial counters and omitting only the runtime-created session_id.
export const CaseInitialPatientStateSchema = PatientStateSchema
  .omit({ session_id: true })
  .extend({
    state_version: z.literal(0),
    clinical_time: z.literal(0)
  });
export type CaseInitialPatientState = z.infer<typeof CaseInitialPatientStateSchema>;

export const InitialStateModuleSchema = z.strictObject({
  ...moduleBaseShape,
  patient_state: CaseInitialPatientStateSchema
});
export type InitialStateModule = z.infer<typeof InitialStateModuleSchema>;

export const FactDisclosureModeSchema = z.enum([
  "on_direct_question",
  "after_exam",
  "after_result",
  "never_to_patient"
]);
export type FactDisclosureMode = z.infer<typeof FactDisclosureModeSchema>;

export const ClinicalFactSchema = z.strictObject({
  fact_id: FactIdSchema,
  fact_type: z.enum([
    "HISTORY",
    "SYMPTOM",
    "EXAM_FINDING",
    "INVESTIGATION_RESULT",
    "DIAGNOSIS",
    "DIFFERENTIAL",
    "DISPOSITION"
  ]),
  clinical_code: CaseControlledValueSchema,
  content_key: LocalizationKeySchema,
  disclosure_mode: FactDisclosureModeSchema,
  disclosure_reference_fact_id: FactIdSchema.optional(),
  source_ids: z.array(SourceIdSchema).max(16)
});

export const ClinicalFactsModuleSchema = z.strictObject({
  ...moduleBaseShape,
  facts: z.array(ClinicalFactSchema).max(512)
});
export type ClinicalFactsModule = z.infer<typeof ClinicalFactsModuleSchema>;

export const ActionParameterDefinitionSchema = z.strictObject({
  parameter_code: CaseControlledValueSchema,
  value_type: z.enum(["STRING", "NUMBER", "INTEGER", "BOOLEAN", "CODE"]),
  required: z.boolean(),
  allowed_codes: z.array(CaseControlledValueSchema).max(64).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional()
});

export const ActionAliasSchema = z.strictObject({
  locale: AuthoredLocaleSchema,
  phrases: z.array(z.string().trim().min(1).max(160)).min(1).max(64),
  authority: z.literal("INTERPRETATION_ONLY")
});

export const CaseActionDefinitionSchema = z.strictObject({
  action_id: ActionIdSchema,
  action_type: ActionTypeSchema,
  parameter_definitions: z.array(ActionParameterDefinitionSchema).max(32),
  aliases: z.array(ActionAliasSchema).max(16),
  prerequisite_action_ids: z.array(ActionIdSchema).max(32),
  confirmation_policy: z.enum([
    "NONE",
    "EXPLICIT_REQUEST",
    "EXPLICIT_ADMINISTRATION",
    "CASE_DEFINED"
  ]),
  repeat_policy: z.enum(["NOT_REPEATABLE", "REPEATABLE", "CASE_DEFINED"]),
  source_ids: z.array(SourceIdSchema).max(16)
});

export const ActionCatalogueModuleSchema = z.strictObject({
  ...moduleBaseShape,
  actions: z.array(CaseActionDefinitionSchema).max(256)
});
export type ActionCatalogueModule = z.infer<typeof ActionCatalogueModuleSchema>;

export const DeclarativeEffectDescriptorSchema = z.strictObject({
  effect_code: CaseControlledValueSchema,
  target_code: CaseControlledValueSchema.optional()
});

export const CaseRuleSchema = z.strictObject({
  rule_id: RuleIdSchema,
  trigger: z.strictObject({
    event_type: EventTypeSchema,
    action_id: ActionIdSchema.optional()
  }),
  referenced_action_ids: z.array(ActionIdSchema).max(32),
  referenced_rule_ids: z.array(RuleIdSchema).max(32),
  referenced_fact_ids: z.array(FactIdSchema).max(32),
  source_ids: z.array(SourceIdSchema).min(1).max(32),
  timing_window_ids: z.array(TimingWindowIdSchema).max(16),
  effect_descriptors: z.array(DeclarativeEffectDescriptorSchema).max(32)
});

export const RulesModuleSchema = z.strictObject({
  ...moduleBaseShape,
  rules: z.array(CaseRuleSchema).max(512)
});
export type RulesModule = z.infer<typeof RulesModuleSchema>;

export const TimingWindowSchema = z.strictObject({
  timing_window_id: TimingWindowIdSchema,
  starts_at_clinical_seconds: z.number().finite().nonnegative(),
  ends_at_clinical_seconds: z.number().finite().nonnegative(),
  reference_event_type: EventTypeSchema.optional(),
  reference_action_id: ActionIdSchema.optional()
});

export const TimelinePolicyModuleSchema = z.strictObject({
  ...moduleBaseShape,
  time_ratio: z.number().finite().positive().max(100),
  pause_policy: z.enum(["PAUSE_CLINICAL_TIME", "CASE_DEFINED"]),
  deterministic_seed_policy: z.enum(["REQUIRED", "FIXED"]),
  timing_windows: z.array(TimingWindowSchema).max(128),
  initial_scheduled_event_types: z.array(EventTypeSchema).max(64)
});
export type TimelinePolicyModule = z.infer<typeof TimelinePolicyModuleSchema>;

export const RubricEvidenceSchema = z.strictObject({
  action_ids: z.array(ActionIdSchema).max(32),
  event_types: z.array(EventTypeSchema).max(32),
  timing_window_id: TimingWindowIdSchema.optional()
});

export const RubricDomainSchema = z.strictObject({
  domain_code: CaseControlledValueSchema,
  title_key: LocalizationKeySchema,
  evidence: z.array(RubricEvidenceSchema).max(64)
});

export const CriticalRubricItemSchema = z.strictObject({
  rubric_item_id: RubricItemIdSchema,
  kind: z.enum(["CRITICAL_ACTION", "CRITICAL_ERROR"]),
  evidence: RubricEvidenceSchema,
  cap_value: z.number().finite().optional(),
  penalty_value: z.number().finite().optional()
});

export const AssessmentRubricModuleSchema = z.strictObject({
  ...moduleBaseShape,
  rubric_id: RubricIdSchema,
  domains: z.array(RubricDomainSchema).length(6),
  critical_items: z.array(CriticalRubricItemSchema).max(128),
  source_ids: z.array(SourceIdSchema).min(1).max(32)
});
export type AssessmentRubricModule = z.infer<typeof AssessmentRubricModuleSchema>;

export const DialoguePolicyModuleSchema = z.strictObject({
  ...moduleBaseShape,
  dialogue_policy_id: DialoguePolicyIdSchema,
  disclosable_fact_ids: z.array(FactIdSchema).max(256),
  forbidden_fact_ids: z.array(FactIdSchema).max(256),
  question_concept_codes: z.array(CaseControlledValueSchema).max(128),
  emotional_tone_code: CaseControlledValueSchema,
  deterministic_fallback_key: LocalizationKeySchema
});
export type DialoguePolicyModule = z.infer<typeof DialoguePolicyModuleSchema>;

export const MediaAssetDefinitionSchema = z.strictObject({
  media_asset_id: MediaAssetIdSchema,
  media_kind: z.enum(["STATIC_IMAGE", "VIDEO", "AUDIO", "OVERLAY"]),
  required: z.boolean(),
  static_fallback: z.boolean()
});

export const VisualRecipeSchema = z.strictObject({
  recipe_id: VisualRecipeIdSchema,
  media_asset_ids: z.array(MediaAssetIdSchema).max(64),
  fallback_asset_id: MediaAssetIdSchema.optional()
});

export const PreloadGroupSchema = z.strictObject({
  preload_group_id: PreloadGroupIdSchema,
  media_asset_ids: z.array(MediaAssetIdSchema).max(128)
});

export const VisualManifestModuleSchema = z.strictObject({
  ...moduleBaseShape,
  visual_manifest_id: VisualManifestIdSchema,
  visual_manifest_version: SemanticVersionSchema,
  media_assets: z.array(MediaAssetDefinitionSchema).max(512),
  recipes: z.array(VisualRecipeSchema).max(256),
  required_static_fallback_asset_id: MediaAssetIdSchema.optional(),
  preload_groups: z.array(PreloadGroupSchema).max(64)
});
export type VisualManifestModule = z.infer<typeof VisualManifestModuleSchema>;

export const CurriculumObjectiveSchema = z.strictObject({
  objective_id: CurriculumObjectiveIdSchema,
  institution: InstitutionMetadataSchema,
  objective_code: CaseControlledValueSchema,
  source_id: SourceIdSchema,
  status: z.enum(["APPROVED", "UNKNOWN", "PLACEHOLDER"])
});

export const CurriculumMappingSchema = z.strictObject({
  mapping_id: CurriculumMappingIdSchema,
  competency_code: CaseControlledValueSchema,
  institution_id: InstitutionIdSchema,
  objective_id: CurriculumObjectiveIdSchema,
  status: z.enum(["APPROVED", "UNKNOWN", "PLACEHOLDER"])
});

export const CurriculumMappingsModuleSchema = z.strictObject({
  ...moduleBaseShape,
  objectives: z.array(CurriculumObjectiveSchema).max(256),
  mappings: z.array(CurriculumMappingSchema).max(512),
  official_alignment_claimed: z.literal(false)
});
export type CurriculumMappingsModule = z.infer<typeof CurriculumMappingsModuleSchema>;

export const SourceStatusSchema = z.enum(["APPROVED", "UNRESOLVED", "PLACEHOLDER"]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const RULE_REACHABILITY_VALIDATION_CODE = "validation.rule-reachability" as const;

export const CaseSourceReferenceSchema = z.strictObject({
  source_id: SourceIdSchema,
  source_version_id: SourceVersionIdSchema,
  status: SourceStatusSchema,
  required: z.boolean()
});

export const ReviewerReferenceSchema = z.strictObject({
  reviewer_ref_id: ReviewerReferenceIdSchema,
  reviewer_role_code: CaseControlledValueSchema,
  status: z.enum(["CONFIRMED", "UNCONFIRMED"])
});

export const ReviewRecordSchema = z.strictObject({
  review_id: ReviewIdSchema,
  review_type: CaseReviewTypeSchema,
  reviewer_ref_id: ReviewerReferenceIdSchema,
  status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
  reviewed_case_version: SemanticVersionSchema,
  reviewed_content_hash: HashDigestSchema.optional(),
  reviewed_at_utc: RealUtcTimeSchema
});

export const ValidationEvidenceStatusSchema = z.enum([
  "PASSED",
  "DEFERRED",
  "UNRESOLVED",
  "FAILED"
]);
export type ValidationEvidenceStatus = z.infer<typeof ValidationEvidenceStatusSchema>;

export const ValidationEvidenceSchema = z.strictObject({
  validation_code: CaseControlledValueSchema,
  status: ValidationEvidenceStatusSchema,
  required_for_publication: z.boolean(),
  validator_id: CaseControlledValueSchema.optional(),
  validator_version: SemanticVersionSchema.optional(),
  evidence_hash: HashDigestSchema.optional(),
  validated_case_version_id: CaseVersionIdSchema.optional(),
  validated_case_version: SemanticVersionSchema.optional(),
  validated_review_subject_hash: HashDigestSchema.optional(),
  completed_at_utc: RealUtcTimeSchema.optional()
});
export type ValidationEvidence = z.infer<typeof ValidationEvidenceSchema>;

// Backward-compatible export name for the generic deferred-check boundary.
export const DeferredValidationCheckSchema = ValidationEvidenceSchema;

export const ValidationModuleSchema = z.strictObject({
  ...moduleBaseShape,
  required_source_ids: z.array(SourceIdSchema).max(128),
  sources: z.array(CaseSourceReferenceSchema).max(256),
  reviewers: z.array(ReviewerReferenceSchema).max(64),
  reviews: z.array(ReviewRecordSchema).max(128),
  deferred_checks: z.array(DeferredValidationCheckSchema).max(128),
  review_status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED"]),
  approval_status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED"])
});
export type ValidationModule = z.infer<typeof ValidationModuleSchema>;

export const InstructorNotesModuleSchema = z.strictObject({
  ...moduleBaseShape,
  facilitation_note_keys: z.array(LocalizationKeySchema).max(128),
  teaching_point_codes: z.array(CaseControlledValueSchema).max(128),
  patient_ai_access: z.literal("FORBIDDEN")
});
export type InstructorNotesModule = z.infer<typeof InstructorNotesModuleSchema>;

export const DraftCasePackageSchema = z.strictObject({
  manifest: CaseManifestSchema,
  classification: ClassificationModuleSchema,
  localization: LocalizationModuleSchema,
  patient_profile: PatientProfileModuleSchema,
  presentation: PresentationModuleSchema,
  initial_state: InitialStateModuleSchema,
  clinical_facts: ClinicalFactsModuleSchema,
  action_catalogue: ActionCatalogueModuleSchema,
  rules: RulesModuleSchema,
  timeline_policy: TimelinePolicyModuleSchema,
  assessment_rubric: AssessmentRubricModuleSchema,
  dialogue_policy: DialoguePolicyModuleSchema,
  visual_manifest: VisualManifestModuleSchema,
  curriculum_mappings: CurriculumMappingsModuleSchema,
  validation: ValidationModuleSchema,
  instructor_notes: InstructorNotesModuleSchema
});
export type DraftCasePackage = z.infer<typeof DraftCasePackageSchema>;

export const CompiledCaseManifestSchema = CaseManifestSchema.extend({
  status: z.literal("PUBLISHED"),
  hash_algorithm: z.literal("SHA-256"),
  module_hashes: z.record(CaseModuleNameSchema, HashDigestSchema)
});
export type CompiledCaseManifest = z.infer<typeof CompiledCaseManifestSchema>;

export const CompiledCasePackageSchema = z.strictObject({
  ...DraftCasePackageSchema.shape,
  manifest: CompiledCaseManifestSchema,
  package_hash: HashDigestSchema
});
export type CompiledCasePackage = z.infer<typeof CompiledCasePackageSchema>;

export const PublicationCandidateSchema = z.strictObject({
  candidate_package_hash: HashDigestSchema,
  package: CompiledCasePackageSchema
}).superRefine((candidate, context) => {
  if (candidate.candidate_package_hash !== candidate.package.package_hash) {
    context.addIssue({
      code: "custom",
      path: ["candidate_package_hash"],
      message: "Candidate hash must equal the compiled package hash."
    });
  }
});
export type PublicationCandidate = z.infer<typeof PublicationCandidateSchema>;

// Exact-package approval is external governance evidence. It is intentionally
// not part of DraftCasePackageSchema or CompiledCasePackageSchema, so the hash
// it approves can never be included in the bytes that produce that same hash.
export const PublicationApprovalRecordSchema = z.strictObject({
  approval_schema_version: z.literal("1.0"),
  approval_id: CaseApprovalIdSchema,
  approval_scope: z.literal("CASE_PACKAGE_PUBLICATION"),
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  approved_package_hash: HashDigestSchema,
  required_review_ids: z.array(ReviewIdSchema).min(2).max(128),
  status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
  approver_ref_id: ApproverReferenceIdSchema,
  approver_role_code: CaseControlledValueSchema,
  approved_at_utc: RealUtcTimeSchema
});
export type PublicationApprovalRecord = z.infer<typeof PublicationApprovalRecordSchema>;
