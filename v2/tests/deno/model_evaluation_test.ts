import { canonicalSerialize } from "../../packages/case-schema/src/index.ts";
import {
  AI_MODEL_SELECTION_FREEZE_HASH,
  SELECTED_AI_MODEL_POLICY
} from "../../packages/ai-gateway/src/index.ts";
import { gradePatientConversationOutput } from "../../packages/patient-conversation/src/index.ts";
import { PORTABLE_SHA256_ADAPTER } from "../fixtures/portable-sha256.ts";
import {
  createV2019B2FreezeArtifact,
  PATIENT_CONVERSATION_EVALUATION_CORPUS
} from "../fixtures/v2-019b2-evaluation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("V2-019B2 freeze is deterministic in the project-local Deno runtime", async () => {
  const first = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
  const second = await createV2019B2FreezeArtifact(PORTABLE_SHA256_ADAPTER);
  assert(canonicalSerialize(first) === canonicalSerialize(second), "Freeze artifacts must match exactly.");
  assert(first.evaluation_freeze_hash === "f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523", "Deno must reproduce the final tracked freeze hash.");
  assert(first.freeze.total_planned_requests === 648, "Expected the frozen request count.");
  assert(first.freeze.maximum_concurrency === 2, "Expected conservative concurrency.");
});

Deno.test("V2-019B2 Patient grading is portable and deterministic", () => {
  const evaluationCase = PATIENT_CONVERSATION_EVALUATION_CORPUS[0]!;
  const output = {
    output_schema_version: "1.0",
    utterance: "This is an authored synthetic answer.",
    locale: evaluationCase.locale,
    answer_mode: evaluationCase.expected.answer_mode,
    grounding_fact_ids: [...evaluationCase.expected.required_fact_ids],
    grounding_state_refs: [...evaluationCase.expected.required_state_refs],
    safety_flags: [...evaluationCase.expected.required_safety_flags],
    disclosure_status: "WITHIN_PATIENT_BOUNDARY"
  };
  const first = gradePatientConversationOutput({ evaluation_case: evaluationCase, output });
  const second = gradePatientConversationOutput({ evaluation_case: evaluationCase, output });
  assert(canonicalSerialize(first) === canonicalSerialize(second), "Grades must match exactly.");
  assert(first.local_validation_valid, "Expected a locally valid synthetic output.");
});

Deno.test("V2-019B2 selected policy is capability-specific and freeze-bound", () => {
  assert(
    AI_MODEL_SELECTION_FREEZE_HASH === "f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523",
    "Expected the final evaluation freeze."
  );
  assert(
    SELECTED_AI_MODEL_POLICY.PATIENT_CONVERSATION === "gpt-5.6-terra",
    "Patient Conversation must select Terra."
  );
  assert(
    SELECTED_AI_MODEL_POLICY.CLINICAL_INTERPRETER === "gpt-5.6-luna",
    "Clinical Interpreter must select Luna."
  );
});
