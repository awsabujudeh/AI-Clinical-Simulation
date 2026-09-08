import {
  AI_GATEWAY_SCHEMA_VERSION,
  AiGatewayRequestSchema,
  AiGatewayResultSchema,
  type AiGatewayAuditEvent,
  type AiGatewayErrorCode,
  type AiGatewayFailure,
  type AiGatewayResult,
  type AiGatewaySafeMetadata,
  type JsonObject
} from "@ai-clinical-simulation/contracts";
import { z } from "zod";

import type { TrustedCapabilityDefinition, TrustedCapabilityRegistry } from "./capability-registry.ts";
import type { AiProvider, AiProviderFailure } from "./provider.ts";

export interface AiGatewayClock {
  nowMilliseconds(): number;
}

export interface AiCapacityAuthority {
  authorize(input: Readonly<{
    capability_id: string;
    model_policy_id: string;
    input_characters: number;
    max_output_tokens: number;
  }>): Promise<Readonly<{ allowed: true }> | Readonly<{
    allowed: false;
    code: "AI_BUDGET_EXCEEDED" | "AI_PROVIDER_RATE_LIMITED";
  }>>;
}

export interface AiGatewayLogger {
  log(event: AiGatewayAuditEvent): void;
}

function errorFor(
  code: AiGatewayErrorCode,
  retryable: boolean,
  providerHttpStatus?: number
) {
  return Object.freeze({
    code,
    message_key: `ai.error.${code.toLowerCase().replaceAll("_", "-")}` as const,
    retryable,
    ...(providerHttpStatus === undefined ? {} : { provider_http_status: providerHttpStatus })
  });
}

function invalidRequest(): AiGatewayFailure {
  return AiGatewayResultSchema.parse({
    gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
    success: false,
    error: errorFor("AI_REQUEST_INVALID", false)
  }) as AiGatewayFailure;
}

function metadataFor(
  definition: TrustedCapabilityDefinition,
  providerResult: AiProviderFailure | {
    provider: string;
    provider_response_id: string;
    provider_model: string;
    retry_count: number;
    usage?: AiGatewaySafeMetadata["usage"];
  },
  responseStatus: AiGatewaySafeMetadata["response_status"],
  latencyMs: number
): AiGatewaySafeMetadata {
  return {
    capability_id: definition.data.capability_id,
    prompt_id: definition.data.prompt.prompt_id,
    prompt_version: definition.data.prompt.prompt_version,
    output_schema_id: definition.data.output.output_schema_id,
    output_schema_version: definition.data.output.output_schema_version,
    model_policy_id: definition.data.model_policy.model_policy_id,
    provider: providerResult.provider,
    response_status: responseStatus,
    latency_ms: latencyMs,
    retry_count: providerResult.retry_count,
    ...(definition.data.model_policy.reasoning_effort === undefined
      ? {}
      : { reasoning_effort: definition.data.model_policy.reasoning_effort }),
    ...(providerResult.provider_response_id === undefined
      ? {}
      : { provider_response_id: providerResult.provider_response_id }),
    ...(providerResult.provider_model === undefined
      ? {}
      : { provider_model: providerResult.provider_model }),
    ...(providerResult.usage === undefined ? {} : { usage: providerResult.usage })
  };
}

function audit(
  logger: AiGatewayLogger,
  request: z.infer<typeof AiGatewayRequestSchema>,
  metadata: AiGatewaySafeMetadata,
  errorCode?: AiGatewayErrorCode
): void {
  logger.log({
    gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
    request_id: request.request_id,
    correlation_id: request.correlation_id,
    capability_id: metadata.capability_id,
    prompt_id: metadata.prompt_id,
    prompt_version: metadata.prompt_version,
    output_schema_id: metadata.output_schema_id,
    output_schema_version: metadata.output_schema_version,
    model_policy_id: metadata.model_policy_id,
    provider: metadata.provider,
    response_status: metadata.response_status,
    latency_ms: metadata.latency_ms,
    retry_count: metadata.retry_count,
    ...(metadata.usage === undefined ? {} : { usage: metadata.usage }),
    ...(errorCode === undefined ? {} : { error_code: errorCode })
  });
}

