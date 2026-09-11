import { it, expect, vi } from "vitest";
import { SpeechTokenResponseSchema, type SpeechTokenRequest } from "../../../packages/contracts/src/voice.ts";
import { createElevenLabsSpeechAdapter, type SpeechBrowserRuntime } from "../../../apps/web/src/features/voice/elevenlabs-speech-adapter.ts";
import { openPcmMicrophone } from "../../../apps/web/src/features/voice/pcm-microphone.ts";
import { createMemorySpeechTokenBroker } from "../../../packages/api-core/src/voice/token-broker.ts";
import { createElevenLabsTokenProvider } from "../../../packages/api-core/src/voice/elevenlabs-token-provider.ts";
import { SYNTHETIC_VOICE_PROFILE } from "../../fixtures/voice/mock-speech.ts";
function harness() {
  const sockets: any[] = []; let pcm: ((bytes: Uint8Array) => void) | undefined;
  const closed = vi.fn(); const stopped = vi.fn(async () => {}); const microphone = vi.fn(async (_signal, callback) => { pcm = callback; return { close: closed, stop: stopped }; });
  const play = vi.fn(async () => {}); const audio = vi.fn((_bytes: Uint8Array) => ({ play, close: closed }));
  const runtime: SpeechBrowserRuntime = { now: () => 1000, microphone, audio,
    socket(url) { const value = { url, sent: [] as string[], bufferedAmount: 0, close: vi.fn(),
      send(data: string) { value.sent.push(data); }, onopen: undefined as any, onmessage: undefined as any, onclose: undefined as any, onerror: undefined as any };
      sockets.push(value); return value as unknown as WebSocket; } };
  let issued = 0;
  const tokens = vi.fn(async (req: SpeechTokenRequest) => SpeechTokenResponseSchema.parse({
    voice_schema_version: "2.0", provider: "ELEVENLABS", ...req, single_use_token: `synthetic-${++issued}`, issued_at_ms: 1000, expires_at_ms: 901000,
    ...(req.capability === "STT" ? { token_type: "realtime_scribe", model_id: "scribe_v2_realtime", language_code: req.locale === "ar-JO" ? "ar" : "en", secondary_languages: req.locale === "ar-JO" ? ["en"] : [] }
      : { token_type: "tts_websocket", model_id: "eleven_v3_conversational", voice_id: "syntheticArabicVoice" })
  }));
  const adapter = createElevenLabsSpeechAdapter(tokens, runtime);
  const input = { session_id: "session.voice", locale: "ar-JO" as never, signal: new AbortController().signal,
    listening: vi.fn(), partial: vi.fn(), final: vi.fn(), ended: vi.fn(), failed: vi.fn(), tokenLatency: vi.fn() };
  const message = (data: unknown) => sockets.at(-1).onmessage({ data: JSON.stringify(data) });
  return { adapter, runtime, tokens, sockets, input, message, microphone, closed, stopped, audio, play, pcm: (data: Uint8Array) => pcm!(data) };
}
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)); }
it("STT uses Arabic+English hint, manual commit, partial/final-not-committed remain display-only", async () => {
  const h = harness(); const handle = await h.adapter.recognize(h.input);
  const url = new URL(h.sockets[0].url); expect(url.pathname).toBe("/v1/speech-to-text/realtime");
  expect(url.origin).toBe("wss://api.elevenlabs.io"); expect(url.searchParams.get("token")).toBe("synthetic-1");
  expect(h.tokens).toHaveBeenCalledWith({ session_id: "session.voice", locale: "ar-JO", capability: "STT" }, h.input.signal);
  expect(url.searchParams.get("model_id")).toBe("scribe_v2_realtime");
  expect(url.searchParams.get("language_code")).toBe("ar"); expect(url.searchParams.getAll("secondary_languages")).toEqual(["en"]);
  expect(url.searchParams.get("commit_strategy")).toBe("manual"); expect(h.microphone).not.toHaveBeenCalled();
  h.message({ message_type: "session_started" }); await settle(); expect(h.input.listening).toHaveBeenCalledOnce();
  h.pcm(new Uint8Array([0, 1])); expect(JSON.parse(h.sockets[0].sent[0])).toMatchObject({ message_type: "input_audio_chunk", sample_rate: 16000 });
  h.message({ message_type: "partial_transcript", text: "partial" }); h.message({ message_type: "final_transcript", text: "not committed" });
  expect(h.input.partial.mock.calls).toEqual([["partial"], ["not committed"]]);
  expect(h.input.final).not.toHaveBeenCalled(); handle.stop(); await settle(); expect(h.stopped).toHaveBeenCalledOnce();
  expect(JSON.parse(h.sockets[0].sent.at(-1))).toMatchObject({ commit: true });
  h.message({ message_type: "committed_transcript", text: "exact committed" });
  expect(h.input.final).toHaveBeenCalledWith("exact committed"); expect(h.input.ended).toHaveBeenCalledOnce();
  expect(h.closed).toHaveBeenCalled(); expect(h.sockets[0].close).toHaveBeenCalled();
});
it("expired, malformed or duplicate tokens fail before any microphone/second connection", async () => {
  const h = harness(); const token = await h.tokens({ session_id: "session.voice" as never, locale: "ar-JO" as never, capability: "STT" });
  h.tokens.mockResolvedValue(token); const first = await h.adapter.recognize(h.input); first.close();
  await h.adapter.recognize(h.input); expect(h.sockets).toHaveLength(1); expect(h.input.failed).toHaveBeenCalledWith("TOKEN_UNAVAILABLE");
  const expired = harness(); expired.runtime.now = () => 900999; await expired.adapter.recognize(expired.input);
  expect(expired.input.failed).toHaveBeenCalledWith("TOKEN_EXPIRED"); expect(expired.microphone).not.toHaveBeenCalled();
});
it("permission rejection, socket errors and malformed provider messages are sanitized", async () => {
  const h = harness(); h.microphone.mockRejectedValue(new DOMException("private", "NotAllowedError"));
  await h.adapter.recognize(h.input); h.message({ message_type: "session_started" }); await settle();
  expect(h.input.failed).toHaveBeenCalledWith("PERMISSION_DENIED");
  const other = harness(); await other.adapter.recognize(other.input); other.message({ message_type: "auth_error", error: "private detail" });
  expect(other.input.failed).toHaveBeenCalledWith("RECOGNITION_FAILED");
});
it("late microphone setup after abort closes resources without listening", async () => {
  const h = harness(); let resolve!: (value: any) => void;
  h.microphone.mockImplementation(() => new Promise(done => { resolve = done; }));
  const abort = new AbortController(); await h.adapter.recognize({ ...h.input, signal: abort.signal });
  h.message({ message_type: "session_started" }); abort.abort(); resolve({ close: h.closed, stop: h.stopped }); await settle();
  expect(h.closed).toHaveBeenCalledOnce(); expect(h.input.listening).not.toHaveBeenCalled();
});
it("real microphone boundary permission rejection creates no stream/file/provider traffic", async () => {
  const mic = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(new DOMException("private", "NotAllowedError"));
  try { await expect(openPcmMicrophone(new AbortController().signal, () => {})).rejects.toBeInstanceOf(DOMException); }
  finally { mic.mockRestore(); }
});
const tts = { session_id: "session.voice", locale: "ar-JO" as never, voice_profile_id: "voice-profile.synthetic",
  voice_id: "syntheticArabicVoice", text: "النص المعتمد كما هو", signal: new AbortController().signal, firstAudio: vi.fn() };
