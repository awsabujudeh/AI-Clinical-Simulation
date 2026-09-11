import { describe, expect, it } from "vitest";
import trackedFreeze from "../../../evaluation/v2-019b2.freeze.json";

import {
  SubmitClinicalInterpretationRequestSchema,
  SubmitQuestionRequestSchema
} from "../../../packages/contracts/src/index.ts";
import {
  AI_MODEL_SELECTION_FREEZE_HASH,
  AiEvaluationFreezeArtifactSchema,
  AiEvaluationRunRecordSchema,
  SELECTED_AI_MODEL_POLICY,
  estimateEvaluationCostUsd
} from "../../../packages/ai-gateway/src/index.ts";
import {
  createSelectedClinicalInterpreterCapability,
  gradeClinicalInterpretation
} from "../../../packages/clinical-interpreter/src/index.ts";
import {
  createSelectedPatientConversationCapability,
  gradePatientConversationOutput
} from "../../../packages/patient-conversation/src/index.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import {
  CLINICAL_INTERPRETER_EVALUATION_CORPUS
} from "../../fixtures/clinical-interpreter.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import {
  createV2019B2FreezeArtifact,
  PATIENT_CONVERSATION_EVALUATION_CORPUS,
  projectedEvaluationCost,
  V2_019B2_CANDIDATES,
  V2_019B2_REPETITIONS
} from "../../fixtures/v2-019b2-evaluation.ts";

function validPatientOutput(index = 0) {
  const item = PATIENT_CONVERSATION_EVALUATION_CORPUS[index]!;
  return {
    output_schema_version: "1.0",
    utterance: item.locale === "ar-JO" ? "هاي إجابة اصطناعية مؤلفة." : "This is an authored synthetic answer.",
    locale: item.locale,
    answer_mode: item.expected.answer_mode,
    grounding_fact_ids: [...item.expected.required_fact_ids],
    grounding_state_refs: [...item.expected.required_state_refs],
    safety_flags: [...item.expected.required_safety_flags],
    disclosure_status: "WITHIN_PATIENT_BOUNDARY"
  };
}

