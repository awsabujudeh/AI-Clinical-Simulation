import {
  PatientAgentOutputSchema,
  PatientConversationContextSchema
} from "../../packages/contracts/src/index.ts";
import {
  buildPatientConversationContext,
  createPatientConversationCapability
} from "../../packages/patient-conversation/src/index.ts";
import {
  createPatientConversationCase,
  createPatientConversationState
} from "../fixtures/patient-conversation.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function assertFalse(value: unknown) {
  if (value !== false) throw new Error(`Expected false, received ${JSON.stringify(value)}.`);
}

Deno.test("V2-019A Deno uses the shared strict patient contracts", () => {
  assertEquals(PatientAgentOutputSchema.safeParse({
    output_schema_version: "1.0",
    utterance: "I do not know.",
    locale: "en-US",
    answer_mode: "UNKNOWN",
    grounding_fact_ids: [],
    grounding_state_refs: [],
    safety_flags: [],
    disclosure_status: "WITHIN_PATIENT_BOUNDARY"
  }).success, true);
  assertFalse(PatientAgentOutputSchema.safeParse({
    output_schema_version: "1.0",
    utterance: "x",
    locale: "en",
    answer_mode: "UNKNOWN",
    grounding_fact_ids: [],
    grounding_state_refs: [],
    safety_flags: [],
    disclosure_status: "WITHIN_PATIENT_BOUNDARY"
  }).success);
});

Deno.test("V2-019A Deno safe context is byte-deterministic and minimized", () => {
  const build = () => buildPatientConversationContext({
    case_package: createPatientConversationCase(),
    patient_state: createPatientConversationState(6),
    locale: "en-US",
    history: []
  });
  const first = build();
  const second = build();
  assertEquals(first.success, true);
  assertEquals(JSON.stringify(first), JSON.stringify(second));
  assertFalse(JSON.stringify(first).includes("assessment_rubric"));
  assertFalse(JSON.stringify(first).includes("hemodynamic_state"));
  if (first.success) assertEquals(PatientConversationContextSchema.parse(first.context), first.context);
});

Deno.test("V2-019A Deno projects the same truth identities for ar-JO and en-US", () => {
  const values = ["ar-JO", "en-US"].map((locale) => buildPatientConversationContext({
    case_package: createPatientConversationCase(),
    patient_state: createPatientConversationState(),
    locale,
    history: []
  }));
  if (!values[0]?.success || !values[1]?.success) throw new Error("Context fixture failed.");
  assertEquals(
    values[0].context.facts.map((fact) => [fact.fact_id, fact.truth_status]),
    values[1].context.facts.map((fact) => [fact.fact_id, fact.truth_status])
  );
});

Deno.test("V2-019A Deno capability remains tool-free and candidate-configured", () => {
  const capability = createPatientConversationCapability({ enabled: true, candidate_model: "gpt-5.6-terra" });
  assertEquals(capability.data.tools, []);
  assertEquals(capability.data.model_policy.candidate_model, "gpt-5.6-terra");
  assertEquals(capability.data.prompt.prompt_version, "1.0");
});
