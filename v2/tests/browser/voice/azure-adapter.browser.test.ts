import { describe, it, expect, vi } from "vitest";
import { SpeechTokenResponseSchema } from "../../../packages/contracts/src/voice.ts";
import { createAzureSpeechAdapter } from "../../../apps/web/src/features/voice/azure-speech-adapter.ts";
// Real SDK boundary, fake media rejection: no network/recognizer can start in these tests.
describe("Azure browser boundary", () => {
  it("rejects an expired token before microphone access", async () => {
    const failed = vi.fn(); const getUserMedia = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    const adapter = createAzureSpeechAdapter(async request => SpeechTokenResponseSchema.parse({ ...request,
      voice_schema_version: "1.0", authorization_token: "synthetic", region: "regiontest", issued_at_ms: 0, expires_at_ms: 480000 }));
    const handle = await adapter.recognize({ session_id: "session.voice", locale: "ar-JO" as never, signal: new AbortController().signal,
      listening() {}, partial() {}, final() {}, ended() {}, failed, tokenLatency() {} });
    expect(failed).toHaveBeenCalledWith("TOKEN_EXPIRED"); expect(getUserMedia).not.toHaveBeenCalled(); handle.close(); getUserMedia.mockRestore();
  });
  it("maps real browser permission rejection safely without starting the SDK", async () => {
    const failed = vi.fn(); const mic = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(new DOMException("private", "NotAllowedError"));
    const adapter = createAzureSpeechAdapter(async request => SpeechTokenResponseSchema.parse({ ...request,
      voice_schema_version: "1.0", authorization_token: "synthetic", region: "regiontest", issued_at_ms: Date.now(), expires_at_ms: Date.now() + 480000 }));
    await adapter.recognize({ session_id: "session.voice", locale: "en-US" as never, signal: new AbortController().signal,
      listening() {}, partial() {}, final() {}, ended() {}, failed, tokenLatency() {} });
    expect(failed).toHaveBeenCalledWith("PERMISSION_DENIED"); mic.mockRestore();
  });
  it("token failure and mismatched capability never request microphone", async () => {
    const failed = vi.fn(); const mic = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    const adapter = createAzureSpeechAdapter(async () => { throw Error("private provider token failure"); });
    await adapter.recognize({ session_id: "session.voice", locale: "en-US" as never, signal: new AbortController().signal,
      listening() {}, partial() {}, final() {}, ended() {}, failed, tokenLatency() {} });
    expect(failed).toHaveBeenCalledWith("TOKEN_UNAVAILABLE"); expect(mic).not.toHaveBeenCalled(); mic.mockRestore();
  });
});
