import { z } from "zod";

import {
  DiagnosticAnalyteIdSchema,
  DiagnosticMeasurementIdSchema,
  DiagnosticMilestoneIdSchema,
  DiagnosticResultIdSchema,
  FactIdSchema,
  MediaAssetIdSchema,
  SourceIdSchema
} from "./ids.ts";
import { LocalizationKeySchema } from "./locales.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";

export const DIAGNOSTIC_CONTRACT_SCHEMA_VERSION = "1.0" as const;

export const DiagnosticModalitySchema = z.enum([
  "LABORATORY",
  "ECG",
  "XRAY",
  "CT",
  "MRI",
  "ULTRASOUND",
  "ECHOCARDIOGRAPHY",
  "TEXT_REPORT"
]);
export type DiagnosticModality = z.infer<typeof DiagnosticModalitySchema>;

export const DiagnosticAssetModalitySchema = DiagnosticModalitySchema.exclude([
  "LABORATORY",
  "TEXT_REPORT"
]);
export type DiagnosticAssetModality = z.infer<typeof DiagnosticAssetModalitySchema>;

export const DiagnosticExecutionModeSchema = z.enum([
  "ASYNC_PARALLEL",
  "BLOCKING_PATIENT_UNAVAILABLE"
]);
export type DiagnosticExecutionMode = z.infer<typeof DiagnosticExecutionModeSchema>;

export const DiagnosticMilestoneTypeSchema = z.enum([
  "ORDERED",
  "PERFORMED",
  "RESULT_AVAILABLE",
  "IMAGE_AVAILABLE",
  "FORMAL_REPORT_AVAILABLE"
]);
export type DiagnosticMilestoneType = z.infer<typeof DiagnosticMilestoneTypeSchema>;

export const DiagnosticMilestoneSchema = z.strictObject({
  diagnostic_milestone_id: DiagnosticMilestoneIdSchema,
  milestone_type: DiagnosticMilestoneTypeSchema,
  offset_clinical_seconds: z.number().finite().nonnegative()
});
export type DiagnosticMilestone = z.infer<typeof DiagnosticMilestoneSchema>;

export const DiagnosticLearnerVisibilitySchema = z.enum([
  "AT_COMPONENT_AVAILABILITY",
  "AFTER_SESSION_END",
  "NEVER"
]);
export type DiagnosticLearnerVisibility = z.infer<
  typeof DiagnosticLearnerVisibilitySchema
>;

export const DiagnosticComponentVisibilitySchema = z.strictObject({
  structured_result: DiagnosticLearnerVisibilitySchema,
  media: DiagnosticLearnerVisibilitySchema,
  machine_interpretation: DiagnosticLearnerVisibilitySchema,
  formal_report: DiagnosticLearnerVisibilitySchema
});
export type DiagnosticComponentVisibility = z.infer<
  typeof DiagnosticComponentVisibilitySchema
>;

export const DiagnosticReferenceIntervalSchema = z.strictObject({
  lower_bound: z.number().finite().optional(),
  upper_bound: z.number().finite().optional(),
  lower_inclusive: z.boolean(),
  upper_inclusive: z.boolean()
}).superRefine((value, context) => {
  if (value.lower_bound === undefined && value.upper_bound === undefined) {
    context.addIssue({
      code: "custom",
      path: ["lower_bound"],
      message: "A diagnostic reference interval requires at least one numeric bound."
    });
  }
  if (
    value.lower_bound !== undefined
    && value.upper_bound !== undefined
    && value.upper_bound < value.lower_bound
  ) {
    context.addIssue({
      code: "custom",
      path: ["upper_bound"],
      message: "Reference interval upper bound cannot be less than its lower bound."
    });
  }
});
export type DiagnosticReferenceInterval = z.infer<
  typeof DiagnosticReferenceIntervalSchema
>;

export const DiagnosticAbnormalFlagSchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL_LOW",
  "CRITICAL_HIGH",
  "INDETERMINATE"
]);
export type DiagnosticAbnormalFlag = z.infer<typeof DiagnosticAbnormalFlagSchema>;

export const DiagnosticAnalyteSchema = z.strictObject({
  analyte_id: DiagnosticAnalyteIdSchema,
  analyte_code: CaseControlledValueSchema,
  display_label_key: LocalizationKeySchema,
  value: z.number().finite(),
  unit_code: CaseControlledValueSchema,
  reference_interval: DiagnosticReferenceIntervalSchema.optional(),
  abnormal_flag: DiagnosticAbnormalFlagSchema.optional()
});
export type DiagnosticAnalyte = z.infer<typeof DiagnosticAnalyteSchema>;

