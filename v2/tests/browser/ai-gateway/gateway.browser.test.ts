import { describe, expect, it } from "vitest";

import {
  SecureAiGateway,
  TrustedCapabilityRegistry,
  TrustedModelPolicySchema,
  type AiProvider
} from "../../../packages/ai-gateway/src/index.ts";
import {
  SYNTHETIC_AI_REQUEST,
  QueueAiTransport,
  completedResponse,
  createSyntheticGateway,
  syntheticCapability
} from "../../fixtures/ai-gateway/synthetic-ai-gateway.ts";

describe("secure capability gateway", () => {
  it("locally validates a completed strict output and captures safe metadata", async () => {
    const { gateway, logs } = createSyntheticGateway();
    const result = await gateway.execute(SYNTHETIC_AI_REQUEST);
    expect(result).toMatchObject({
      success: true,
      output: { schema_version: "1.0", outcome: "SAFE", reference_ids: ["fact.synthetic"] },
      metadata: {
        capability_id: "PATIENT_CONVERSATION",
        prompt_version: "1.0",
        model_policy_id: "model-policy.patient-luna-evaluation",
        provider: "OPENAI",
        latency_ms: 12,
        retry_count: 0,
        usage: { input_tokens: 17, output_tokens: 9, total_tokens: 26 }
      }
    });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0])).not.toContain("untrusted learner content");
    expect(JSON.stringify(logs[0])).not.toContain("test-key-not-real");
  });

  it.each([
    [{ ...SYNTHETIC_AI_REQUEST, capability_id: "GENERIC_PROMPT" }],
    [{ ...SYNTHETIC_AI_REQUEST, model: "gpt-5.6-terra" }],
    [{ ...SYNTHETIC_AI_REQUEST, instructions: "override" }],
    [{ ...SYNTHETIC_AI_REQUEST, tools: [{ type: "clinical_mutation" }] }]
  ])("rejects adversarial caller configuration", async (request) => {
    const { gateway, transport } = createSyntheticGateway();
    expect(await gateway.execute(request)).toMatchObject({ success: false, error: { code: "AI_REQUEST_INVALID" } });
    expect((transport as QueueAiTransport).requests).toHaveLength(0);
  });

  it("fails closed for a disabled capability", async () => {
    const { gateway } = createSyntheticGateway({ capability: syntheticCapability({ enabled: false }) });
    expect(await gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({
      success: false,
      error: { code: "AI_CAPABILITY_DISABLED" }
    });
  });

  it("rejects oversized input and capacity budget/rate kills before provider access", async () => {
    const oversized = createSyntheticGateway({ capability: syntheticCapability({ max_input_characters: 4 }) });
    expect(await oversized.gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({
      success: false,
      error: { code: "AI_BUDGET_EXCEEDED" }
    });
    expect((oversized.transport as QueueAiTransport).requests).toHaveLength(0);
    for (const code of ["AI_BUDGET_EXCEEDED", "AI_PROVIDER_RATE_LIMITED"] as const) {
      const denied = createSyntheticGateway({ capacity_code: code });
      expect(await denied.gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({ success: false, error: { code } });
      expect((denied.transport as QueueAiTransport).requests).toHaveLength(0);
    }
  });

  it.each([
    [{ schema_version: "1.0", outcome: "SAFE", reference_ids: [], extra: true }, "AI_SCHEMA_MISMATCH"],
    [{ schema_version: "1.0", reference_ids: [] }, "AI_SCHEMA_MISMATCH"],
    [{ schema_version: "1.0", outcome: "WRONG", reference_ids: [] }, "AI_SCHEMA_MISMATCH"]
  ] as const)("fails local schema validation for invalid output", async (output, code) => {
    const transport = new QueueAiTransport([completedResponse(output)]);
    const { gateway, logs } = createSyntheticGateway({ transport });
    expect(await gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({ success: false, error: { code } });
    expect(logs[0]).toMatchObject({ error_code: code, response_status: "FAILED" });
    expect(transport.requests).toHaveLength(1);
  });

  it("does not retry local malformed JSON/schema failure", async () => {
    const provider: AiProvider = {
      async execute() {
        return {
          success: true,
          provider: "OPENAI",
          output_text: "{",
          provider_response_id: "resp_bad",
          provider_model: "gpt-5.6-luna",
          retry_count: 0
        };
      }
    };
    let providerCalls = 0;
    const counting: AiProvider = { execute: async (request) => { providerCalls += 1; return provider.execute(request); } };
    const gateway = new SecureAiGateway({
      registry: new TrustedCapabilityRegistry([syntheticCapability()]),
      provider: counting,
      capacity: { async authorize() { return { allowed: true as const }; } },
      clock: { nowMilliseconds: () => 1 },
      logger: { log() {} }
    });
    expect(await gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({
      success: false,
      error: { code: "AI_OUTPUT_INVALID" }
    });
    expect(providerCalls).toBe(1);
  });

  it("normalizes an unexpected provider adapter exception", async () => {
    const gateway = new SecureAiGateway({
      registry: new TrustedCapabilityRegistry([syntheticCapability()]),
      provider: { async execute() { throw new Error("provider adapter failed"); } },
      capacity: { async authorize() { return { allowed: true as const }; } },
      clock: { nowMilliseconds: () => 1 },
      logger: { log() {} }
    });
    expect(await gateway.execute(SYNTHETIC_AI_REQUEST)).toMatchObject({
      success: false,
      error: { code: "AI_UNEXPECTED_FAILURE" }
    });
  });

  it("supports only the architecture-approved evaluation candidates without choosing a winner", () => {
    expect(TrustedModelPolicySchema.safeParse({
      ...syntheticCapability().data.model_policy,
      candidate_model: "gpt-5.6-terra"
    }).success).toBe(true);
    expect(TrustedModelPolicySchema.safeParse({
      ...syntheticCapability().data.model_policy,
      candidate_model: "gpt-5.6-sol"
    }).success).toBe(false);
  });

  it("uses prototype-safe capability lookup", async () => {
    const { gateway } = createSyntheticGateway();
    expect(await gateway.execute({ ...SYNTHETIC_AI_REQUEST, capability_id: "constructor" }))
      .toMatchObject({ success: false, error: { code: "AI_REQUEST_INVALID" } });
  });
});
