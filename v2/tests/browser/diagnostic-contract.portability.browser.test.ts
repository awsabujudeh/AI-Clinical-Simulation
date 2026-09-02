import { expect, test } from "vitest";

import {
  DIAGNOSTIC_PORTABILITY_EXPECTED,
  createDiagnosticPortabilitySnapshot
} from "../fixtures/cases/diagnostic-portability-fixture.ts";

test("diagnostic contracts and Case binding produce the exact Browser snapshot", async () => {
  const serialized = JSON.stringify(await createDiagnosticPortabilitySnapshot());
  console.info(`BROWSER_DIAGNOSTIC_OUTPUT=${serialized}`);
  expect(serialized).toBe(DIAGNOSTIC_PORTABILITY_EXPECTED);
});
