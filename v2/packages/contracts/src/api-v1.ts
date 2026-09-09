import { z } from "zod";

import { ActionTypeSchema } from "./actions.ts";

import {
  ActionIdSchema,
  ActionRequestIdSchema,
  AssessmentDomainIdSchema,
  AssessmentIdSchema,
  CaseIdSchema,
  CasePackageIdSchema,
  CaseVersionIdSchema,
  ClinicalTimeSchema,
  CommandIdSchema,
  CorrelationIdSchema,
  DiagnosticAnalyteIdSchema,
  DiagnosticMeasurementIdSchema,
  DiagnosticResultIdSchema,
  EventIdSchema,
  FeedbackFindingIdSchema,
  IdempotencyKeySchema,
  RequestIdSchema,
  SequenceNumberSchema,
  SessionIdSchema,
  StateVersionSchema
} from "./ids.ts";
import { JsonObjectSchema } from "./json.ts";
import { SessionLifecycleStatusSchema, SessionModeSchema } from "./lifecycle.ts";
import { PatientLanguageSchema } from "./locales.ts";
import { ObservationProjectionSchema } from "./observations.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";
import {
  DiagnosticAbnormalFlagSchema,
  DiagnosticAssetReferenceSchema,
  DiagnosticReferenceIntervalSchema
} from "./diagnostics.ts";

export const API_V1_SCHEMA_VERSION = "1.0" as const;

export const ApiV1RequestHeadersSchema = z.strictObject({
  api_schema_version: z.literal(API_V1_SCHEMA_VERSION),
  request_id: RequestIdSchema,
  correlation_id: CorrelationIdSchema,
  idempotency_key: IdempotencyKeySchema.optional()
});
export type ApiV1RequestHeaders = z.infer<typeof ApiV1RequestHeadersSchema>;

export const ClientCapabilitiesSchema = z.strictObject({
  supports_static_visual_fallback: z.boolean(),
  supports_audio: z.boolean()
});

export const StartSessionRequestSchema = z.strictObject({
  case_id: CaseIdSchema,
  patient_language: PatientLanguageSchema,
  mode: SessionModeSchema,
  client_capabilities: ClientCapabilitiesSchema
});
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export const SubmitClinicalActionRequestSchema = z.strictObject({
  command_id: CommandIdSchema,
  action_request_id: ActionRequestIdSchema,
  action_id: ActionIdSchema,
  expected_state_version: StateVersionSchema,
  parameters: JsonObjectSchema,
  source: z.enum(["UI", "NATURAL_LANGUAGE"])
});
export type SubmitClinicalActionRequest = z.infer<
  typeof SubmitClinicalActionRequestSchema
>;

export const EndSimulationRequestSchema = z.strictObject({
  expected_state_version: StateVersionSchema,
  reason: z.enum(["LEARNER_COMPLETED", "FACULTY_ENDED", "TIME_EXPIRED"])
});
export type EndSimulationRequest = z.infer<typeof EndSimulationRequestSchema>;

export const SubmitQuestionRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(4_000),
  locale: PatientLanguageSchema,
  source: z.enum(["TEXT", "STT"]),
  utterance_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
});
export type SubmitQuestionRequest = z.infer<typeof SubmitQuestionRequestSchema>;

export const SafePinnedCaseIdentitySchema = z.strictObject({
  execution_authority: z.enum(["PUBLISHED_PRODUCTION", "REVIEW_ONLY"]),
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u)
});

export const LEARNER_ACTION_CATALOGUE_SCHEMA_VERSION = "1.0" as const;

export const LearnerLocalizedTextSchema = z.strictObject({
  locale: PatientLanguageSchema,
  text: z.string().trim().min(1).max(240)
});
export type LearnerLocalizedText = z.infer<typeof LearnerLocalizedTextSchema>;

export const LearnerActionLocalizedLabelSchema = z.strictObject({
  locale: PatientLanguageSchema,
  label: z.string().trim().min(1).max(160)
});

export const LearnerActionAliasSchema = z.strictObject({
  locale: PatientLanguageSchema,
  phrases: z.array(z.string().trim().min(1).max(160)).min(1).max(64)
});

export const LearnerActionParameterDefinitionSchema = z.strictObject({
  parameter_code: CaseControlledValueSchema,
  value_type: z.enum(["STRING", "NUMBER", "INTEGER", "BOOLEAN", "CODE"]),
  required: z.boolean(),
  allowed_codes: z.array(CaseControlledValueSchema).max(64).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional()
}).superRefine((value, context) => {
  if (value.minimum !== undefined && value.maximum !== undefined
    && value.minimum > value.maximum) {
    context.addIssue({
      code: "custom",
      path: ["minimum"],
      message: "Minimum learner action parameter value cannot exceed maximum."
    });
  }
  if (value.allowed_codes !== undefined && value.value_type !== "CODE") {
    context.addIssue({
      code: "custom",
      path: ["allowed_codes"],
      message: "Allowed codes apply only to CODE learner action parameters."
    });
  }
});

