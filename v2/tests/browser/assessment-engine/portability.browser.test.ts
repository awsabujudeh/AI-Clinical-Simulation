import { expect, test } from "vitest";

import {
  V2_007A_ASSESSMENT_PORTABILITY_EXPECTED,
  createV2007APortabilitySnapshot
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("Assessment Engine produces the exact Browser portability snapshot", async () => {
  const serialized = JSON.stringify(await createV2007APortabilitySnapshot());
  console.info(`BROWSER_ASSESSMENT_OUTPUT=${serialized}`);
  expect(serialized).toBe(V2_007A_ASSESSMENT_PORTABILITY_EXPECTED);
});
