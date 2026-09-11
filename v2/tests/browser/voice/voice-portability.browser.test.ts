import { it, expect } from "vitest";
import { voicePortability, VOICE_PORTABILITY_EXPECTED } from "../../fixtures/voice/portability.ts";
import { speechTokenPortability, TOKEN_PORTABILITY_EXPECTED } from "../../fixtures/voice/portability.ts";
it("matches exact Deno STT/TTS token policy output from the same contracts/broker", async () => {
  expect(await speechTokenPortability()).toBe(TOKEN_PORTABILITY_EXPECTED);
});
it("matches exact Deno voice output using the same pure source", async () => {
  expect(await voicePortability()).toBe(VOICE_PORTABILITY_EXPECTED);
});
