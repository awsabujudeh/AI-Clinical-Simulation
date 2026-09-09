import { z } from "zod";

import { ActionIdSchema, StateVersionSchema } from "./ids.ts";
import { SafeLearnerActionCatalogueSchema } from "./api-v1.ts";
import { JsonObjectSchema } from "./json.ts";
import { PatientLanguageSchema } from "./locales.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";

export const CLINICAL_INTERPRETER_SCHEMA_VERSION = "1.0" as const;

export const ClinicalInterpreterContextSchema = z.strictObject({
  context_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
  locale: PatientLanguageSchema,
  learner_action_catalogue: SafeLearnerActionCatalogueSchema
});
export type ClinicalInterpreterContext = z.infer<
  typeof ClinicalInterpreterContextSchema
>;

export const ClinicalInterpreterModelCandidateSchema = z.strictObject({
  action_id: ActionIdSchema,
  parameters: JsonObjectSchema,
  unresolved_required_parameters: z.array(CaseControlledValueSchema).max(32)
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

// Provider-facing Structured Outputs must have one strict object at the root.
// Nullable reason fields keep every property required by strict providers; the
// local refinement is the second authority that validates status-specific shape.
export const ClinicalInterpreterModelOutputSchema = z.strictObject({
  output_schema_version: z.literal(CLINICAL_INTERPRETER_SCHEMA_VERSION),
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
