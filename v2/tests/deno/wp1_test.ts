import { WP1_PORTABLE_EXPECTED, wp1PortableSnapshot } from "../fixtures/wp1.ts";
Deno.test("WP1 Deno/Browser exact acquisition/time equality", async () => {
  const a = await wp1PortableSnapshot(), b = await wp1PortableSnapshot();
  if (a !== b || a !== WP1_PORTABLE_EXPECTED) {
    throw Error(`WP1_PARITY_FAILED ${a}`);
  }
});