export const SafeLearnerActionSchema = z.strictObject({
  action_id: ActionIdSchema,
  action_type: ActionTypeSchema,
  labels: z.array(LearnerActionLocalizedLabelSchema).max(2),
  aliases: z.array(LearnerActionAliasSchema).max(16).optional(),
  parameter_definitions: z.array(LearnerActionParameterDefinitionSchema).max(32),
  confirmation_policy: z.enum([
    "NONE",
    "EXPLICIT_REQUEST",
    "EXPLICIT_ADMINISTRATION",
    "CASE_DEFINED"
  ]),
  repeat_policy: z.enum(["NOT_REPEATABLE", "REPEATABLE", "CASE_DEFINED"])
}).superRefine((value, context) => {
  const locales = new Set<string>();
  for (const [index, label] of value.labels.entries()) {
    if (locales.has(label.locale)) {
      context.addIssue({
        code: "custom",
        path: ["labels", index, "locale"],
        message: "Learner action labels must have unique locales."
      });
    }
    locales.add(label.locale);
  }
  const parameterCodes = new Set<string>();
  for (const [index, parameter] of value.parameter_definitions.entries()) {
    if (parameterCodes.has(parameter.parameter_code)) {
      context.addIssue({
        code: "custom",
        path: ["parameter_definitions", index, "parameter_code"],
        message: "Learner action parameter codes must be unique."
      });
    }
    parameterCodes.add(parameter.parameter_code);
  }
  const aliasLocales = new Set<string>();
  for (const [index, alias] of (value.aliases ?? []).entries()) {
    if (aliasLocales.has(alias.locale)) {
      context.addIssue({
        code: "custom",
        path: ["aliases", index, "locale"],
        message: "Learner action alias groups must have unique locales."
      });
    }
    aliasLocales.add(alias.locale);
  }
});
export type SafeLearnerAction = z.infer<typeof SafeLearnerActionSchema>;

export const SafeLearnerActionCatalogueSchema = z.strictObject({
  catalogue_schema_version: z.literal(LEARNER_ACTION_CATALOGUE_SCHEMA_VERSION),
  actions: z.array(SafeLearnerActionSchema).max(256)
}).superRefine((value, context) => {
  const actionIds = new Set<string>();
  for (const [index, action] of value.actions.entries()) {
    if (actionIds.has(action.action_id)) {
      context.addIssue({
        code: "custom",
        path: ["actions", index, "action_id"],
        message: "Learner-visible action identities must be unique."
      });
    }
    actionIds.add(action.action_id);
  }
});
export type SafeLearnerActionCatalogue = z.infer<
  typeof SafeLearnerActionCatalogueSchema
>;

export const SafeActiveAssessmentDisclosureSchema = z.discriminatedUnion(
  "projection_type",
  [
    z.strictObject({
      projection_schema_version: z.literal("1.0"),
      projection_type: z.literal("ACTIVE_ASSESSMENT_WITHHELD"),
      assessment_id: AssessmentIdSchema,
      session_id: SessionIdSchema,
      session_mode: z.literal("ASSESSMENT"),
      assessment_status: z.literal("ACTIVE")
    }),
    z.strictObject({
      projection_schema_version: z.literal("1.0"),
      projection_type: z.literal("ACTIVE_PRACTICE_FEEDBACK"),
      assessment_id: AssessmentIdSchema,
      session_id: SessionIdSchema,
      session_mode: z.literal("PRACTICE_DEMO"),
      assessment_status: z.literal("ACTIVE"),
      resolved_findings: z.array(z.strictObject({
        finding_id: z.string().min(1).max(128),
        category: z.enum([
          "CORRECT_ACTION",
          "UNSAFE_ACTION",
          "IMPORTANT_DELAY",
          "MISSED_OPPORTUNITY"
        ]),
        resolution: z.literal("RESOLVED"),
        evidence: z.array(z.strictObject({
          event_id: EventIdSchema,
          sequence_no: SequenceNumberSchema,
          clinical_time: ClinicalTimeSchema,
          action_id: ActionIdSchema.optional()
        })).max(32)
      })).max(1024)
    })
  ]
);

