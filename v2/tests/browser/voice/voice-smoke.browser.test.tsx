import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { VoiceSmoke, createSmokeTokenSource, SMOKE_REFERENCE } from "../../../apps/web/src/features/voice/VoiceSmoke.tsx";
import { fakeVoiceClock, mockSpeech, SYNTHETIC_VOICE_PROFILE } from "../../fixtures/voice/mock-speech.ts";
import { SpeechTokenRequestSchema } from "../../../packages/contracts/src/voice.ts";
import { TTS_FAILURE_CODES, TtsDiagnostic } from "../../../apps/web/src/features/voice/tts-diagnostics.ts";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const button = (text: string) => [...host.querySelectorAll("button")].find(x => x.textContent === text)!;
async function open() {
  const speech = mockSpeech(); const time = fakeVoiceClock();
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} clock={time.clock} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  return { ...speech, ...time };
}
it("mount does not record; partial is display-only, final editable without any submission or playback", async () => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected traffic"));
  const h = await open(); expect(h.listener()).toBeUndefined();
  expect(host.textContent).toContain(SMOKE_REFERENCE);
  await act(async () => button("Start recording").click());
  await act(async () => { h.advance(120); h.listener().partial("partial only"); });
  const area = host.querySelector("textarea")!; expect(area.disabled).toBe(true); expect(area.value).toBe("");
  await act(async () => { h.listener().final("final text"); button("Stop recording").click(); h.advance(80); h.listener().ended(); });
  expect(area.disabled).toBe(false); expect(area.value).toBe("final text");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "edited locally");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(area.value).toBe("edited locally"); expect(host.textContent).toContain("120"); expect(host.textContent).toContain("80");
  expect(host.querySelector("form")).toBeNull(); expect(host.querySelector('button[type="submit"]')).toBeNull();
  expect(h.synthesis).toHaveLength(0); expect(network).not.toHaveBeenCalled();
  expect([...host.querySelectorAll("button")].map(x => x.textContent)).toEqual(["Start recording", "Stop recording", "Cancel / clear", "Generate TTS", "Play / replay", "Mute / discard audio"]);
});
it("same controller stops at 15 seconds; automatic cap is not mislabeled explicit Stop latency", async () => {
  const h = await open(); await act(async () => button("Start recording").click());
  await act(async () => { h.listener().final("final"); h.advance(14999); }); expect(h.counters.stops).toBe(0);
  await act(async () => { h.advance(1); h.listener().ended(); }); expect(h.counters.stops).toBe(1);
  expect(host.textContent).toContain("not measured (no explicit Stop)"); expect(h.counters.closed).toBe(1);
});
it("permission failure is safe and unmount/cancel release resources", async () => {
  const h = await open(); await act(async () => button("Start recording").click());
  await act(async () => h.listener().failed("PERMISSION_DENIED"));
  expect(host.textContent).toContain("DENIED"); expect(host.textContent).toContain("PERMISSION_DENIED");
  expect(host.querySelector("textarea")!.disabled).toBe(true);
  await act(async () => button("Start recording").click());
  await act(async () => button("Cancel / clear").click()); expect(h.counters.closed).toBe(2);
});
it("token transport is fixed, carries binding only (never reference/transcript), and sanitizes failures", async () => {
  const outcomes: string[] = []; const request = SpeechTokenRequestSchema.parse({ session_id: "session.voice-smoke", locale: "ar-JO", capability: "STT" });
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...request, voice_schema_version: "2.0",
    provider: "ELEVENLABS", token_type: "realtime_scribe", model_id: "scribe_v2_realtime", language_code: "ar", secondary_languages: ["en"], single_use_token: "synthetic-token", issued_at_ms: 0, expires_at_ms: 900000 })));
  const source = createSmokeTokenSource(value => outcomes.push(value), transport);
  await source(request, new AbortController().signal);
  expect(transport.mock.calls[0]?.[0]).toBe("http://127.0.0.1:4183/__diagnostic/voice-smoke/token");
  expect(transport.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(request));
  expect(transport.mock.calls[0]?.[1]).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" });
  transport.mockResolvedValueOnce(new Response("unsafe provider detail", { status: 503 }));
  await expect(source(request, new AbortController().signal)).rejects.toThrow("TOKEN_UNAVAILABLE");
  expect(outcomes.at(-1)).toBe("TOKEN_UNAVAILABLE"); expect(JSON.stringify(outcomes)).not.toContain("unsafe");
  transport.mockResolvedValueOnce(new Response(JSON.stringify({ invalid: true })));
  await expect(source(request, new AbortController().signal)).rejects.toThrow("TOKEN_UNAVAILABLE");
  const keys = transport.mock.calls.map(([, options]) => (options!.headers as Record<string, string>)["Idempotency-Key"]);
  expect(keys).toHaveLength(3); expect(new Set(keys).size).toBe(3); expect(keys.every(key => /^[0-9a-f-]{36}$/.test(key!))).toBe(true);
});


