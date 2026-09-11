import { voicePortability, VOICE_PORTABILITY_EXPECTED } from "../fixtures/voice/portability.ts";
Deno.test("V2-020A exact voice transcript/evaluation portability", async () => {
  if (await voicePortability() !== VOICE_PORTABILITY_EXPECTED) throw new Error("Voice portability mismatch");
});
