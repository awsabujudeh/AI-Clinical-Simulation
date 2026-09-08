import { describe, expect, it } from "vitest";

import {
  V2_017_PORTABILITY_EXPECTED,
  createV2017PortabilitySnapshot
} from "../fixtures/student-ui/v2-017-portability.ts";

describe("V2-017 Browser portability", () => {
  it("serializes the safe timeline and final Assessment contracts exactly", () => {
    expect(JSON.stringify(createV2017PortabilitySnapshot())).toBe(V2_017_PORTABILITY_EXPECTED);
  });
});
