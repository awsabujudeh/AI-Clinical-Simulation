import { expect, test } from "vitest";

import {
  REVIEW_EXECUTION_PORTABILITY_EXPECTED,
  createReviewExecutionPortabilitySnapshot
} from "../fixtures/cases/review-execution-portability-fixture.ts";

test("ReviewExecutionArtifact produces the exact Browser portability snapshot", async () => {
  expect(await createReviewExecutionPortabilitySnapshot())
    .toBe(REVIEW_EXECUTION_PORTABILITY_EXPECTED);
});
