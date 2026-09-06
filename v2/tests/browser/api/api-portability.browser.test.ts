import { expect, it } from "vitest";

import {
  V2_013_API_PORTABILITY_EXPECTED,
  createV2013ApiPortabilitySnapshot
} from "../../fixtures/api/secure-api.ts";

it("produces the exact deterministic V2-013 API snapshot in the Browser runtime", async () => {
  const snapshot = await createV2013ApiPortabilitySnapshot();
  expect(JSON.stringify(snapshot)).toBe(V2_013_API_PORTABILITY_EXPECTED);
});
