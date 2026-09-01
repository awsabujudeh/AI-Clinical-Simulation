import {
  CLINICAL_ENGINE_PORTABILITY_EXPECTED,
  V2_005_TRANSITION_PORTABILITY_EXPECTED,
  createClinicalEnginePortabilitySnapshot,
  createV2005TransitionPortabilityFingerprint
} from "../fixtures/clinical-engine/clinical-engine-portability-fixture.ts";

Deno.test("Patient State projection produces the Deno snapshot", () => {
  const serialized = JSON.stringify(createClinicalEnginePortabilitySnapshot());

  console.info(`DENO_CLINICAL_ENGINE_OUTPUT=${serialized}`);

  if (serialized !== CLINICAL_ENGINE_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected Patient State projection output: ${serialized}`);
  }
});

Deno.test("V2-005 transition pipeline produces the exact Deno serialization fingerprint", async () => {
  const result = await createV2005TransitionPortabilityFingerprint();
  console.info(`DENO_V2_005_OUTPUT=${result.serialized}`);

  if (
    result.byte_length !== V2_005_TRANSITION_PORTABILITY_EXPECTED.byte_length
    || result.fingerprint !== V2_005_TRANSITION_PORTABILITY_EXPECTED.fingerprint
  ) {
    throw new Error(
      `Unexpected V2-005 transition output fingerprint: ${result.byte_length}/${result.fingerprint}`
    );
  }
});
