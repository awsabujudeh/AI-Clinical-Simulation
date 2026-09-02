import {
  DIAGNOSTIC_PORTABILITY_EXPECTED,
  createDiagnosticPortabilitySnapshot
} from "../fixtures/cases/diagnostic-portability-fixture.ts";

Deno.test("diagnostic contracts and Case binding produce the exact Deno snapshot", async () => {
  const serialized = JSON.stringify(await createDiagnosticPortabilitySnapshot());
  console.info(`DENO_DIAGNOSTIC_OUTPUT=${serialized}`);
  if (serialized !== DIAGNOSTIC_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected diagnostic portability output: ${serialized}`);
  }
});
