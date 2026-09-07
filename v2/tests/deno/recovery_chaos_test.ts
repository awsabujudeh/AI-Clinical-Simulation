import {
  V2_014B_CHAOS_PORTABILITY_EXPECTED,
  createV2014bChaosPortabilitySnapshot
} from "../fixtures/recovery/deterministic-chaos.ts";

Deno.test("V2-014B deterministic chaos phases serialize identically", async () => {
  const first = JSON.stringify(await createV2014bChaosPortabilitySnapshot());
  const second = JSON.stringify(await createV2014bChaosPortabilitySnapshot());

  if (first !== V2_014B_CHAOS_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected chaos snapshot: ${first}`);
  }
  if (second !== first) {
    throw new Error("Repeated chaos execution was not byte-identical.");
  }
});
