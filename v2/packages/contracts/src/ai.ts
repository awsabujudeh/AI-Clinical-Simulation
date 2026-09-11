import { z } from "zod";

import {
  AiModelPolicyIdSchema,
  AiOutputSchemaIdSchema,
  AiPromptIdSchema,
  AiWorkflowRequestIdSchema,
  CorrelationIdSchema,
  SchemaVersionSchema
} from "./ids.ts";
import { JsonObjectSchema } from "./json.ts";

export const AI_GATEWAY_SCHEMA_VERSION = "1.0" as const;

export const AI_CAPABILITY_IDS = [
  "PATIENT_CONVERSATION",
  "CLINICAL_INTERPRETER",
  "TUTOR",
  "ASSESSMENT_ANALYSIS",
  "CASE_DRAFTING"
] as const;

export const AiCapabilityIdSchema = z.enum(AI_CAPABILITY_IDS);
export type AiCapabilityId = z.infer<typeof AiCapabilityIdSchema>;

export const AiRequestLocaleSchema = z.enum(["ar-JO", "en-US"]);
export type AiRequestLocale = z.infer<typeof AiRequestLocaleSchema>;

export const AiProviderIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u);
export type AiProviderId = z.infer<typeof AiProviderIdSchema>;

export const AiGatewayRequestSchema = z.strictObject({
  gateway_schema_version: z.literal(AI_GATEWAY_SCHEMA_VERSION),
  request_id: AiWorkflowRequestIdSchema,
  correlation_id: CorrelationIdSchema,
  capability_id: AiCapabilityIdSchema,
  locale: AiRequestLocaleSchema,
  input: z.strictObject({
    user_content: z.string().min(1).max(65_536)
  })
});
export type AiGatewayRequest = z.infer<typeof AiGatewayRequestSchema>;

export const AI_GATEWAY_ERROR_CODES = [
  "AI_REQUEST_INVALID",
  "AI_CAPABILITY_DISABLED",
  "AI_PROVIDER_NOT_CONFIGURED",
  "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_REJECTED_REQUEST",
  "AI_RESPONSE_INCOMPLETE",
  "AI_RESPONSE_REFUSED",
  "AI_OUTPUT_INVALID",
  "AI_SCHEMA_MISMATCH",
  "AI_BUDGET_EXCEEDED",
  "AI_UNEXPECTED_FAILURE"
] as const;

export const AiGatewayErrorCodeSchema = z.enum(AI_GATEWAY_ERROR_CODES);
export type AiGatewayErrorCode = z.infer<typeof AiGatewayErrorCodeSchema>;

export const AiGatewayErrorSchema = z.strictObject({
  code: AiGatewayErrorCodeSchema,
  message_key: z.string().regex(/^ai\.error\.[a-z0-9-]+$/u),
  retryable: z.boolean(),
  provider_http_status: z.number().int().min(400).max(599).optional()
});
export type AiGatewayError = z.infer<typeof AiGatewayErrorSchema>;

export const AiUsageMetadataSchema = z.strictObject({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});
export type AiUsageMetadata = z.infer<typeof AiUsageMetadataSchema>;

export const AiGatewaySafeMetadataSchema = z.strictObject({
  capability_id: AiCapabilityIdSchema,
  prompt_id: AiPromptIdSchema,
  prompt_version: SchemaVersionSchema,
  output_schema_id: AiOutputSchemaIdSchema,
  output_schema_version: SchemaVersionSchema,
  model_policy_id: AiModelPolicyIdSchema,
  provider: AiProviderIdSchema,
  provider_response_id: z.string().min(1).max(160).optional(),
  provider_model: z.string().min(1).max(160).optional(),
  response_status: z.enum(["COMPLETED", "FAILED", "INCOMPLETE", "REFUSED"]),
  reasoning_effort: z.enum(["none", "minimal", "low", "medium", "high"]).optional(),
  latency_ms: z.number().finite().nonnegative(),
  retry_count: z.number().int().nonnegative().max(1),
  usage: AiUsageMetadataSchema.optional()
});
export type AiGatewaySafeMetadata = z.infer<typeof AiGatewaySafeMetadataSchema>;

export const AiGatewaySuccessSchema = z.strictObject({
  gateway_schema_version: z.literal(AI_GATEWAY_SCHEMA_VERSION),
  success: z.literal(true),
  request_id: AiWorkflowRequestIdSchema,
  correlation_id: CorrelationIdSchema,
  output: JsonObjectSchema,
  metadata: AiGatewaySafeMetadataSchema
});
export type AiGatewaySuccess = z.infer<typeof AiGatewaySuccessSchema>;

export const AiGatewayFailureSchema = z.strictObject({
  gateway_schema_version: z.literal(AI_GATEWAY_SCHEMA_VERSION),
  success: z.literal(false),
  request_id: AiWorkflowRequestIdSchema.optional(),
  correlation_id: CorrelationIdSchema.optional(),
  error: AiGatewayErrorSchema,
  metadata: AiGatewaySafeMetadataSchema.optional()
});
export type AiGatewayFailure = z.infer<typeof AiGatewayFailureSchema>;

export const AiGatewayResultSchema = z.discriminatedUnion("success", [
  AiGatewaySuccessSchema,
  AiGatewayFailureSchema
]);
export type AiGatewayResult = z.infer<typeof AiGatewayResultSchema>;

export const AiGatewayAuditEventSchema = z.strictObject({
  gateway_schema_version: z.literal(AI_GATEWAY_SCHEMA_VERSION),
  request_id: AiWorkflowRequestIdSchema,
  correlation_id: CorrelationIdSchema,
  capability_id: AiCapabilityIdSchema,
  prompt_id: AiPromptIdSchema,
  prompt_version: SchemaVersionSchema,
  output_schema_id: AiOutputSchemaIdSchema,
  output_schema_version: SchemaVersionSchema,
  model_policy_id: AiModelPolicyIdSchema,
  provider: AiProviderIdSchema,
  response_status: AiGatewaySafeMetadataSchema.shape.response_status,
  latency_ms: z.number().finite().nonnegative(),
  retry_count: z.number().int().nonnegative().max(1),
  usage: AiUsageMetadataSchema.optional(),
  error_code: AiGatewayErrorCodeSchema.optional()
});
export type AiGatewayAuditEvent = z.infer<typeof AiGatewayAuditEventSchema>;