export class SecureAiGateway {
  readonly #registry: TrustedCapabilityRegistry;
  readonly #provider: AiProvider;
  readonly #capacity: AiCapacityAuthority;
  readonly #clock: AiGatewayClock;
  readonly #logger: AiGatewayLogger;

  constructor(input: {
    registry: TrustedCapabilityRegistry;
    provider: AiProvider;
    capacity: AiCapacityAuthority;
    clock: AiGatewayClock;
    logger: AiGatewayLogger;
  }) {
    this.#registry = input.registry;
    this.#provider = input.provider;
    this.#capacity = input.capacity;
    this.#clock = input.clock;
    this.#logger = input.logger;
  }

  async execute(input: unknown): Promise<AiGatewayResult> {
    const request = AiGatewayRequestSchema.safeParse(input);
    if (!request.success) return invalidRequest();

    const definition = this.#registry.get(request.data.capability_id);
    if (definition === undefined || !definition.data.enabled) {
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_CAPABILITY_DISABLED", false)
      });
    }

    if (request.data.input.user_content.length > definition.data.max_input_characters) {
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_BUDGET_EXCEEDED", false)
      });
    }

    let capacity: Awaited<ReturnType<AiCapacityAuthority["authorize"]>>;
    try {
      capacity = await this.#capacity.authorize({
        capability_id: definition.data.capability_id,
        model_policy_id: definition.data.model_policy.model_policy_id,
        input_characters: request.data.input.user_content.length,
        max_output_tokens: definition.data.model_policy.max_output_tokens
      });
    } catch {
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_UNEXPECTED_FAILURE", false)
      });
    }
    if (!capacity.allowed) {
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor(capacity.code, capacity.code === "AI_PROVIDER_RATE_LIMITED")
      });
    }

    const started = this.#clock.nowMilliseconds();
    let providerResult: Awaited<ReturnType<AiProvider["execute"]>>;
    try {
      providerResult = await this.#provider.execute({
        model: definition.data.model_policy.candidate_model,
        instructions: definition.data.prompt.instructions,
        user_content: request.data.input.user_content,
        output_schema_name: definition.data.output.output_schema_name,
        output_json_schema: definition.output_json_schema,
        max_output_tokens: definition.data.model_policy.max_output_tokens,
        timeout_ms: definition.data.model_policy.timeout_ms,
        max_attempts: definition.data.model_policy.max_attempts,
        ...(definition.data.model_policy.reasoning_effort === undefined
          ? {}
          : { reasoning_effort: definition.data.model_policy.reasoning_effort })
      });
    } catch {
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_UNEXPECTED_FAILURE", false)
      });
    }
    const latencyMs = Math.max(0, this.#clock.nowMilliseconds() - started);

    if (!providerResult.success) {
      const metadata = metadataFor(
        definition,
        providerResult,
        providerResult.response_status,
        latencyMs
      );
      audit(this.#logger, request.data, metadata, providerResult.code);
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor(
          providerResult.code,
          providerResult.retryable,
          providerResult.provider_http_status
        ),
        metadata
      });
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(providerResult.output_text);
    } catch {
      const metadata = metadataFor(definition, providerResult, "FAILED", latencyMs);
      audit(this.#logger, request.data, metadata, "AI_OUTPUT_INVALID");
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_OUTPUT_INVALID", false),
        metadata
      });
    }

    const localOutput = definition.output_schema.safeParse(decoded);
    if (!localOutput.success) {
      const metadata = metadataFor(definition, providerResult, "FAILED", latencyMs);
      audit(this.#logger, request.data, metadata, "AI_SCHEMA_MISMATCH");
      return AiGatewayResultSchema.parse({
        gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
        success: false,
        request_id: request.data.request_id,
        correlation_id: request.data.correlation_id,
        error: errorFor("AI_SCHEMA_MISMATCH", false),
        metadata
      });
    }

    const metadata = metadataFor(definition, providerResult, "COMPLETED", latencyMs);
    audit(this.#logger, request.data, metadata);
    return AiGatewayResultSchema.parse({
      gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
      success: true,
      request_id: request.data.request_id,
      correlation_id: request.data.correlation_id,
      output: localOutput.data as JsonObject,
      metadata
    });
  }
}
