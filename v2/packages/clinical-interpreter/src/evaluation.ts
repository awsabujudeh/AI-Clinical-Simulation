import { z } from "zod";

import {
  ClinicalInterpretationSchema,
  PatientLanguageSchema,
  SafeLearnerActionCatalogueSchema
} from "@ai-clinical-simulation/contracts";
import { AiEvaluationModelCandidateSchema } from "@ai-clinical-simulation/ai-gateway";

export const CLINICAL_INTERPRETER_EVALUATION_CATEGORIES = [
  "EXACT_COMMAND",
  "SYNONYM",
  "AR_JO",
  "EN_US",
  "CODE_SWITCH",
  "NUMERIC_PARAMETER",
  "MISSING_PARAMETER",
  "WRONG_VALUE_PRESERVATION",
  "AMBIGUITY",
  "NO_MATCH",
  "NEGATION",
  "HYPOTHETICAL",
  "PAST_TENSE",
  "SELF_CORRECTION",
  "PROMPT_INJECTION",
  "UNAVAILABLE_ACTION",
  "COMPOUND_COMMAND",
  "MALFORMED_INPUT"
] as const;

export const ClinicalInterpreterEvaluationCaseSchema = z.strictObject({
  evaluation_case_id: z.string().regex(/^interpreter-eval\.[a-z0-9-]+$/u),
  category: z.enum(CLINICAL_INTERPRETER_EVALUATION_CATEGORIES),
  locale: PatientLanguageSchema,
  utterance: z.string().min(1).max(4_000),
  learner_action_catalogue: SafeLearnerActionCatalogueSchema,
  expected_interpretation: ClinicalInterpretationSchema
});
export type ClinicalInterpreterEvaluationCase = z.infer<
  typeof ClinicalInterpreterEvaluationCaseSchema
>;

const RateBasisPointsSchema = z.number().int().min(0).max(10_000);

export const ClinicalInterpreterEvaluationMetricsSchema = z.strictObject({
  evaluation_schema_version: z.literal("1.0"),
  candidate_model: AiEvaluationModelCandidateSchema,
  corpus_case_count: z.number().int().min(1),
  exact_action_id_match_rate_basis_points: RateBasisPointsSchema,
  parameter_extraction_exactness_basis_points: RateBasisPointsSchema,
  false_positive_execution_intent_rate_basis_points: RateBasisPointsSchema,
  ambiguity_detection_rate_basis_points: RateBasisPointsSchema,
  no_match_accuracy_basis_points: RateBasisPointsSchema,
  negation_safety_rate_basis_points: RateBasisPointsSchema,
  missing_parameter_preservation_rate_basis_points: RateBasisPointsSchema,
  hallucinated_parameter_rate_basis_points: RateBasisPointsSchema,
  unlisted_action_rate_basis_points: RateBasisPointsSchema,
  schema_validation_success_rate_basis_points: RateBasisPointsSchema,
  ar_jo_accuracy_basis_points: RateBasisPointsSchema,
  en_us_accuracy_basis_points: RateBasisPointsSchema,
  code_switch_accuracy_basis_points: RateBasisPointsSchema,
  prompt_injection_leakage_rate_basis_points: RateBasisPointsSchema,
  median_latency_ms: z.number().finite().nonnegative(),
  p95_latency_ms: z.number().finite().nonnegative(),
  total_input_tokens: z.number().int().nonnegative(),
  total_output_tokens: z.number().int().nonnegative(),
  provider_failure_rate_basis_points: RateBasisPointsSchema
});
export type ClinicalInterpreterEvaluationMetrics = z.infer<
  typeof ClinicalInterpreterEvaluationMetricsSchema
>;
