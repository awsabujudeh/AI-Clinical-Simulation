import { expect, test } from "vitest";

import {
  CLINICAL_ENGINE_PORTABILITY_EXPECTED,
  createClinicalEnginePortabilitySnapshot
} from "../fixtures/clinical-engine/clinical-engine-portability-fixture.ts";

test("Patient State projection produces the Browser snapshot", () => {
  const serialized = JSON.stringify(createClinicalEnginePortabilitySnapshot());

  console.info(`BROWSER_CLINICAL_ENGINE_OUTPUT=${serialized}`);
  expect(serialized).toBe(CLINICAL_ENGINE_PORTABILITY_EXPECTED);
});
