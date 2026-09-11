import {
  AiCapabilityIdSchema,
  AiModelPolicyIdSchema,
  AiOutputSchemaIdSchema,
  AiPromptIdSchema,
  JsonObjectSchema,
  SchemaVersionSchema,
  type AiCapabilityId,
  type JsonObject
} from "@ai-clinical-simulation/contracts";
import { z } from "zod";

export const APPROVED_EVALUATION_MODEL_CANDIDATES = [
  "gpt-5.6-luna",
  "gpt-5.6-terra"
] as const;

export const AiEvaluationModelCandidateSchema = z.enum(
  APPROVED_EVALUATION_MODEL_CANDIDATES
);
export type AiEvaluationModelCandidate = z.infer<
  typeof AiEvaluationModelCandidateSchema
>;

export const TrustedModelPolicySchema = z.strictObject({
  model_policy_id: AiModelPolicyIdSchema,
  candidate_model: AiEvaluationModelCandidateSchema,
  reasoning_effort: z.enum(["none", "minimal", "low", "medium", "high"]).optional(),
  max_output_tokens: z.number().int().min(1).max(4096),
  timeout_ms: z.number().int().min(50).max(45_000),
  max_attempts: z.union([z.literal(1), z.literal(2)])
});
export type TrustedModelPolicy = z.infer<typeof TrustedModelPolicySchema>;

export const TrustedPromptIdentitySchema = z.strictObject({
  prompt_id: AiPromptIdSchema,
  prompt_version: SchemaVersionSchema,
  instructions: z.string().min(1).max(12_000)
});

export const TrustedOutputIdentitySchema = z.strictObject({
  output_schema_id: AiOutputSchemaIdSchema,
  output_schema_version: SchemaVersionSchema,
  output_schema_name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/u)
});

export const TrustedCapabilityDataSchema = z.strictObject({
  capability_id: AiCapabilityIdSchema,
  enabled: z.boolean(),
  prompt: TrustedPromptIdentitySchema,
  model_policy: TrustedModelPolicySchema,
  output: TrustedOutputIdentitySchema,
  max_input_characters: z.number().int().min(1).max(65_536),
  tools: z.tuple([])
});
export type TrustedCapabilityData = z.infer<typeof TrustedCapabilityDataSchema>;

export type TrustedCapabilityDefinition = Readonly<{
  data: TrustedCapabilityData;
  output_schema: z.ZodType<JsonObject>;
  output_json_schema: JsonObject;
}>;

export function defineTrustedCapability(
  dataInput: unknown,
  outputSchema: z.ZodType<JsonObject>
): TrustedCapabilityDefinition {
  const data = TrustedCapabilityDataSchema.parse(dataInput);
  const generated = JsonObjectSchema.parse(z.toJSONSchema(outputSchema));
  const { $schema: _jsonSchemaDialect, ...providerSchema } = generated;
  if (providerSchema.type !== "object" || providerSchema.additionalProperties !== false) {
    throw new Error("Trusted AI output schemas must be strict top-level JSON objects.");
  }
  return Object.freeze({
    data,
    output_schema: outputSchema,
    output_json_schema: JsonObjectSchema.parse(providerSchema)
  });
}

export class TrustedCapabilityRegistry {
  readonly #definitions: ReadonlyMap<AiCapabilityId, TrustedCapabilityDefinition>;

  constructor(definitions: readonly TrustedCapabilityDefinition[]) {
    const map = new Map<AiCapabilityId, TrustedCapabilityDefinition>();
    for (const definition of definitions) {
      if (map.has(definition.data.capability_id)) {
        throw new Error(`Duplicate trusted AI capability: ${definition.data.capability_id}`);
      }
      map.set(definition.data.capability_id, definition);
    }
    this.#definitions = map;
  }

  get(capabilityId: AiCapabilityId): TrustedCapabilityDefinition | undefined {
    return this.#definitions.get(capabilityId);
  }
}
