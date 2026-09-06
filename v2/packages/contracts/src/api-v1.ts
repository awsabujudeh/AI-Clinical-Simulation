import { z } from "zod";

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
  assessment_disclosure: SafeActiveAssessmentDisclosureSchema.optional()
});
export type SafeSessionProjection = z.infer<typeof SafeSessionProjectionSchema>;

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
    score_basis_points: z.number().int().min(0).max(10_000),
    weight_basis_points: z.number().int().min(1).max(10_000),
    weighted_contribution_basis_points: z.number().int().min(0).max(10_000)
  })).length(6),
  findings: z.array(z.strictObject({
    rubric_item_id: z.string().min(1).max(160),
    criterion_kind: z.enum(["AWARD", "PENALTY", "CRITICAL_ACTION", "CRITICAL_ERROR"]),
    status: z.enum(["SATISFIED", "MISSED", "TRIGGERED", "NOT_TRIGGERED"]),
    evidence_event_ids: z.array(EventIdSchema).max(33)
  })).max(1024)
});
export type SafeFinalAssessmentProjection = z.infer<
  typeof SafeFinalAssessmentProjectionSchema
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