it("v3 dialogue uses capability token in setup and sends exact approved text only; replay is local", async () => {
  const h = harness(); const result = h.adapter.synthesize(tts); await settle(); await settle();
  const socket = h.sockets[0];
  expect(socket.url).toBe("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v3_conversational&output_format=mp3_44100_128");
  expect(socket.url).not.toContain("/text-to-speech/");
  expect(socket.url).not.toContain("synthetic-"); socket.onopen();
  expect(JSON.parse(socket.sent[0])).toEqual({ voices: ["syntheticArabicVoice"], single_use_token: "synthetic-1" });
  expect(JSON.parse(socket.sent[1])).toEqual({ inputs: [{ text: tts.text, voice_id: tts.voice_id }], close_socket: true });
  h.message({ audio: btoa("mock-mp3") }); h.message({ is_final: true });
  const ready = await result; await ready.play(); await ready.play(); expect(h.play).toHaveBeenCalledTimes(2);
  expect(h.tokens).toHaveBeenCalledOnce(); ready.close();
});
it.each(["STT", "TTS"] as const)("mocked server-minted %s capability reaches its documented browser protocol without the permanent key", async capability => {
  const h = harness(); const key = "synthetic-boundary-key-not-a-credential";
  const mint = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ token: "synthetic-minted-single-use" })));
  const broker = createMemorySpeechTokenBroker(createElevenLabsTokenProvider({ api_key: key, fetch: mint }), () => 1000, [SYNTHETIC_VOICE_PROFILE]);
  const delivered: unknown[] = [];
  const adapter = createElevenLabsSpeechAdapter(async request => {
    const result = await broker.issue("synthetic-principal", request, "issue.protocol");
    if (!result.success) throw Error("Unexpected mock issuance failure");
    delivered.push(result.data); return result.data;
  }, h.runtime);
  if (capability === "STT") {
    const handle = await adapter.recognize(h.input);
    const url = new URL(h.sockets[0].url);
    expect(`${url.origin}${url.pathname}`).toBe("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    expect(url.searchParams.get("token")).toBe("synthetic-minted-single-use");
    expect(url.searchParams.get("model_id")).toBe("scribe_v2_realtime");
    expect(url.searchParams.get("language_code")).toBe("ar"); expect(url.searchParams.getAll("secondary_languages")).toEqual(["en"]);
    expect(delivered[0]).toMatchObject({ token_type: "realtime_scribe" }); handle.close();
  } else {
    const pending = adapter.synthesize({ ...tts, voice_profile_id: SYNTHETIC_VOICE_PROFILE.profile_id });
    await vi.waitFor(() => expect(h.sockets).toHaveLength(1));
    const socket = h.sockets[0]; socket.onopen();
    expect(socket.url).toBe("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v3_conversational&output_format=mp3_44100_128");
    expect(JSON.parse(socket.sent[0])).toEqual({ voices: [tts.voice_id], single_use_token: "synthetic-minted-single-use" });
    expect(JSON.parse(socket.sent[1])).toEqual({ inputs: [{ text: tts.text, voice_id: tts.voice_id }], close_socket: true });
    expect(delivered[0]).toMatchObject({ token_type: "tts_websocket", model_id: "eleven_v3_conversational" });
    h.message({ audio: btoa("mock-audio"), is_final: true }); (await pending).close();
  }
  expect(mint).toHaveBeenCalledOnce();
  const [url, options] = mint.mock.calls[0]!;
  expect(url).toBe(`https://api.elevenlabs.io/v1/single-use-token/${capability === "STT" ? "realtime_scribe" : "tts_websocket"}`);
  expect(options).toMatchObject({ method: "POST", headers: { "xi-api-key": key }, redirect: "error" });
  const browserData = JSON.stringify({ delivered, sockets: h.sockets.map(socket => ({ url: socket.url, sent: socket.sent })) });
  expect(browserData).not.toContain(key); expect(browserData).not.toMatch(/xi-api-key|api_key|ELEVENLABS_API_KEY/);
});
it("TTD preserves exact whitespace/text without expressive tags and waits for socket final, not turn final", async () => {
  const h = harness(); const approved = "  النص المعتمد فقط.\nExact approved Patient text.  ";
  const pending = h.adapter.synthesize({ ...tts, text: approved });
  await vi.waitFor(() => expect(h.sockets).toHaveLength(1)); const socket = h.sockets[0]; socket.onopen();
  expect(JSON.parse(socket.sent[0]).voices).toEqual([tts.voice_id]);
  expect(JSON.parse(socket.sent[1])).toEqual({ inputs: [{ text: approved, voice_id: tts.voice_id }], close_socket: true });
  expect(socket.sent.join("")).not.toMatch(/\[(sad|angry|sighs|whispers)\]/);
  h.message({ audio: btoa("first"), is_final_audio_for_turn: true });
  expect(h.audio).not.toHaveBeenCalled(); expect(socket.close).not.toHaveBeenCalled();
  h.message({ audio: btoa("last"), is_final: true }); const audio = await pending;
  expect(new TextDecoder().decode(h.audio.mock.calls[0]![0])).toBe("firstlast");
  expect(socket.close).toHaveBeenCalledOnce(); audio.close();
});
it("TTD oversized buffered audio fails closed without playback or automatic retry", async () => {
  const h = harness(); const pending = h.adapter.synthesize(tts); const check = expect(pending).rejects.toThrow("TTS_FAILED");
  await vi.waitFor(() => expect(h.sockets).toHaveLength(1)); h.sockets[0].onopen();
  h.message({ audio: btoa("a".repeat(2_000_000)) }); h.message({ audio: btoa("b".repeat(2_000_001)), is_final: true });
  await check; expect(h.audio).not.toHaveBeenCalled(); expect(h.sockets[0].close).toHaveBeenCalledOnce(); expect(h.tokens).toHaveBeenCalledOnce();
});
it("TTS wrong voice binding, provider failure and empty audio remain sanitized failures", async () => {
  const h = harness(); await expect(h.adapter.synthesize({ ...tts, voice_id: "untrusted" })).rejects.toThrow("TTS_FAILED");
  const empty = harness(); const result = empty.adapter.synthesize(tts); const check = expect(result).rejects.toThrow("TTS_FAILED");
  await settle(); await settle(); empty.sockets[0].onopen(); empty.message({ is_final: true }); await check;
  const failed = harness(); const failure = failed.adapter.synthesize(tts); const failedCheck = expect(failure).rejects.toThrow("TTS_FAILED");
  await settle(); await settle(); failed.message({ error: "private" }); await failedCheck;
});
it("TTS deadline closes a hung provider connection with no audio or retry", async () => {
  vi.useFakeTimers();
  try {
    const h = harness(); const pending = h.adapter.synthesize(tts); const check = expect(pending).rejects.toThrow("TTS_TIMEOUT");
    await vi.waitFor(() => expect(h.sockets).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(10000); await check;
    expect(h.sockets[0].close).toHaveBeenCalledOnce(); expect(h.audio).not.toHaveBeenCalled(); expect(h.tokens).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
it("PCM capture converts bounded samples, flushes before close and releases stream/context", async () => {
  const stop = vi.fn(); const contextClose = vi.fn(async () => {}); const chunk = vi.fn(); let port: any;
  const microphone = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  class Context {
    destination = {}; audioWorklet = { addModule: vi.fn(async () => {}) };
    createMediaStreamSource() { return { connect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() { return { connect() {} }; } }; }
    resume = async () => {}; close = contextClose;
  }
  class Node {
    port = port = { onmessage: undefined as any, close: vi.fn(), postMessage() {
      port.onmessage({ data: { samples: new Float32Array([-2, 0, 2]) } }); port.onmessage({ data: { done: true } });
    } }; disconnect = vi.fn(); connect = () => ({ connect() {} });
  }
  vi.stubGlobal("AudioContext", Context); vi.stubGlobal("AudioWorkletNode", Node);
  try {
    const pcm = await openPcmMicrophone(new AbortController().signal, chunk); await pcm.stop(); pcm.close();
    expect([...chunk.mock.calls[0]![0]]).toEqual([0, 128, 0, 0, 255, 127]);
    expect(stop).toHaveBeenCalled(); expect(contextClose).toHaveBeenCalledOnce(); expect(port.close).toHaveBeenCalledOnce();
  } finally { microphone.mockRestore(); vi.unstubAllGlobals(); }
});
