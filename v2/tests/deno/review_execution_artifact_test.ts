import {
  REVIEW_EXECUTION_PORTABILITY_EXPECTED,
  createReviewExecutionPortabilitySnapshot
} from "../fixtures/cases/review-execution-portability-fixture.ts";

Deno.test("ReviewExecutionArtifact produces the exact Deno portability snapshot", async () => {
  const actual = await createReviewExecutionPortabilitySnapshot();
  if (actual !== REVIEW_EXECUTION_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected ReviewExecutionArtifact snapshot: ${actual}`);
  }
});
