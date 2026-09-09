import { z } from "zod";

import {
  AiModelPolicyIdSchema,
  AiOutputSchemaIdSchema,
  AiPromptIdSchema,
  ClinicalTimeSchema,
  ConversationTurnIdSchema,
  EventIdSchema,
  FactIdSchema,
  PatientManifestationIdSchema,
  SchemaVersionSchema,
  SequenceNumberSchema,
  SessionIdSchema,
  StateVersionSchema
} from "./ids.ts";
import { PatientLanguageSchema } from "./locales.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";

export const PATIENT_CONVERSATION_SCHEMA_VERSION = "1.0" as const;
export const PATIENT_AGENT_OUTPUT_SCHEMA_VERSION = "1.0" as const;
export const PATIENT_CONVERSATION_HISTORY_MAX_TURNS = 12 as const;
export const PATIENT_CONVERSATION_HISTORY_MAX_CHARACTERS = 12_000 as const;

export const PatientTruthStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "UNKNOWN",
  "AUTHORED_STATEMENT"
]);
export type PatientTruthStatus = z.infer<typeof PatientTruthStatusSchema>;

export const PatientConversationFactSchema = z.strictObject({
  fact_id: FactIdSchema,
  clinical_code: CaseControlledValueSchema,
  truth_status: PatientTruthStatusSchema,
  text: z.string().trim().min(1).max(4_000)
});
export type PatientConversationFact = z.infer<typeof PatientConversationFactSchema>;

export const PatientConversationManifestationSchema = z.strictObject({
  manifestation_id: PatientManifestationIdSchema,
  truth_status: PatientTruthStatusSchema,
  text: z.string().trim().min(1).max(1_000)
});
export type PatientConversationManifestation = z.infer<
  typeof PatientConversationManifestationSchema
>;

export const PatientConversationHistoryTurnSchema = z.strictObject({
  turn_id: ConversationTurnIdSchema,
  turn_sequence: SequenceNumberSchema,
  locale: PatientLanguageSchema,
  learner_utterance: z.string().trim().min(1).max(4_000),
  patient_utterance: z.string().trim().min(1).max(2_000),
  answer_mode: z.enum(["GROUNDED", "UNKNOWN", "FALLBACK"])
});
export type PatientConversationHistoryTurn = z.infer<
  typeof PatientConversationHistoryTurnSchema
>;

export const PatientConversationContextSchema = z.strictObject({
  context_schema_version: z.literal(PATIENT_CONVERSATION_SCHEMA_VERSION),
  locale: PatientLanguageSchema,
  persona_code: CaseControlledValueSchema,
  conversational_style_code: CaseControlledValueSchema,
  emotional_tone_code: CaseControlledValueSchema,
  facts: z.array(PatientConversationFactSchema).max(256),
  current_manifestations: z.array(PatientConversationManifestationSchema).max(128),
  history: z.array(PatientConversationHistoryTurnSchema)
    .max(PATIENT_CONVERSATION_HISTORY_MAX_TURNS),
  deterministic_fallback_text: z.string().trim().min(1).max(1_000),
  grounded_state_version: StateVersionSchema,
  grounded_clinical_time: ClinicalTimeSchema
});
export type PatientConversationContext = z.infer<typeof PatientConversationContextSchema>;

export const PatientAgentSafetyFlagSchema = z.enum([
  "UNKNOWN_INFORMATION",
  "DIAGNOSIS_REQUEST",
  "TEST_RESULT_REQUEST",
  "TREATMENT_REQUEST",
  "FUTURE_EVENT_REQUEST",
  "RUBRIC_REQUEST",
  "PROMPT_INJECTION",
  "IRRELEVANT_QUESTION"
]);

export const PatientAgentOutputSchema = z.strictObject({
  output_schema_version: z.literal(PATIENT_AGENT_OUTPUT_SCHEMA_VERSION),
  utterance: z.string().trim().min(1).max(2_000),
  locale: PatientLanguageSchema,
  answer_mode: z.enum(["GROUNDED", "UNKNOWN"]),
  grounding_fact_ids: z.array(FactIdSchema).max(32),
  grounding_state_refs: z.array(PatientManifestationIdSchema).max(32),
  safety_flags: z.array(PatientAgentSafetyFlagSchema).max(8),
  disclosure_status: z.literal("WITHIN_PATIENT_BOUNDARY")
});
export type PatientAgentOutput = z.infer<typeof PatientAgentOutputSchema>;

export const PatientConversationTurnSchema = z.strictObject({
  conversation_schema_version: z.literal(PATIENT_CONVERSATION_SCHEMA_VERSION),
  turn_id: ConversationTurnIdSchema,
  session_id: SessionIdSchema,
  turn_sequence: SequenceNumberSchema,
  clinical_time: ClinicalTimeSchema,
  grounded_state_version: StateVersionSchema,
  locale: PatientLanguageSchema,
  source: z.enum(["TEXT", "STT"]),
  utterance_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u),
  learner_utterance: z.string().trim().min(1).max(4_000),
  patient_utterance: z.string().trim().min(1).max(2_000),
  answer_mode: z.enum(["GROUNDED", "UNKNOWN", "FALLBACK"]),
  fallback_used: z.boolean(),
  grounding_fact_ids: z.array(FactIdSchema).max(32),
  grounding_state_refs: z.array(PatientManifestationIdSchema).max(32),
  question_event_id: EventIdSchema,
  response_event_id: EventIdSchema,
  provider_metadata: z.strictObject({
    capability_id: z.literal("PATIENT_CONVERSATION"),
    prompt_id: AiPromptIdSchema,
    prompt_version: SchemaVersionSchema,
    output_schema_id: AiOutputSchemaIdSchema,
    output_schema_version: SchemaVersionSchema,
    model_policy_id: AiModelPolicyIdSchema,
    provider_model: z.string().min(1).max(160).optional()
  }).optional()
});
export type PatientConversationTurn = z.infer<typeof PatientConversationTurnSchema>;

export const SafePatientConversationTurnSchema = PatientConversationTurnSchema.omit({
  provider_metadata: true
});
export type SafePatientConversationTurn = z.infer<typeof SafePatientConversationTurnSchema>;

export const SubmitQuestionResponseDataSchema = z.strictObject({
  replayed: z.boolean(),
  turn: SafePatientConversationTurnSchema
});
export type SubmitQuestionResponseData = z.infer<typeof SubmitQuestionResponseDataSchema>;

export const PatientConversationTranscriptSchema = z.strictObject({
  conversation_schema_version: z.literal(PATIENT_CONVERSATION_SCHEMA_VERSION),
  session_id: SessionIdSchema,
  turns: z.array(SafePatientConversationTurnSchema).max(512),
  truncated_before_turn_sequence: SequenceNumberSchema.optional()
});
export type PatientConversationTranscript = z.infer<
  typeof PatientConversationTranscriptSchema
>;