describe("V2-019B2 frozen evaluation foundation", () => {
  it("pins the independent selected models to the completed evaluation freeze", () => {
    expect(AI_MODEL_SELECTION_FREEZE_HASH).toBe(
      "f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523"
    );
    expect(SELECTED_AI_MODEL_POLICY).toEqual({
      PATIENT_CONVERSATION: "gpt-5.6-terra",
      CLINICAL_INTERPRETER: "gpt-5.6-luna"
    });
    expect(
      createSelectedPatientConversationCapability({ enabled: true }).data.model_policy.candidate_model
    ).toBe("gpt-5.6-terra");
    expect(
      createSelectedClinicalInterpreterCapability({ enabled: true }).data.model_policy.candidate_model
    ).toBe("gpt-5.6-luna");
  });

  it("keeps model selection out of browser request authority", () => {
    expect(SubmitQuestionRequestSchema.safeParse({
      text: "How do you feel?",
      locale: "en-US",
      source: "TEXT",
      utterance_id: "utterance.model-policy.patient",
      model: "gpt-5.6-luna"
    }).success).toBe(false);
    expect(SubmitClinicalInterpretationRequestSchema.safeParse({
      text: "Perform the synthetic action",
      locale: "en-US",
      utterance_id: "utterance.model-policy.interpreter",
      model: "gpt-5.6-terra"
    }).success).toBe(false);
  });

  it("freezes only Luna and Terra, three repetitions, and 648 planned calls", async () => {
    const artifact = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
    expect(AiEvaluationFreezeArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(artifact.freeze.candidates).toEqual(V2_019B2_CANDIDATES);
    expect(artifact.freeze.repetitions_per_case).toBe(V2_019B2_REPETITIONS);
    expect(artifact.freeze.total_planned_requests).toBe(648);
    expect(artifact.freeze.maximum_concurrency).toBe(2);
    expect(artifact.freeze.case_order_policy).toBe("REPETITION_CAPABILITY_CASE_MODEL_PAIRED");
    expect(artifact.freeze.resume_policy).toBe("FREEZE_BOUND_COMPLETED_RECORDS_SKIP_EXACTLY");
    expect(artifact.freeze.result_normalization_version).toBe("1.0");
    expect(artifact.freeze.capabilities[0].authoritative_domain_schema_version).toBe("1.0");
    expect(artifact.freeze.capabilities[1].output_schema_version).toBe("2.0");
    expect(artifact.freeze.capabilities[1].authoritative_domain_schema_version).toBe("1.0");
  });

  it("produces the same canonical final freeze and digest repeatedly", async () => {
    const first = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
    const second = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
    expect(canonicalSerialize(first)).toBe(canonicalSerialize(second));
    expect(canonicalSerialize(first)).toBe(canonicalSerialize(trackedFreeze));
    expect(first.evaluation_freeze_hash).toBe("f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523");
    expect(first.evaluation_freeze_hash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("freezes 54 cases and 18 categories for each capability", async () => {
    const artifact = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
    expect(PATIENT_CONVERSATION_EVALUATION_CORPUS).toHaveLength(54);
    expect(new Set(PATIENT_CONVERSATION_EVALUATION_CORPUS.map((item) => item.category)).size).toBe(18);
    expect(new Set(PATIENT_CONVERSATION_EVALUATION_CORPUS.map((item) => item.locale))).toEqual(new Set(["ar-JO", "en-US"]));
    expect(CLINICAL_INTERPRETER_EVALUATION_CORPUS).toHaveLength(54);
    expect(new Set(CLINICAL_INTERPRETER_EVALUATION_CORPUS.map((item) => item.category)).size).toBe(18);
    expect(artifact.freeze.capabilities.every((item) => item.corpus_case_count === 54)).toBe(true);
  });

  it("uses a conservative projected maximum below the hard budget", async () => {
    const cost = projectedEvaluationCost();
    const artifact = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
    expect(cost.total_usd).toBeGreaterThan(0);
    expect(cost.total_usd).toBeLessThanOrEqual(5);
    expect(artifact.freeze.pricing.projected_maximum_usd).toBe(Number(cost.total_usd.toFixed(6)));
    expect(estimateEvaluationCostUsd({ model_id: "gpt-5.6-terra", input_tokens: 1_000, output_tokens: 1_000 }))
      .toBe(10 * estimateEvaluationCostUsd({ model_id: "gpt-5.6-luna", input_tokens: 1_000, output_tokens: 1_000 }));
  });

  it("grades grounded Patient output deterministically", () => {
    const evaluationCase = PATIENT_CONVERSATION_EVALUATION_CORPUS[0]!;
    const first = gradePatientConversationOutput({ evaluation_case: evaluationCase, output: validPatientOutput() });
    const second = gradePatientConversationOutput({ evaluation_case: evaluationCase, output: validPatientOutput() });
    expect(first).toEqual(second);
    expect(first.schema_valid).toBe(true);
    expect(first.local_validation_valid).toBe(true);
    expect(first.hard_safety_violations).toEqual([]);
  });

  it("fails Patient schema and local grounding independently", () => {
    const evaluationCase = PATIENT_CONVERSATION_EVALUATION_CORPUS[0]!;
    expect(gradePatientConversationOutput({ evaluation_case: evaluationCase, output: {} }).schema_valid).toBe(false);
    const output = { ...validPatientOutput(), grounding_fact_ids: ["fact.not-authorized"] };
    const grade = gradePatientConversationOutput({ evaluation_case: evaluationCase, output });
    expect(grade.schema_valid).toBe(true);
    expect(grade.local_validation_valid).toBe(false);
    expect(grade.hard_safety_violations).toContain("UNAUTHORIZED_GROUNDING_REFERENCE");
  });

  it("detects frozen sentinel disclosure phrases as hard Patient safety violations", () => {
    const evaluationCase = PATIENT_CONVERSATION_EVALUATION_CORPUS[0]!;
    const grade = gradePatientConversationOutput({
      evaluation_case: evaluationCase,
      output: { ...validPatientOutput(), utterance: "The synthetic concealed diagnosis omega is disclosed." }
    });
    expect(grade.hard_safety_violations).toEqual(["FORBIDDEN_DISCLOSURE"]);
  });

  it("preserves UNKNOWN mode and requested locale", () => {
    const index = PATIENT_CONVERSATION_EVALUATION_CORPUS.findIndex((item) => item.category === "UNKNOWN_FACT" && item.locale === "ar-JO");
    const evaluationCase = PATIENT_CONVERSATION_EVALUATION_CORPUS[index]!;
    const grade = gradePatientConversationOutput({ evaluation_case: evaluationCase, output: validPatientOutput(index) });
    expect(grade.metrics.find((item) => item.metric_code === "UNKNOWN_REMAINS_UNKNOWN")?.passed).toBe(true);
    expect(grade.metrics.find((item) => item.metric_code === "LOCALE_COMPLIANCE")?.passed).toBe(true);
  });

  it("grades the frozen Interpreter expected label exactly", () => {
    const evaluationCase = CLINICAL_INTERPRETER_EVALUATION_CORPUS[0]!;
    const grade = gradeClinicalInterpretation({
      evaluation_case: evaluationCase,
      interpretation: evaluationCase.expected_interpretation
    });
    expect(grade.schema_valid).toBe(true);
    expect(grade.local_validation_valid).toBe(true);
    expect(grade.hard_safety_violations).toEqual([]);
    expect(grade.metrics.every((metric) => metric.passed)).toBe(true);
  });

  it("marks affirmative negated intent as a hard Interpreter violation", () => {
    const evaluationCase = CLINICAL_INTERPRETER_EVALUATION_CORPUS.find((item) => item.category === "NEGATION")!;
    const affirmative = CLINICAL_INTERPRETER_EVALUATION_CORPUS.find((item) => item.expected_interpretation.status === "MATCH")!.expected_interpretation;
    const grade = gradeClinicalInterpretation({ evaluation_case: evaluationCase, interpretation: affirmative });
    expect(grade.hard_safety_violations).toContain("NEGATION_EXECUTION_INTENT");
  });

  it("does not misclassify a reliability omission as medical correction", () => {
    const evaluationCase = CLINICAL_INTERPRETER_EVALUATION_CORPUS.find((item) => item.category === "WRONG_VALUE_PRESERVATION")!;
    const grade = gradeClinicalInterpretation({
      evaluation_case: evaluationCase,
      interpretation: {
        interpretation_schema_version: "1.0",
        authority: "NON_AUTHORITATIVE",
        status: "NO_MATCH",
        no_match_reason: "NO_ACTIONABLE_COMMAND"
      }
    });
    expect(grade.hard_safety_violations).not.toContain("LEARNER_VALUE_MEDICALLY_CORRECTED");
    expect(grade.metrics.find((metric) => metric.metric_code === "STATUS_ACCURACY")?.passed).toBe(false);
  });

  it("validates normalized records and rejects unknown fields", () => {
    const record = {
      evaluation_schema_version: "1.0",
      evaluation_run_id: "v2-019b2.patient.case-001.luna.1",
      evaluation_freeze_hash: "a".repeat(64),
      capability: "PATIENT_CONVERSATION",
      evaluation_case_id: "patient-eval.case-001",
      repetition_index: 1,
      model_id: "gpt-5.6-luna",
      prompt_id: "prompt.patient-conversation",
      prompt_version: "1.0",
      output_schema_id: "ai-schema.patient-conversation",
      output_schema_version: "1.0",
      provider_outcome: "COMPLETED",
      schema_valid: true,
      local_validation_valid: true,
      hard_safety_violations: [],
      metrics: [{ metric_code: "SCHEMA_SUCCESS", passed: true }],
      latency_ms: 1,
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      output_hash: "b".repeat(64)
    };
    expect(AiEvaluationRunRecordSchema.parse(record)).toEqual(record);
    expect(AiEvaluationRunRecordSchema.safeParse({ ...record, raw_provider_response: "forbidden" }).success).toBe(false);
  });
});
