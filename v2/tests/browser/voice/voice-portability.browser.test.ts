import { it, expect } from "vitest";
import { voicePortability, VOICE_PORTABILITY_EXPECTED } from "../../fixtures/voice/portability.ts";
it("matches exact Deno voice output using the same pure source", async () => {
  expect(await voicePortability()).toBe(VOICE_PORTABILITY_EXPECTED);
});
