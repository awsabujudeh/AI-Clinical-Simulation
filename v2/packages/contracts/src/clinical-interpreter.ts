import { z } from "zod";

import { ActionIdSchema, StateVersionSchema } from "./ids.ts";
import { SafeLearnerActionCatalogueSchema } from "./api-v1.ts";
import { JsonObjectSchema } from "./json.ts";
import { PatientLanguageSchema } from "./locales.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";

export const CLINICAL_INTERPRETER_SCHEMA_VERSION = "1.0" as const;
export const CLINICAL_INTERPRETER_MODEL_OUTPUT_SCHEMA_VERSION = "2.0" as const;

export const ClinicalInterpreterContextSchema = z.strictObject({
  context_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
  locale: PatientLanguageSchema,
  learner_action_catalogue: SafeLearnerActionCatalogueSchema
});
export type ClinicalInterpreterContext = z.infer<
  typeof ClinicalInterpreterContextSchema
>;

export const ClinicalInterpreterProviderValueTypeSchema = z.enum([
  "STRING",
  "NUMBER",
  "INTEGER",
  "BOOLEAN",
  "CODE"
]);

// This is the deliberately simple provider wire grammar. Parameter identities
// are array values rather than object keys, and every finite primitive slot is
// required/nullable so the generated Structured Outputs schema has no dynamic
// maps, recursive JSON values, or polymorphic generic value field.
export const ClinicalInterpreterProviderParameterWireSchema = z.strictObject({
  parameter_id: z.string(),
  value_type: ClinicalInterpreterProviderValueTypeSchema,
  string_value: z.string().nullable(),
  number_value: z.number().nullable(),
  integer_value: z.number().int().nullable(),
  boolean_value: z.boolean().nullable(),
  code_value: z.string().nullable()
});
export type ClinicalInterpreterProviderParameterWire = z.infer<
  typeof ClinicalInterpreterProviderParameterWireSchema
>;

export const ClinicalInterpreterProviderParameterEntrySchema =
  ClinicalInterpreterProviderParameterWireSchema.extend({
    parameter_id: CaseControlledValueSchema,
    string_value: z.string().max(4_000).nullable(),
    number_value: z.number().finite().nullable(),
    integer_value: z.number().int().finite().nullable(),
    code_value: CaseControlledValueSchema.nullable()
  }).superRefine((entry, context) => {
  const populatedSlots = [
    entry.string_value,
    entry.number_value,
    entry.integer_value,
    entry.boolean_value,
    entry.code_value
  ].filter((value) => value !== null).length;
  const valid = populatedSlots === 1
    && (entry.value_type === "STRING"
      ? entry.string_value !== null
      : entry.value_type === "NUMBER"
        ? entry.number_value !== null && Number.isFinite(entry.number_value)
        : entry.value_type === "INTEGER"
          ? entry.integer_value !== null && Number.isInteger(entry.integer_value)
          : entry.value_type === "BOOLEAN"
            ? entry.boolean_value !== null
            : entry.code_value !== null);
  if (!valid) {
    context.addIssue({
      code: "custom",
      message: "Interpreter parameter value type and populated value slot are inconsistent."
    });
  }
});
export type ClinicalInterpreterProviderParameterEntry = z.infer<
  typeof ClinicalInterpreterProviderParameterEntrySchema
>;

const ClinicalInterpreterProviderParameterListSchema = z
  .array(ClinicalInterpreterProviderParameterEntrySchema)
  .max(32)
  .superRefine((parameters, context) => {
    const parameterIds = new Set<string>();
    for (const [index, parameter] of parameters.entries()) {
      if (parameterIds.has(parameter.parameter_id)) {
        context.addIssue({
          code: "custom",
          path: [index, "parameter_id"],
          message: "Interpreter provider parameter identities must be unique."
        });
      }
      parameterIds.add(parameter.parameter_id);
    }
  });

export const ClinicalInterpreterModelCandidateSchema = z.strictObject({
  action_id: ActionIdSchema,
  parameters: ClinicalInterpreterProviderParameterListSchema
});
export type ClinicalInterpreterModelCandidate = z.infer<
  typeof ClinicalInterpreterModelCandidateSchema
>;

const ClinicalInterpreterModelCandidateListSchema = z
  .array(ClinicalInterpreterModelCandidateSchema)
  .max(8)
  .superRefine((candidates, context) => {
    const actionIds = new Set<string>();
    for (const [index, candidate] of candidates.entries()) {
      if (actionIds.has(candidate.action_id)) {
        context.addIssue({
          code: "custom",
          path: [index, "action_id"],
          message: "Interpreter candidate action identities must be unique."
        });
      }
      actionIds.add(candidate.action_id);
    }
  });

export const ClinicalInterpreterNoMatchReasonSchema = z.enum([
  "NO_ACTIONABLE_COMMAND",
  "NEGATED",
  "HYPOTHETICAL",
  "PAST_TENSE",
  "UNAVAILABLE_ACTION",
  "MALFORMED_INPUT"
]);
export type ClinicalInterpreterNoMatchReason = z.infer<
  typeof ClinicalInterpreterNoMatchReasonSchema
>;

