import { z } from "zod";

import { SchemaVersionSchema } from "@ai-clinical-simulation/contracts";

import { AiEvaluationModelCandidateSchema } from "./capability-registry.ts";

export const AI_MODEL_EVALUATION_SCHEMA_VERSION = "1.0" as const;
export const AI_MODEL_EVALUATION_REPETITIONS = 3 as const;
export const AI_MODEL_EVALUATION_MAX_CONCURRENCY = 2 as const;

export const AiEvaluationCapabilitySchema = z.enum([
  "PATIENT_CONVERSATION",
  "CLINICAL_INTERPRETER"
]);
export type AiEvaluationCapability = z.infer<typeof AiEvaluationCapabilitySchema>;

export const AiEvaluationProviderOutcomeSchema = z.enum([
  "COMPLETED",
  "RATE_LIMITED",
  "TIMED_OUT",
  "UNAVAILABLE",
  "MALFORMED_OUTPUT",
  "SCHEMA_INVALID",
  "REFUSED",
  "CREDENTIAL_FAILURE",
  "REJECTED",
  "INCOMPLETE",
  "OTHER_FAILURE"
]);
export type AiEvaluationProviderOutcome = z.infer<
  typeof AiEvaluationProviderOutcomeSchema
>;

export const AiEvaluationMetricResultSchema = z.strictObject({
  metric_code: z.string().regex(/^[A-Z][A-Z0-9_]{1,95}$/u),
  passed: z.boolean()
});

export const AiEvaluationRunRecordSchema = z.strictObject({
  evaluation_schema_version: z.literal(AI_MODEL_EVALUATION_SCHEMA_VERSION),
  evaluation_run_id: z.string().regex(/^v2-019b2\.[a-z0-9.-]+$/u),
  evaluation_freeze_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  capability: AiEvaluationCapabilitySchema,
  evaluation_case_id: z.string().min(1).max(160),
  repetition_index: z.number().int().min(1).max(AI_MODEL_EVALUATION_REPETITIONS),
  model_id: AiEvaluationModelCandidateSchema,
  prompt_id: z.string().min(1).max(160),
  prompt_version: z.literal("1.0"),
  output_schema_id: z.string().min(1).max(160),
  output_schema_version: SchemaVersionSchema,
  provider_outcome: AiEvaluationProviderOutcomeSchema,
  schema_valid: z.boolean(),
  local_validation_valid: z.boolean(),
  hard_safety_violations: z.array(
    z.string().regex(/^[A-Z][A-Z0-9_]{1,95}$/u)
  ).max(32),
  metrics: z.array(AiEvaluationMetricResultSchema).max(64),
  latency_ms: z.number().finite().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  output_hash: z.string().regex(/^[a-f0-9]{64}$/u).nullable()
});
export type AiEvaluationRunRecord = z.infer<typeof AiEvaluationRunRecordSchema>;

const PriceSchema = z.number().finite().nonnegative();

export const AiEvaluationPricingSnapshotSchema = z.strictObject({
  snapshot_date: z.literal("2026-09-10"),
  currency: z.literal("USD"),
  unit: z.literal("PER_1M_TEXT_TOKENS"),
  sources: z.tuple([
    z.literal("https://developers.openai.com/api/docs/models/gpt-5.6-luna"),
    z.literal("https://developers.openai.com/api/docs/models/gpt-5.6-terra")
  ]),
  prices: z.strictObject({
    "gpt-5.6-luna": z.strictObject({
      input: z.literal(0.2),
      output: z.literal(1.2)
    }),
    "gpt-5.6-terra": z.strictObject({
      input: z.literal(2),
      output: z.literal(12)
    })
  }),
  hard_budget_usd: z.literal(5),
  cost_calculation_method: z.literal(
    "ESTIMATED_INPUT_CHARACTERS_DIVIDED_BY_3_PLUS_MAX_OUTPUT_TOKENS_AT_SNAPSHOT_PRICES"
  ),
  projected_maximum_usd: PriceSchema
});

export const AiEvaluationFrozenCapabilitySchema = z.strictObject({
  capability: AiEvaluationCapabilitySchema,
  prompt_id: z.string().min(1).max(160),
  prompt_version: z.literal("1.0"),
  prompt_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  output_schema_id: z.string().min(1).max(160),
  output_schema_version: SchemaVersionSchema,
  authoritative_domain_schema_version: SchemaVersionSchema,
  output_schema_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  reasoning_effort: z.literal("low"),
  max_output_tokens: z.number().int().positive(),
  timeout_ms: z.literal(8_000),
  max_attempts: z.literal(2),
  tools: z.tuple([]),
  store: z.literal(false),
  corpus_case_count: z.literal(54),
  corpus_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  expected_labels_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  scoring_methodology_sha256: z.string().regex(/^[a-f0-9]{64}$/u)
});

export const AiEvaluationFreezeSchema = z.strictObject({
  evaluation_schema_version: z.literal(AI_MODEL_EVALUATION_SCHEMA_VERSION),
  harness_version: z.literal("1.2"),
  result_normalization_version: z.literal("1.0"),
  protocol_id: z.literal("v2-019b2.luna-vs-terra"),
  candidates: z.tuple([
    z.literal("gpt-5.6-luna"),
    z.literal("gpt-5.6-terra")
  ]),
  repetitions_per_case: z.literal(AI_MODEL_EVALUATION_REPETITIONS),
  maximum_concurrency: z.literal(AI_MODEL_EVALUATION_MAX_CONCURRENCY),
  total_planned_requests: z.literal(648),
  case_order_policy: z.literal("REPETITION_CAPABILITY_CASE_MODEL_PAIRED"),
  resume_policy: z.literal("FREEZE_BOUND_COMPLETED_RECORDS_SKIP_EXACTLY"),
  selection_hierarchy: z.tuple([
    z.literal("HARD_SAFETY"),
    z.literal("DETERMINISTIC_CORRECTNESS_RELIABILITY"),
    z.literal("PAIRED_STATISTICAL_COMPARISON"),
    z.literal("LATENCY"),
    z.literal("COST")
  ]),
  capabilities: z.tuple([
    AiEvaluationFrozenCapabilitySchema.extend({
      capability: z.literal("PATIENT_CONVERSATION")
    }),
    AiEvaluationFrozenCapabilitySchema.extend({
      capability: z.literal("CLINICAL_INTERPRETER")
    })
  ]),
  pricing: AiEvaluationPricingSnapshotSchema
});
export type AiEvaluationFreeze = z.infer<typeof AiEvaluationFreezeSchema>;

export const AiEvaluationFreezeArtifactSchema = z.strictObject({
  freeze: AiEvaluationFreezeSchema,
  evaluation_freeze_hash: z.string().regex(/^[a-f0-9]{64}$/u)
});
export type AiEvaluationFreezeArtifact = z.infer<
  typeof AiEvaluationFreezeArtifactSchema
>;

export function estimateEvaluationCostUsd(input: {
  model_id: "gpt-5.6-luna" | "gpt-5.6-terra";
  input_tokens: number;
  output_tokens: number;
}): number {
  const parsed = z.strictObject({
    model_id: AiEvaluationModelCandidateSchema,
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative()
  }).parse(input);
  const prices = parsed.model_id === "gpt-5.6-luna"
    ? { input: 0.2, output: 1.2 }
    : { input: 2, output: 12 };
  return (parsed.input_tokens * prices.input + parsed.output_tokens * prices.output) / 1_000_000;
}
