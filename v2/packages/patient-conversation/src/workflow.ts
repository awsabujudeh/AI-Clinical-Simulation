import {
  AI_GATEWAY_SCHEMA_VERSION,
  AiGatewayResultSchema,
  CorrelationIdSchema,
  PatientAgentOutputSchema,
  PatientLanguageSchema,
  RequestIdSchema,
  type AiGatewaySafeMetadata,
  type PatientAgentOutput,
  type PatientConversationContext
} from "@ai-clinical-simulation/contracts";
import type { SecureAiGateway } from "@ai-clinical-simulation/ai-gateway";
import { canonicalSerialize } from "@ai-clinical-simulation/case-schema";

import { PATIENT_CONVERSATION_CAPABILITY_ID } from "./capability.ts";

export type PatientConversationWorkflowIssueCode =
  | "PATIENT_REQUEST_INVALID"
  | "PATIENT_GATEWAY_UNAVAILABLE"
  | "PATIENT_OUTPUT_INVALID"
  | "PATIENT_GROUNDING_INVALID";

export type PatientConversationWorkflowResult = Readonly<{
  success: true;
  output: PatientAgentOutput;
  metadata: AiGatewaySafeMetadata;
}> | Readonly<{
  success: false;
  code: PatientConversationWorkflowIssueCode;
  fallback_output: Readonly<{
    utterance: string;
    locale: "ar-JO" | "en-US";
    answer_mode: "FALLBACK";
    grounding_fact_ids: readonly [];
    grounding_state_refs: readonly [];
  }>;
}>;

function fallback(
  context: PatientConversationContext,
  code: PatientConversationWorkflowIssueCode
): PatientConversationWorkflowResult {
  return Object.freeze({
    success: false,
    code,
    fallback_output: Object.freeze({
      utterance: context.deterministic_fallback_text,
      locale: context.locale,
      answer_mode: "FALLBACK",
      grounding_fact_ids: Object.freeze([]) as readonly [],
      grounding_state_refs: Object.freeze([]) as readonly []
    })
  });
}

export async function executePatientConversation(input: {
  gateway: SecureAiGateway;
  request_id: unknown;
  correlation_id: unknown;
  question: unknown;
  locale: unknown;
  context: PatientConversationContext;
}): Promise<PatientConversationWorkflowResult> {
  const requestId = RequestIdSchema.safeParse(input.request_id);
  const correlationId = CorrelationIdSchema.safeParse(input.correlation_id);
  const locale = PatientLanguageSchema.safeParse(input.locale);
  const question = typeof input.question === "string"
    ? input.question.trim()
    : "";
  if (!requestId.success || !correlationId.success || !locale.success
    || locale.data !== input.context.locale || question.length === 0 || question.length > 4_000) {
    return fallback(input.context, "PATIENT_REQUEST_INVALID");
  }

  const userContent = canonicalSerialize({
    trusted_patient_context: input.context,
    untrusted_learner_question: {
      locale: locale.data,
      text: question
    }
  });
  const gatewayResult = AiGatewayResultSchema.parse(await input.gateway.execute({
    gateway_schema_version: AI_GATEWAY_SCHEMA_VERSION,
    request_id: requestId.data,
    correlation_id: correlationId.data,
    capability_id: PATIENT_CONVERSATION_CAPABILITY_ID,
    locale: locale.data,
    input: { user_content: userContent }
  }));
  if (!gatewayResult.success) {
    return fallback(input.context, "PATIENT_GATEWAY_UNAVAILABLE");
  }
  const output = PatientAgentOutputSchema.safeParse(gatewayResult.output);
  if (!output.success || output.data.locale !== input.context.locale) {
    return fallback(input.context, "PATIENT_OUTPUT_INVALID");
  }
  const allowedFacts = new Set(input.context.facts.map((fact) => fact.fact_id));
  const allowedManifestations = new Set(
    input.context.current_manifestations.map((manifestation) => manifestation.manifestation_id)
  );
  const refsValid = output.data.grounding_fact_ids.every((id) => allowedFacts.has(id))
    && output.data.grounding_state_refs.every((id) => allowedManifestations.has(id));
  const refsUnique = new Set(output.data.grounding_fact_ids).size === output.data.grounding_fact_ids.length
    && new Set(output.data.grounding_state_refs).size === output.data.grounding_state_refs.length;
  const groundedHasEvidence = output.data.answer_mode !== "GROUNDED"
    || output.data.grounding_fact_ids.length + output.data.grounding_state_refs.length > 0;
  const unknownHasNoClaims = output.data.answer_mode !== "UNKNOWN"
    || output.data.grounding_fact_ids.length + output.data.grounding_state_refs.length === 0;
  if (!refsValid || !refsUnique || !groundedHasEvidence || !unknownHasNoClaims) {
    return fallback(input.context, "PATIENT_GROUNDING_INVALID");
  }
  return Object.freeze({ success: true, output: output.data, metadata: gatewayResult.metadata });
}
