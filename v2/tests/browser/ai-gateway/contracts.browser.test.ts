import { describe, expect, it } from "vitest";

import {
  AI_CAPABILITY_IDS,
  AI_GATEWAY_ERROR_CODES,
  AiGatewayRequestSchema,
  AiGatewayResultSchema,
  AiPromptIdSchema
} from "../../../packages/contracts/src/index.ts";
import { SYNTHETIC_AI_REQUEST } from "../../fixtures/ai-gateway/synthetic-ai-gateway.ts";

describe("V2-018 shared AI contracts", () => {
  it("accepts the strict bounded internal request", () => {
    expect(AiGatewayRequestSchema.safeParse(SYNTHETIC_AI_REQUEST).success).toBe(true);
    expect(JSON.parse(JSON.stringify(SYNTHETIC_AI_REQUEST))).toEqual(SYNTHETIC_AI_REQUEST);
  });

  it.each(["model", "instructions", "system_prompt", "tools", "store", "background", "previous_response_id"])(
    "rejects caller-controlled %s",
    (field) => expect(AiGatewayRequestSchema.safeParse({ ...SYNTHETIC_AI_REQUEST, [field]: "injected" }).success).toBe(false)
  );

  it("pins capability and locale enums", () => {
    expect(AI_CAPABILITY_IDS).toEqual([
      "PATIENT_CONVERSATION", "CLINICAL_INTERPRETER", "TUTOR", "ASSESSMENT_ANALYSIS", "CASE_DRAFTING"
    ]);
    expect(AiGatewayRequestSchema.safeParse({ ...SYNTHETIC_AI_REQUEST, capability_id: "GENERIC_PROMPT" }).success).toBe(false);
    expect(AiGatewayRequestSchema.safeParse({ ...SYNTHETIC_AI_REQUEST, locale: "en" }).success).toBe(false);
  });

  it("validates prompt IDs and all stable error categories", () => {
    expect(AiPromptIdSchema.safeParse("prompt.patient-v1").success).toBe(true);
    expect(AiPromptIdSchema.safeParse("patient prompt").success).toBe(false);
    expect(AI_GATEWAY_ERROR_CODES).toHaveLength(13);
  });

  it("keeps result envelopes strict and JSON-only", () => {
    expect(AiGatewayResultSchema.safeParse({
      gateway_schema_version: "1.0",
      success: false,
      error: { code: "AI_PROVIDER_NOT_CONFIGURED", message_key: "ai.error.ai-provider-not-configured", retryable: false }
    }).success).toBe(true);
    expect(AiGatewayResultSchema.safeParse({
      gateway_schema_version: "1.0",
      success: false,
      error: { code: "AI_PROVIDER_NOT_CONFIGURED", message_key: "ai.error.ai-provider-not-configured", retryable: false },
      raw_provider_response: {}
    }).success).toBe(false);
  });
});
