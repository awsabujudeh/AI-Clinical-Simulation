import {
  CASE_SCHEMA_PORTABILITY_EXPECTED,
  createCaseSchemaPortabilitySnapshot
} from "../fixtures/cases/case-schema-portability-fixture.ts";

Deno.test("Case Schema validation and compilation produce the Deno snapshot", async () => {
  const serialized = JSON.stringify(await createCaseSchemaPortabilitySnapshot());

  console.info(`DENO_CASE_SCHEMA_OUTPUT=${serialized}`);

  if (serialized !== CASE_SCHEMA_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected Case Schema portability output: ${serialized}`);
  }
});
