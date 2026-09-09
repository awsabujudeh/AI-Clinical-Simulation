import {
  AI_GATEWAY_SCHEMA_VERSION,
  AiGatewayResultSchema,
  CorrelationIdSchema,
  PatientLanguageSchema,
  RequestIdSchema,
  type AiGatewaySafeMetadata,
  type ClinicalInterpretation,
  type ClinicalInterpreterContext
} from "@ai-clinical-simulation/contracts";
import type { SecureAiGateway } from "@ai-clinical-simulation/ai-gateway";
import { canonicalSerialize } from "@ai-clinical-simulation/case-schema";

import { CLINICAL_INTERPRETER_CAPABILITY_ID } from "./capability.ts";
import { reconcileClinicalInterpretation } from "./reconcile.ts";

export type ClinicalInterpreterWorkflowIssueCode =
  | "INTERPRETER_REQUEST_INVALID"
  | "INTERPRETER_GATEWAY_UNAVAILABLE"
  | "INTERPRETER_OUTPUT_INVALID"
  | "INTERPRETER_PARAMETER_INVALID";

export type ClinicalInterpreterWorkflowResult =
  | Readonly<{
      success: true;
      interpretation: ClinicalInterpretation;
      metadata: AiGatewaySafeMetadata;
    }>
  | Readonly<{
      success: false;
      code: ClinicalInterpreterWorkflowIssueCode;
    }>;

export async function executeClinicalInterpreter(input: {
  gateway: SecureAiGateway;
  request_id: unknown;
  correlation_id: unknown;
  utterance: unknown;
  locale: unknown;
  context: ClinicalInterpreterContext;
}): Promise<ClinicalInterpreterWorkflowResult> {
  const requestId = RequestIdSchema.safeParse(input.request_id);
  const correlationId = CorrelationIdSchema.safeParse(input.correlation_id);
  const locale = PatientLanguageSchema.safeParse(input.locale);
  const utterance = typeof input.utterance === "string"
    ? input.utterance.trim()
    : "";
  if (!requestId.success || !correlationId.success || !locale.success
    || locale.data !== input.context.locale
    || utterance.length === 0 || utterance.length > 4_000) {
    return Object.freeze({ success: false, code: "INTERPRETER_REQUEST_INVALID" });
  }
  const userContent = canonicalSerialize({
    trusted_interpreter_context: input.context,
    untrusted_learner_utterance: {
      locale: locale.data,
      text: utterance
    }
  });
  const gatewayResult = AiGatewayResultSchema.parse(await input.gateway.execute({
    gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
    request_id: requestId.data,
    correlation_id: correlationId.data,
    capability_id: CLINICAL_INTERPRETER_CAPABILITY_ID,
    locale: locale.data,
    input: { user_content: userContent }
  }));
  if (!gatewayResult.success) {
    return Object.freeze({
      success: false,
      code: gatewayResult.error.code === "AI_OUTPUT_INVALID"
        || gatewayResult.error.code === "AI_SCHEMA_MISMATCH"
        ? "INTERPRETER_OUTPUT_INVALID"
        : "INTERPRETER_GATEWAY_UNAVAILABLE"
    });
  }
  const reconciled = reconcileClinicalInterpretation({
    model_output: gatewayResult.output,
    context: input.context
  });
  return reconciled.success
    ? Object.freeze({
        success: true,
        interpretation: reconciled.interpretation,
        metadata: gatewayResult.metadata
      })
    : Object.freeze({ success: false, code: reconciled.code });
}
