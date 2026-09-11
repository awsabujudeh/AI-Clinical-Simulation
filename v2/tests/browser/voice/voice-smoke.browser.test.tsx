import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { VoiceSmoke, createSmokeTokenSource, SMOKE_REFERENCE } from "../../../apps/web/src/features/voice/VoiceSmoke.tsx";
import { fakeVoiceClock, mockSpeech, SYNTHETIC_VOICE_PROFILE } from "../../fixtures/voice/mock-speech.ts";
import { SpeechTokenRequestSchema } from "../../../packages/contracts/src/voice.ts";
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
});
