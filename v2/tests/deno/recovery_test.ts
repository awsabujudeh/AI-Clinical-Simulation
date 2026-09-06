import {
  V2_014A_PORTABILITY_EXPECTED,
  createV2014aPortabilitySnapshot
} from "../fixtures/recovery/synthetic-recovery.ts";

Deno.test("V2-014A recovery core produces exact Browser/Deno output", async () => {
  const first = JSON.stringify(await createV2014aPortabilitySnapshot());
  const second = JSON.stringify(await createV2014aPortabilitySnapshot());
  if (first !== V2_014A_PORTABILITY_EXPECTED || second !== first) {
    throw new Error(`V2-014A recovery output was nondeterministic:\n${first}\n${second}`);
  }
});
