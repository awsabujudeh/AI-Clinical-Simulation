import { expect, it } from "vitest";

import {
  V2_016_ACTION_PORTABILITY_EXPECTED,
  createV2016ActionPortabilitySnapshot
} from "../../fixtures/student-ui/action-portability.ts";

it("V2-016 safe action contracts serialize identically in Browser", () => {
  expect(JSON.stringify(createV2016ActionPortabilitySnapshot()))
    .toBe(V2_016_ACTION_PORTABILITY_EXPECTED);
});
