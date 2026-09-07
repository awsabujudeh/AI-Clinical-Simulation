import {
  V2_016_ACTION_PORTABILITY_EXPECTED,
  createV2016ActionPortabilitySnapshot
} from "../fixtures/student-ui/action-portability.ts";

Deno.test("V2-016 safe action contracts serialize identically in Deno", () => {
  const first = JSON.stringify(createV2016ActionPortabilitySnapshot());
  const second = JSON.stringify(createV2016ActionPortabilitySnapshot());
  if (first !== V2_016_ACTION_PORTABILITY_EXPECTED || second !== first) {
    throw new Error("V2-016 Browser/Deno action contract snapshot diverged.");
  }
});
