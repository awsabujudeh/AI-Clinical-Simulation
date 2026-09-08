import {
  V2_017_PORTABILITY_EXPECTED,
  createV2017PortabilitySnapshot
} from "../fixtures/student-ui/v2-017-portability.ts";

Deno.test("V2-017 safe timeline and Assessment contracts serialize identically in Deno", () => {
  const serialized = JSON.stringify(createV2017PortabilitySnapshot());
  if (serialized !== V2_017_PORTABILITY_EXPECTED) {
    throw new Error("V2-017 Browser/Deno safe projection snapshot diverged.");
  }
});