it("TTS sends only fixed approved reference using trusted profile; local replay/mute retain text", async () => {
  const h = await open(); await act(async () => button("Generate TTS").click());
  expect(h.synthesis).toHaveLength(1); expect(h.synthesis[0]).toMatchObject({ text: SMOKE_REFERENCE,
    voice_profile_id: SYNTHETIC_VOICE_PROFILE.profile_id, voice_id: SYNTHETIC_VOICE_PROFILE.voices["ar-JO"] });
  await act(async () => button("Play / replay").click()); expect(h.synthesis).toHaveLength(1);
  await act(async () => button("Mute / discard audio").click()); expect(host.textContent).toContain(SMOKE_REFERENCE);
});
it("TTS failure retains fixed text and STT/manual review controls", async () => {
  const speech = mockSpeech(); speech.adapter.synthesize = async () => { throw Error("private"); };
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  await act(async () => button("Generate TTS").click());
  expect(host.textContent).toContain("TTS_UNAVAILABLE"); expect(host.textContent).toContain(SMOKE_REFERENCE);
  expect(host.textContent).not.toContain("private"); expect(button("Start recording").disabled).toBe(false);
  expect(host.textContent).toContain("TTS_PROVIDER_ERROR");
});
it.each(TTS_FAILURE_CODES)("smoke exposes only the sanitized %s diagnostic, never raw provider content", async code => {
  const speech = mockSpeech(); speech.adapter.synthesize = async () => { throw new TtsDiagnostic(code,
    { closeCode: 1008, providerCode: "private-token-bearing-url" }); };
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  await act(async () => button("Generate TTS").click());
  expect(host.textContent).toContain(`${code}; close=1008; provider=OTHER`);
  expect(host.textContent).not.toContain("private-token-bearing-url"); expect(host.textContent).toContain(SMOKE_REFERENCE);
});
it("confirmed invalid_token_type remains an allowlisted provider diagnostic with close 1008", async () => {
  const speech = mockSpeech(); speech.adapter.synthesize = async () => { throw new TtsDiagnostic("TTS_PROVIDER_ERROR",
    { closeCode: 1008, providerCode: "invalid_token_type" }); };
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  await act(async () => button("Generate TTS").click());
  expect(host.textContent).toContain("TTS_PROVIDER_ERROR; close=1008; provider=invalid_token_type");
  expect(host.textContent).toContain(SMOKE_REFERENCE); expect(button("Start recording").disabled).toBe(false);
});
it("React StrictMode mount does not synthesize; same-render double click makes one attempt, explicit retry is fresh", async () => {
  const speech = mockSpeech(); let reject!: (reason: unknown) => void;
  const synthesize = vi.fn<typeof speech.adapter.synthesize>(() => new Promise((_done, fail) => { reject = fail; }));
  speech.adapter.synthesize = synthesize;
  await act(async () => root.render(<StrictMode><VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} /></StrictMode>));
  expect(synthesize).not.toHaveBeenCalled();
  await act(async () => { button("Generate TTS").click(); button("Generate TTS").click(); });
  expect(synthesize).toHaveBeenCalledOnce(); const firstSignal = synthesize.mock.calls[0]![0].signal;
  await act(async () => reject(new TtsDiagnostic("TTS_WEBSOCKET_CONNECT_FAILED")));
  expect(synthesize).toHaveBeenCalledOnce();
  await act(async () => button("Generate TTS").click()); expect(synthesize).toHaveBeenCalledTimes(2);
  expect(synthesize.mock.calls[1]![0].signal).not.toBe(firstSignal);
  await act(async () => reject(new TtsDiagnostic("TTS_TOKEN_UNAVAILABLE")));
});
it("autoplay failure can be replayed without a new mint/synthesis; mute releases audio and retains text", async () => {
  const speech = mockSpeech(); const play = vi.fn().mockRejectedValueOnce(Error("private autoplay detail")).mockResolvedValue(undefined);
  const close = vi.fn(); const synthesize = vi.fn(async () => ({ play, close })); speech.adapter.synthesize = synthesize;
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  await act(async () => button("Generate TTS").click()); expect(host.textContent).toContain("PLAY_REQUIRED");
  expect(host.textContent).toContain("TTS_PLAYBACK_FAILED"); expect(host.textContent).not.toContain("private autoplay detail");
  await act(async () => button("Play / replay").click()); expect(host.textContent).toContain("PLAYING");
  expect(host.textContent).toContain("TTS safe diagnostic: NONE"); expect(synthesize).toHaveBeenCalledOnce();
  await act(async () => button("Mute / discard audio").click()); expect(close).toHaveBeenCalledOnce();
  expect(button("Play / replay").disabled).toBe(true); expect(host.textContent).toContain(SMOKE_REFERENCE);
});
it("mute during pending playback prevents late resolution from replacing MUTED", async () => {
  const speech = mockSpeech(); let finish!: () => void; const close = vi.fn();
  speech.adapter.synthesize = async () => ({ play: () => new Promise<void>(resolve => { finish = resolve; }), close });
  await act(async () => root.render(<VoiceSmoke adapter={speech.adapter} profiles={[SYNTHETIC_VOICE_PROFILE]} />));
  await act(async () => button("Generate TTS").click());
  await act(async () => button("Mute / discard audio").click());
  await act(async () => finish()); expect(host.textContent).toContain("TTS outcome: MUTED"); expect(close).toHaveBeenCalledOnce();
});
