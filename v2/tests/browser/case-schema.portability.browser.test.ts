import { expect, test } from "vitest";

import {
  CASE_SCHEMA_PORTABILITY_EXPECTED,
  createCaseSchemaPortabilitySnapshot
} from "../fixtures/cases/case-schema-portability-fixture.ts";

test("Case Schema validation and compilation produce the Browser snapshot", async () => {
  const serialized = JSON.stringify(await createCaseSchemaPortabilitySnapshot());

  console.info(`BROWSER_CASE_SCHEMA_OUTPUT=${serialized}`);
  expect(serialized).toBe(CASE_SCHEMA_PORTABILITY_EXPECTED);
});
