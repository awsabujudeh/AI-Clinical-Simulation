import { createAiGatewayPortabilitySnapshot } from "../fixtures/ai-gateway/synthetic-ai-gateway.ts";

const EXPECTED = "{\"gateway_schema_version\":\"1.0\",\"success\":true,\"request_id\":\"ai-request.v2-018.001\",\"correlation_id\":\"correlation.v2-018.001\",\"output\":{\"schema_version\":\"1.0\",\"outcome\":\"SAFE\",\"reference_ids\":[\"fact.synthetic\"]},\"metadata\":{\"capability_id\":\"PATIENT_CONVERSATION\",\"prompt_id\":\"prompt.patient-evaluation\",\"prompt_version\":\"1.0\",\"output_schema_id\":\"ai-schema.synthetic-gateway\",\"output_schema_version\":\"1.0\",\"model_policy_id\":\"model-policy.patient-luna-evaluation\",\"provider\":\"OPENAI\",\"provider_response_id\":\"resp_synthetic_001\",\"provider_model\":\"gpt-5.6-luna-2026-08-01\",\"response_status\":\"COMPLETED\",\"reasoning_effort\":\"low\",\"latency_ms\":12,\"retry_count\":0,\"usage\":{\"input_tokens\":17,\"output_tokens\":9,\"total_tokens\":26}}}";

Deno.test("V2-018 gateway imports and executes under Deno", async () => {
  const result = await createAiGatewayPortabilitySnapshot();
  if (!result.success) throw new Error(`Unexpected gateway failure: ${result.error.code}`);
});

Deno.test("V2-018 Browser/Deno serialized result is byte-identical", async () => {
  if (JSON.stringify(await createAiGatewayPortabilitySnapshot()) !== EXPECTED) {
    throw new Error("AI Gateway portability snapshot diverged.");
  }
});
