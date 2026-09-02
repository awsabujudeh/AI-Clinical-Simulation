import {
  V2_007A_ASSESSMENT_PORTABILITY_EXPECTED,
  V2_007B_ASSESSMENT_PORTABILITY_EXPECTED,
  createV2007BPortabilitySnapshot,
  createV2007APortabilitySnapshot
} from "../fixtures/assessment-engine/synthetic-assessment.ts";

Deno.test("Assessment Engine produces the exact Deno portability snapshot", async () => {
  const serialized = JSON.stringify(await createV2007APortabilitySnapshot());
  console.info(`DENO_ASSESSMENT_OUTPUT=${serialized}`);
  if (serialized !== V2_007A_ASSESSMENT_PORTABILITY_EXPECTED) {
    throw new Error("Deno Assessment Engine output differs from the approved snapshot.");
  }
});

Deno.test("Assessment finalization and disclosure produce the exact Deno snapshot", async () => {
  const serialized = JSON.stringify(await createV2007BPortabilitySnapshot());
  console.info(`DENO_ASSESSMENT_DISCLOSURE_OUTPUT=${serialized}`);
  if (serialized !== V2_007B_ASSESSMENT_PORTABILITY_EXPECTED) {
    throw new Error("Deno Assessment disclosure output differs from the approved snapshot.");
  }
});
