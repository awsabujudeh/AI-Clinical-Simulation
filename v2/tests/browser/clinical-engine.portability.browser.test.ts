import { expect, test } from "vitest";

import {
  CLINICAL_ENGINE_PORTABILITY_EXPECTED,
  V2_005_TRANSITION_PORTABILITY_EXPECTED,
  createClinicalEnginePortabilitySnapshot,
  createV2005TransitionPortabilityFingerprint
} from "../fixtures/clinical-engine/clinical-engine-portability-fixture.ts";

test("Patient State projection produces the Browser snapshot", () => {
  const serialized = JSON.stringify(createClinicalEnginePortabilitySnapshot());

  console.info(`BROWSER_CLINICAL_ENGINE_OUTPUT=${serialized}`);
  expect(serialized).toBe(CLINICAL_ENGINE_PORTABILITY_EXPECTED);
});

test("V2-005 transition pipeline produces the exact Browser serialization fingerprint", async () => {
  const result = await createV2005TransitionPortabilityFingerprint();
  console.info(`BROWSER_V2_005_OUTPUT=${result.serialized}`);
  expect({ byte_length: result.byte_length, fingerprint: result.fingerprint }).toEqual(
    V2_005_TRANSITION_PORTABILITY_EXPECTED
  );
});
