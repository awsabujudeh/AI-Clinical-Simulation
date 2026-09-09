import {
  SecureAiGateway,
  TrustedCapabilityRegistry,
  type AiProvider
} from "../../packages/ai-gateway/src/index.ts";
import {
  buildClinicalInterpreterContext,
  createClinicalInterpreterCapability,
  executeClinicalInterpreter
} from "../../packages/clinical-interpreter/src/index.ts";
import { canonicalSerialize } from "../../packages/case-schema/src/index.ts";
import {
  CLINICAL_INTERPRETER_EVALUATION_CORPUS,
  SYNTHETIC_INTERPRETER_CATALOGUE,
  modelMatch
} from "../fixtures/clinical-interpreter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("V2-019B1 clinical interpreter uses identical portable source and output", async () => {
  const safeContext = buildClinicalInterpreterContext({
    locale: "en-US",
    learner_action_catalogue: SYNTHETIC_INTERPRETER_CATALOGUE
  });
  assert(safeContext.success, "Expected a valid safe interpreter context.");
  const provider: AiProvider = {
    async execute() {
      return {
        success: true,
        provider: "OPENAI",
        output_text: JSON.stringify(modelMatch({ parameters: { dose: 300, unit: "mg" } })),
        provider_response_id: "response.interpreter.deno",
        provider_model: "gpt-5.6-luna",
        retry_count: 0
      };
    }
  };
  const result = await executeClinicalInterpreter({
    gateway: new SecureAiGateway({
      registry: new TrustedCapabilityRegistry([
        createClinicalInterpreterCapability({ enabled: true, candidate_model: "gpt-5.6-luna" })
      ]),
      provider,
      capacity: { async authorize() { return { allowed: true as const }; } },
      clock: { nowMilliseconds: () => 1 },
      logger: { log() {} }
    }),
    request_id: "request.interpreter.deno",
    correlation_id: "correlation.interpreter.deno",
    utterance: "Give medicine A 300 mg",
    locale: "en-US",
    context: safeContext.context
  });
  assert(result.success, "Expected a successful interpretation.");
  assert(
    canonicalSerialize(result.interpretation) === '{"authority":"NON_AUTHORITATIVE","candidate":{"action_id":"medication.synthetic-alpha","confirmation_policy":"EXPLICIT_ADMINISTRATION","parameters":{"dose":300,"unit":"mg"},"unresolved_required_parameters":[]},"interpretation_schema_version":"1.0","status":"MATCH"}',
    "Browser and Deno canonical outputs must match exactly."
  );
  assert(CLINICAL_INTERPRETER_EVALUATION_CORPUS.length === 54, "Expected the B2 corpus foundation.");
});

Deno.test("V2-019B1 unlisted action fails closed without a candidate", async () => {
  const safeContext = buildClinicalInterpreterContext({ locale: "ar-JO", learner_action_catalogue: SYNTHETIC_INTERPRETER_CATALOGUE });
  assert(safeContext.success, "Expected context.");
  const provider: AiProvider = { async execute() { return { success: true, provider: "OPENAI", output_text: JSON.stringify(modelMatch({ action_id: "procedure.hidden-action" })), provider_response_id: "response.interpreter.unlisted", provider_model: "gpt-5.6-terra", retry_count: 0 }; } };
  const result = await executeClinicalInterpreter({ gateway: new SecureAiGateway({ registry: new TrustedCapabilityRegistry([createClinicalInterpreterCapability({ enabled: true, candidate_model: "gpt-5.6-terra" })]), provider, capacity: { async authorize() { return { allowed: true as const }; } }, clock: { nowMilliseconds: () => 1 }, logger: { log() {} } }), request_id: "request.interpreter.unlisted", correlation_id: "correlation.interpreter.unlisted", utterance: "نفذ الإجراء المخفي", locale: "ar-JO", context: safeContext.context });
  assert(result.success && result.interpretation.status === "NO_MATCH", "Unlisted actions must become NO_MATCH.");
});