export const SafeSessionProjectionSchema = z.strictObject({
  session_id: SessionIdSchema,
  status: SessionLifecycleStatusSchema,
  mode: SessionModeSchema,
  pinned_case: SafePinnedCaseIdentitySchema,
  state_version: StateVersionSchema,
  clinical_time: ClinicalTimeSchema,
  event_sequence_through: z.number().int().nonnegative(),
  clock_status: z.enum(["RUNNING", "PAUSED"]),
  observations: ObservationProjectionSchema,
  learner_action_catalogue: SafeLearnerActionCatalogueSchema,
  assessment_disclosure: SafeActiveAssessmentDisclosureSchema.optional()
});
export type SafeSessionProjection = z.infer<typeof SafeSessionProjectionSchema>;

export const LEARNER_TIMELINE_SCHEMA_VERSION = "1.0" as const;

export const LearnerTimelineItemTypeSchema = z.enum([
  "SESSION_STARTED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "ACTION_COMMITTED",
  "INVESTIGATION_RESULT_AVAILABLE",
  "SESSION_ENDED"
]);
export type LearnerTimelineItemType = z.infer<typeof LearnerTimelineItemTypeSchema>;

export const SafeLearnerTimelineItemSchema = z.strictObject({
  event_id: EventIdSchema,
  sequence_no: SequenceNumberSchema,
  clinical_time: ClinicalTimeSchema,
  item_type: LearnerTimelineItemTypeSchema,
  labels: z.array(LearnerLocalizedTextSchema).min(1).max(2),
  action_id: ActionIdSchema.optional()
}).superRefine((value, context) => {
  const locales = new Set<string>();
  for (const [index, label] of value.labels.entries()) {
    if (locales.has(label.locale)) {
      context.addIssue({
        code: "custom",
        path: ["labels", index, "locale"],
        message: "Learner timeline labels must have unique locales."
      });
    }
    locales.add(label.locale);
  }
});
export type SafeLearnerTimelineItem = z.infer<typeof SafeLearnerTimelineItemSchema>;

export const SafeLearnerTimelineProjectionSchema = z.strictObject({
  timeline_schema_version: z.literal(LEARNER_TIMELINE_SCHEMA_VERSION),
  session_id: SessionIdSchema,
  event_sequence_through: z.number().int().nonnegative(),
  items: z.array(SafeLearnerTimelineItemSchema).max(256),
  truncated_before_sequence: SequenceNumberSchema.optional()
}).superRefine((value, context) => {
  let priorSequence = 0;
  const eventIds = new Set<string>();
  for (const [index, item] of value.items.entries()) {
    if (item.sequence_no <= priorSequence || item.sequence_no > value.event_sequence_through) {
      context.addIssue({
        code: "custom",
        path: ["items", index, "sequence_no"],
        message: "Learner timeline items must preserve increasing committed sequence order."
      });
    }
    if (eventIds.has(item.event_id)) {
      context.addIssue({
        code: "custom",
        path: ["items", index, "event_id"],
        message: "Learner timeline Event references must be unique."
      });
    }
    priorSequence = item.sequence_no;
    eventIds.add(item.event_id);
  }
});
export type SafeLearnerTimelineProjection = z.infer<
  typeof SafeLearnerTimelineProjectionSchema
>;

export const VisualPreloadStatusSchema = z.strictObject({
  status: z.literal("DELIVERY_PENDING"),
  static_fallback_required: z.literal(true)
});

export const StartSessionResponseDataSchema = z.strictObject({
  session: SafeSessionProjectionSchema,
  patient_language: PatientLanguageSchema,
  visual_preload: VisualPreloadStatusSchema,
  replayed: z.boolean()
});

export const SubmitClinicalActionResponseDataSchema = z.strictObject({
  execution_status: z.literal("EXECUTED"),
  replayed: z.boolean(),
  committed_event_ids: z.array(EventIdSchema).min(1).max(512),
  session: SafeSessionProjectionSchema
});

const LearnerDiagnosticAnalyteSchema = z.strictObject({
  analyte_id: DiagnosticAnalyteIdSchema,
  analyte_code: CaseControlledValueSchema,
  display_label_key: z.string().min(3).max(160),
  value: z.number().finite(),
  unit_code: CaseControlledValueSchema,
  reference_interval: DiagnosticReferenceIntervalSchema.optional(),
  abnormal_flag: DiagnosticAbnormalFlagSchema.optional()
});

const LearnerDiagnosticMeasurementSchema = z.strictObject({
  measurement_id: DiagnosticMeasurementIdSchema,
  measurement_code: CaseControlledValueSchema,
  display_label_key: z.string().min(3).max(160),
  value: z.number().finite(),
  unit_code: CaseControlledValueSchema
});

