import { voicePortability, VOICE_PORTABILITY_EXPECTED } from "../fixtures/voice/portability.ts";
import { speechTokenPortability, TOKEN_PORTABILITY_EXPECTED } from "../fixtures/voice/portability.ts";
Deno.test("exact shared STT/TTS token policy matches Browser", async () => {
  if (await speechTokenPortability() !== TOKEN_PORTABILITY_EXPECTED) throw Error("Token portability mismatch");
});
Deno.test("V2-020A exact voice transcript/evaluation portability", async () => {
  if (await voicePortability() !== VOICE_PORTABILITY_EXPECTED) throw new Error("Voice portability mismatch");
});
