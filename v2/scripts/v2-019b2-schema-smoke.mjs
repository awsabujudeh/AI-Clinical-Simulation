import {
  OpenAiResponsesProvider,
  SecureAiGateway,
  TrustedCapabilityRegistry,
  fetchAiHttpTransport
} from "../packages/ai-gateway/src/index.ts";
import {
  createClinicalInterpreterCapability,
  reconcileClinicalInterpretation
} from "../packages/clinical-interpreter/src/index.ts";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";
import { CLINICAL_INTERPRETER_EVALUATION_CORPUS } from "../tests/fixtures/clinical-interpreter.ts";
import { interpreterEvaluationUserContent } from "../tests/fixtures/v2-019b2-evaluation.ts";

const MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"];
const smokeCase = CLINICAL_INTERPRETER_EVALUATION_CORPUS[0];

function stop(message) {
  console.error(message);
  process.exitCode = 2;
}

function gatewayFor(capability, apiKey, onResponse) {
  let tick = 0;
  const diagnosticTransport = {
    async send(request) {
      const response = await fetchAiHttpTransport.send(request);
      let body;
      try { body = JSON.parse(response.body); } catch { body = undefined; }
      onResponse({
        http_status: response.status,
        provider_status: typeof body?.status === "string" ? body.status : null,
        incomplete_reason: typeof body?.incomplete_details?.reason === "string"
          ? body.incomplete_details.reason
          : null,
        input_tokens: Number.isInteger(body?.usage?.input_tokens) ? body.usage.input_tokens : 0,
        output_tokens: Number.isInteger(body?.usage?.output_tokens) ? body.usage.output_tokens : 0,
        output_item_types: Array.isArray(body?.output)
          ? body.output.map((item) => typeof item?.type === "string" ? item.type : "UNKNOWN")
          : [],
        output_text_characters: Array.isArray(body?.output)
          ? body.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
            .reduce((sum, part) => sum + (typeof part?.text === "string" ? part.text.length : 0), 0)
          : 0
      });
      return response;
    }
  };
  return new SecureAiGateway({
    registry: new TrustedCapabilityRegistry([capability]),
    provider: new OpenAiResponsesProvider({
      api_key: apiKey,
      transport: diagnosticTransport
    }),
    capacity: { async authorize() { return { allowed: true }; } },
    clock: { nowMilliseconds() { tick += 1; return tick; } },
    logger: { log() {} }
  });
}

async function main() {
  if (process.env.V2_ALLOW_LIVE_AI_SCHEMA_SMOKE !== "1") {
    stop("V2-019B2 schema smoke refused: explicit live schema-smoke opt-in is required.");
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    stop("V2-019B2 — LIVE EVALUATION BLOCKED: OPENAI_API_KEY REQUIRED");
    return;
  }
  let failed = false;
  for (const model of MODELS) {
    const capability = createClinicalInterpreterCapability({
      enabled: true,
      candidate_model: model
    });
    let diagnostic = {};
    const result = await gatewayFor(capability, apiKey, (value) => { diagnostic = value; }).execute({
      gateway_schema_version: "1.0",
      request_id: `request.v2-019b2.schema-smoke.${model.endsWith("luna") ? "luna" : "terra"}`,
      correlation_id: `correlation.v2-019b2.schema-smoke.${model.endsWith("luna") ? "luna" : "terra"}`,
      capability_id: "CLINICAL_INTERPRETER",
      locale: smokeCase.locale,
      input: { user_content: interpreterEvaluationUserContent(smokeCase) }
    });
    if (!result.success) {
      console.error(JSON.stringify({
        status: "SCHEMA_COMPATIBILITY_SMOKE_FAILED",
        model,
        error_code: result.error.code,
        provider_http_status: result.error.provider_http_status ?? null,
        response_status: result.metadata?.response_status ?? null,
        input_tokens: result.metadata?.usage?.input_tokens ?? 0,
        output_tokens: result.metadata?.usage?.output_tokens ?? 0,
        transport: diagnostic
      }));
      failed = true;
      continue;
    }
    const reconciled = reconcileClinicalInterpretation({
      model_output: result.output,
      context: {
        context_schema_version: "1.0",
        locale: smokeCase.locale,
        learner_action_catalogue: smokeCase.learner_action_catalogue
      }
    });
    if (!reconciled.success) {
      console.error(JSON.stringify({
        status: "SCHEMA_COMPATIBILITY_LOCAL_PIPELINE_FAILED",
        model,
        error_code: reconciled.code
      }));
      failed = true;
      continue;
    }
    console.log(canonicalSerialize({
      status: "SCHEMA_COMPATIBILITY_SMOKE_ONLY_PASS",
      model,
      output_schema_version: capability.data.output.output_schema_version,
      reconciliation_status: reconciled.interpretation.status,
      input_tokens: result.metadata.usage?.input_tokens ?? 0,
      output_tokens: result.metadata.usage?.output_tokens ?? 0
    }));
  }
  if (failed) process.exitCode = 2;
}

await main();
