import { expect, test } from "vitest";

import {
  CONTRACT_PORTABILITY_EXPECTED,
  createContractPortabilitySnapshot
} from "../fixtures/contracts-fixture.ts";

test("shared contract source produces the browser contract output", () => {
  const serialized = JSON.stringify(createContractPortabilitySnapshot());

  console.info(`BROWSER_CONTRACT_OUTPUT=${serialized}`);
  expect(serialized).toBe(CONTRACT_PORTABILITY_EXPECTED);
});