const ClinicalInterpreterAmbiguityReasonSchema = z.enum([
  "MULTIPLE_ACTIONS",
  "MULTIPLE_INTENTS",
  "UNCLEAR_ACTION"
]);

const ClinicalInterpreterProviderParameterWireListSchema = z
  .array(ClinicalInterpreterProviderParameterWireSchema)
  .max(32);

export const ClinicalInterpreterProviderCandidateWireSchema = z.strictObject({
  action_id: z.string(),
  parameters: ClinicalInterpreterProviderParameterWireListSchema
});
export type ClinicalInterpreterProviderCandidateWire = z.infer<
  typeof ClinicalInterpreterProviderCandidateWireSchema
>;

// Provider acceptance is only the first validation stage. This finite schema is
// intentionally free of catalogue regexes and semantic cross-field refinements;
// ClinicalInterpreterModelOutputSchema below is the stricter local authority.
export const ClinicalInterpreterProviderOutputSchema = z.strictObject({
  output_schema_version: z.literal(CLINICAL_INTERPRETER_MODEL_OUTPUT_SCHEMA_VERSION),
  status: z.enum(["MATCH", "AMBIGUOUS", "NO_MATCH"]),
  ambiguity_reason: ClinicalInterpreterAmbiguityReasonSchema.nullable(),
  no_match_reason: ClinicalInterpreterNoMatchReasonSchema.nullable(),
  candidates: z.array(ClinicalInterpreterProviderCandidateWireSchema).max(8)
});
export type ClinicalInterpreterProviderOutput = z.infer<
  typeof ClinicalInterpreterProviderOutputSchema
>;

// Provider-facing Structured Outputs must have one strict object at the root.
// Nullable reason fields keep every property required by strict providers; the
// local refinement is the second authority that validates status-specific shape.
export const ClinicalInterpreterModelOutputSchema = z.strictObject({
  output_schema_version: z.literal(CLINICAL_INTERPRETER_MODEL_OUTPUT_SCHEMA_VERSION),
  status: z.enum(["MATCH", "AMBIGUOUS", "NO_MATCH"]),
  ambiguity_reason: ClinicalInterpreterAmbiguityReasonSchema.nullable(),
  no_match_reason: ClinicalInterpreterNoMatchReasonSchema.nullable(),
  candidates: ClinicalInterpreterModelCandidateListSchema
}).superRefine((output, context) => {
  const valid = output.status === "MATCH"
    ? output.candidates.length === 1
      && output.ambiguity_reason === null
      && output.no_match_reason === null
    : output.status === "AMBIGUOUS"
      ? output.candidates.length >= 2
        && output.ambiguity_reason !== null
        && output.no_match_reason === null
      : output.candidates.length === 0
        && output.ambiguity_reason === null
        && output.no_match_reason !== null;
  if (!valid) {
    context.addIssue({
      code: "custom",
      message: "Interpreter status, reasons, and candidate count are inconsistent."
    });
  }
});
export type ClinicalInterpreterModelOutput = z.infer<
  typeof ClinicalInterpreterModelOutputSchema
>;

export const ReconciledClinicalActionCandidateSchema = z.strictObject({
  action_id: ActionIdSchema,
  parameters: JsonObjectSchema,
  unresolved_required_parameters: z.array(CaseControlledValueSchema).max(32),
  confirmation_policy: z.enum([
    "NONE",
    "EXPLICIT_REQUEST",
    "EXPLICIT_ADMINISTRATION",
    "CASE_DEFINED"
  ])
});
export type ReconciledClinicalActionCandidate = z.infer<
  typeof ReconciledClinicalActionCandidateSchema
>;

export const ClinicalInterpretationSchema = z.discriminatedUnion("status", [
  z.strictObject({
    interpretation_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
    authority: z.literal("NON_AUTHORITATIVE"),
    status: z.literal("MATCH"),
    candidate: ReconciledClinicalActionCandidateSchema
  }),
  z.strictObject({
    interpretation_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
    authority: z.literal("NON_AUTHORITATIVE"),
    status: z.literal("AMBIGUOUS"),
    ambiguity_reason: ClinicalInterpreterAmbiguityReasonSchema,
    candidates: z.array(ReconciledClinicalActionCandidateSchema).min(2).max(8)
  }),
  z.strictObject({
    interpretation_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
    authority: z.literal("NON_AUTHORITATIVE"),
    status: z.literal("NO_MATCH"),
    no_match_reason: ClinicalInterpreterNoMatchReasonSchema
  })
]);
export type ClinicalInterpretation = z.infer<typeof ClinicalInterpretationSchema>;

export const SubmitClinicalInterpretationRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(4_000),
  locale: PatientLanguageSchema,
  utterance_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
});
export type SubmitClinicalInterpretationRequest = z.infer<
  typeof SubmitClinicalInterpretationRequestSchema
>;

export const SubmitClinicalInterpretationResponseDataSchema = z.strictObject({
  interpretation: ClinicalInterpretationSchema,
  grounded_state_version: StateVersionSchema,
  catalogue_schema_version: z.literal("1.0")
});
export type SubmitClinicalInterpretationResponseData = z.infer<
  typeof SubmitClinicalInterpretationResponseDataSchema
>;
