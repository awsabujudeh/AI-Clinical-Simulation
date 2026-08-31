import {
  CLINICAL_ENGINE_PORTABILITY_EXPECTED,
  createClinicalEnginePortabilitySnapshot
} from "../fixtures/clinical-engine/clinical-engine-portability-fixture.ts";

Deno.test("Patient State projection produces the Deno snapshot", () => {
  const serialized = JSON.stringify(createClinicalEnginePortabilitySnapshot());

  console.info(`DENO_CLINICAL_ENGINE_OUTPUT=${serialized}`);

  if (serialized !== CLINICAL_ENGINE_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected Patient State projection output: ${serialized}`);
  }
});
