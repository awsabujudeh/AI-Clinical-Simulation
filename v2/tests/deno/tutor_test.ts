import { tutorSnapshot } from "../fixtures/tutor.ts";
import { canonicalSerialize } from "../../packages/case-schema/src/index.ts";
import { PORTABLE_SHA256_ADAPTER } from "../fixtures/portable-sha256.ts";
Deno.test("Tutor exact canonical Browser/Deno output", async () => {
  const hash = await PORTABLE_SHA256_ADAPTER.sha256(canonicalSerialize(await tutorSnapshot()));
  if (hash !== "d193339fbe2a1f9c3891932c3f1b7ed3f440a67275c3650ec09209e22808a5ad") throw Error(`Tutor snapshot mismatch: ${hash}`);
});