export const LearnerDiagnosticStructuredResultSchema = z.discriminatedUnion(
  "result_type",
  [
    z.strictObject({
      result_type: z.literal("STRUCTURED_LAB"),
      modality: z.literal("LABORATORY"),
      panel_code: CaseControlledValueSchema,
      analytes: z.array(LearnerDiagnosticAnalyteSchema).min(1).max(256)
    }),
    z.strictObject({
      result_type: z.literal("ECG"),
      modality: z.literal("ECG"),
      structured_measurements: z.array(LearnerDiagnosticMeasurementSchema).max(64)
    }),
    z.strictObject({
      result_type: z.literal("IMAGING"),
      modality: z.enum(["XRAY", "CT", "MRI"])
    }),
    z.strictObject({
      result_type: z.literal("ULTRASOUND"),
      modality: z.enum(["ULTRASOUND", "ECHOCARDIOGRAPHY"]),
      structured_measurements: z.array(LearnerDiagnosticMeasurementSchema).max(64)
    }),
    z.strictObject({
      result_type: z.literal("TEXT_REPORT"),
      modality: z.literal("TEXT_REPORT"),
      report_content_key: z.string().min(3).max(160)
    })
  ]
);

export const InvestigationComponentStateSchema = z.enum([
  "PENDING",
  "AVAILABLE",
  "WITHHELD"
]);

export const SafeInvestigationProjectionSchema = z.strictObject({
  diagnostic_result_id: DiagnosticResultIdSchema,
  clinical_time: ClinicalTimeSchema,
  component_status: z.strictObject({
    structured_result: InvestigationComponentStateSchema,
    media: InvestigationComponentStateSchema,
    machine_interpretation: InvestigationComponentStateSchema,
    formal_report: InvestigationComponentStateSchema
  }),
  structured_result: LearnerDiagnosticStructuredResultSchema.optional(),
  media_assets: z.array(DiagnosticAssetReferenceSchema).max(16).optional(),
  machine_interpretation_key: z.string().min(3).max(160).optional(),
  formal_report_key: z.string().min(3).max(160).optional()
});

export const SafeFinalAssessmentProjectionSchema = z.strictObject({
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  assessment_status: z.literal("FINAL"),
  overall_score_basis_points: z.number().int().min(0).max(10_000),
  maximum_score_basis_points: z.literal(10_000),
  unsafe: z.boolean(),
  assessed_through_clinical_time: ClinicalTimeSchema,
  event_sequence_through: z.number().int().nonnegative(),
  domain_scores: z.array(z.strictObject({
    domain_id: AssessmentDomainIdSchema,
    labels: z.array(LearnerLocalizedTextSchema).min(1).max(2),
    score_basis_points: z.number().int().min(0).max(10_000),
    weight_basis_points: z.number().int().min(1).max(10_000),
    weighted_contribution_basis_points: z.number().int().min(0).max(10_000)
  })).length(6),
  findings: z.array(z.strictObject({
    finding_id: FeedbackFindingIdSchema,
    category: z.enum([
      "CORRECT_ACTION",
      "UNSAFE_ACTION",
      "IMPORTANT_DELAY",
      "MISSED_OPPORTUNITY"
    ]),
    resolution: z.literal("RESOLVED"),
    evidence: z.array(z.strictObject({
      event_id: EventIdSchema,
      sequence_no: SequenceNumberSchema,
      clinical_time: ClinicalTimeSchema,
      action_id: ActionIdSchema.optional()
    })).max(32)
  })).max(1024)
});
export type SafeFinalAssessmentProjection = z.infer<
  typeof SafeFinalAssessmentProjectionSchema
>;

export const SafeAssessmentApiProjectionSchema = z.union([
  SafeActiveAssessmentDisclosureSchema,
  SafeFinalAssessmentProjectionSchema
]);
export type SafeAssessmentApiProjection = z.infer<
  typeof SafeAssessmentApiProjectionSchema
>;

export const EndSimulationResponseDataSchema = z.strictObject({
  replayed: z.boolean(),
  session: SafeSessionProjectionSchema,
  assessment: SafeFinalAssessmentProjectionSchema
});

export const FutureCapabilityResponseDataSchema = z.strictObject({
  capability: z.enum([
    "PATIENT_AI",
    "VISUAL_ENGINE",
    "CURRICULUM_RAG",
    "CASE_BUILDER"
  ]),
  status: z.literal("DELIVERY_PENDING")
});

export function createApiV1SuccessEnvelopeSchema<T extends z.ZodType>(
  dataSchema: T
) {
  return z.strictObject({
    api_schema_version: z.literal(API_V1_SCHEMA_VERSION),
    request_id: RequestIdSchema,
    data: dataSchema
  });
}

export const SessionPathParametersSchema = z.strictObject({
  session_id: SessionIdSchema
});

export const InvestigationPathParametersSchema = SessionPathParametersSchema.extend({
  result_id: DiagnosticResultIdSchema
});

export const ApiIdempotencyHeaderSchema = IdempotencyKeySchema;
