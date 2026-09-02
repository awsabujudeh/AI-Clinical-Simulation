import { expect, test } from "vitest";

import {
  V2_007B_ASSESSMENT_PORTABILITY_EXPECTED,
  createV2007BPortabilitySnapshot
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("Assessment finalization and disclosure produce the exact Browser snapshot", async () => {
  const serialized = JSON.stringify(await createV2007BPortabilitySnapshot());
  console.info(`BROWSER_ASSESSMENT_DISCLOSURE_OUTPUT=${serialized}`);
  expect(serialized).toBe(V2_007B_ASSESSMENT_PORTABILITY_EXPECTED);
});