export const DiagnosticMeasurementSchema = z.strictObject({
  measurement_id: DiagnosticMeasurementIdSchema,
  measurement_code: CaseControlledValueSchema,
  display_label_key: LocalizationKeySchema,
  value: z.number().finite(),
  unit_code: CaseControlledValueSchema
});
export type DiagnosticMeasurement = z.infer<typeof DiagnosticMeasurementSchema>;

export const DiagnosticAssetRoleSchema = z.enum([
  "TRACING",
  "PRIMARY_IMAGE",
  "SECONDARY_IMAGE",
  "STILL",
  "LOOP"
]);
export type DiagnosticAssetRole = z.infer<typeof DiagnosticAssetRoleSchema>;

export const DiagnosticAssetReferenceSchema = z.strictObject({
  media_asset_id: MediaAssetIdSchema,
  asset_role: DiagnosticAssetRoleSchema
});
export type DiagnosticAssetReference = z.infer<
  typeof DiagnosticAssetReferenceSchema
>;

const resultBaseShape = {
  result_schema_version: z.literal(DIAGNOSTIC_CONTRACT_SCHEMA_VERSION),
  diagnostic_result_id: DiagnosticResultIdSchema,
  source_ids: z.array(SourceIdSchema).max(32)
};

const findingBaseShape = {
  finding_fact_ids: z.array(FactIdSchema).min(1).max(64),
  fallback_fact_ids: z.array(FactIdSchema).max(64),
  asset_references: z.array(DiagnosticAssetReferenceSchema).max(16),
  formal_report_key: LocalizationKeySchema.optional()
};

export const StructuredLabDiagnosticResultSchema = z.strictObject({
  ...resultBaseShape,
  result_type: z.literal("STRUCTURED_LAB"),
  modality: z.literal("LABORATORY"),
  panel_code: CaseControlledValueSchema,
  analytes: z.array(DiagnosticAnalyteSchema).min(1).max(256),
  finding_fact_ids: z.array(FactIdSchema).max(64),
  formal_report_key: LocalizationKeySchema.optional()
});

export const EcgDiagnosticResultSchema = z.strictObject({
  ...resultBaseShape,
  ...findingBaseShape,
  result_type: z.literal("ECG"),
  modality: z.literal("ECG"),
  structured_measurements: z.array(DiagnosticMeasurementSchema).max(64),
  machine_interpretation_key: LocalizationKeySchema.optional()
});

export const ImagingDiagnosticResultSchema = z.strictObject({
  ...resultBaseShape,
  ...findingBaseShape,
  result_type: z.literal("IMAGING"),
  modality: z.enum(["XRAY", "CT", "MRI"]),
  asset_references: z.array(DiagnosticAssetReferenceSchema).min(1).max(16)
});

export const UltrasoundDiagnosticResultSchema = z.strictObject({
  ...resultBaseShape,
  ...findingBaseShape,
  result_type: z.literal("ULTRASOUND"),
  modality: z.enum(["ULTRASOUND", "ECHOCARDIOGRAPHY"]),
  structured_measurements: z.array(DiagnosticMeasurementSchema).max(64)
});

export const TextDiagnosticResultSchema = z.strictObject({
  ...resultBaseShape,
  result_type: z.literal("TEXT_REPORT"),
  modality: z.literal("TEXT_REPORT"),
  finding_fact_ids: z.array(FactIdSchema).min(1).max(64),
  report_content_key: LocalizationKeySchema
});

export const DiagnosticResultSchema = z.discriminatedUnion("result_type", [
  StructuredLabDiagnosticResultSchema,
  EcgDiagnosticResultSchema,
  ImagingDiagnosticResultSchema,
  UltrasoundDiagnosticResultSchema,
  TextDiagnosticResultSchema
]);
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export const InvestigationDefinitionSchema = z.strictObject({
  investigation_schema_version: z.literal(DIAGNOSTIC_CONTRACT_SCHEMA_VERSION),
  execution_mode: DiagnosticExecutionModeSchema,
  result: DiagnosticResultSchema,
  milestones: z.array(DiagnosticMilestoneSchema).min(2).max(8),
  learner_visibility: DiagnosticComponentVisibilitySchema
});
export type InvestigationDefinition = z.infer<typeof InvestigationDefinitionSchema>;
