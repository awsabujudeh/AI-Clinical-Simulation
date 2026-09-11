import { act } from "react";
import { onlineManager } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { App } from "../../../apps/web/src/App.tsx";
import { voiceUiHarness } from "../../fixtures/voice/ui-services.ts";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: Root;
beforeEach(() => { onlineManager.setOnline(true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); window.dispatchEvent(new Event("online")); document.documentElement.lang = "en-US"; document.documentElement.dir = "ltr"; });
async function settle(check: () => boolean) {
  for (let i = 0; i < 100; i++) { if (check()) return; await act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
  throw Error("Voice UI did not settle");
}
async function open(scenario = "success") {
  const h = voiceUiHarness(scenario);
  await act(async () => root.render(<App services={h.services} initialEntries={["/sessions/session.ui-neutral"]} />));
  await settle(() => host.textContent?.includes("Patient available") === true); return h;
}
const button = (text: string) => [...host.querySelectorAll("button")].find(x => x.textContent === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function fill(selector: string, value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLTextAreaElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
it("Patient speech requires final review/edit and explicit text submit; exact reply alone enters TTS", async () => {
  const h = await open(); await click("Start recording");
  await act(async () => h.speech.listener().partial("partial secret to no submit"));
  expect(h.calls.questions).toBe(0); expect(host.querySelector('textarea[aria-label="Review final transcript"]')).toBeNull();
  await act(async () => h.speech.listener().final("wrong transcript")); await click("Stop recording"); await act(async () => h.speech.listener().ended());
  await fill('textarea[aria-label="Review final transcript"]', "Edited question"); await click("Use reviewed text");
  expect(h.calls.questions).toBe(0); await click("Ask patient");
  await settle(() => host.textContent?.includes("Approved synthetic patient reply.") === true);
  expect(h.calls).toMatchObject({ questions: 1, text: "Edited question", source: "STT", executions: 0 });
  await click("Play patient audio"); expect(h.speech.synthesis[0]?.text).toBe("Approved synthetic patient reply.");
  await click("Replay patient audio"); expect(h.speech.counters.plays).toBe(2); expect(h.speech.synthesis).toHaveLength(1);
  await click("Mute patient audio"); expect(button("Play patient audio").disabled).toBe(true);
});
it.each(["permission", "token", "disabled"])("%s leaves typed Patient path enabled", async scenario => {
  const h = await open(scenario); if (scenario !== "disabled") await click("Start recording");
  const field = host.querySelector<HTMLTextAreaElement>(".patient-conversation form > label textarea")!;
  expect(field.disabled).toBe(false); await fill(".patient-conversation form > label textarea", "Typed fallback"); await click("Ask patient");
  await settle(() => h.calls.questions === 1); expect(h.calls.source).toBe("TEXT");
});
it.each(["tts-fail", "blocked"])("%s never hides approved patient text", async scenario => {
  const h = await open(scenario); await fill(".patient-conversation form > label textarea", "Question"); await click("Ask patient");
  await settle(() => host.textContent?.includes("Approved synthetic patient reply.") === true); await click("Play patient audio");
  expect(host.textContent).toContain(scenario === "blocked" ? "PLAYBACK_BLOCKED" : "TTS_FAILED");
  expect(host.textContent).toContain("Approved synthetic patient reply."); expect(h.calls.executions).toBe(0);
});
it("clinical speech enters Interpreter candidate then existing medication confirmation, never direct execution", async () => {
  const h = await open(); await click("Medications"); await click("Start recording");
  await act(async () => h.speech.listener().final("Give synthetic study agent")); await click("Stop recording"); await act(async () => h.speech.listener().ended());
  await click("Use reviewed text"); expect(h.calls.interpretations).toBe(0); await click("Interpret command");
  expect(h.calls.interpretations).toBe(1); expect(h.calls.executions).toBe(0); await click("Propose action");
  expect(host.textContent).toContain("Confirm this proposal"); expect(h.calls.executions).toBe(0);
});
it("locale switch and cancel discard old recognizer callbacks", async () => {
  const h = await open(); await click("Start recording"); const old = h.speech.listener(); await click("العربية");
  await act(async () => { old.final("stale"); old.ended(); });
  expect(host.textContent).not.toContain("stale"); expect(h.speech.counters.closed).toBe(1); expect(h.calls.questions).toBe(0);
});
it("network loss stops capture; typed question remains available while authority remains online", async () => {
  const h = await open(); await click("Start recording");
  await act(async () => window.dispatchEvent(new Event("offline")));
  expect(h.speech.counters.closed).toBe(1);
  expect(host.querySelector<HTMLTextAreaElement>(".patient-conversation form > label textarea")?.disabled).toBe(false);
});
it("TTS timeout aborts audio without affecting readable patient response", async () => {
  await open("tts-timeout"); await fill(".patient-conversation form > label textarea", "Question"); await click("Ask patient");
  await settle(() => host.textContent?.includes("Approved synthetic patient reply.") === true);
  vi.useFakeTimers(); await click("Play patient audio"); await act(async () => vi.advanceTimersByTime(12_000));
  expect(host.textContent).toContain("TTS_TIMEOUT"); expect(host.textContent).toContain("Approved synthetic patient reply.");
});
it("Patient provider outage after reviewed STT retains question text and existing read-only recovery, without fabricated audio", async () => {
  const h = await open("patient-fail"); await click("Start recording");
  await act(async () => h.speech.listener().final("Question to keep")); await click("Stop recording"); await act(async () => h.speech.listener().ended());
  await click("Use reviewed text"); await click("Ask patient");
  expect(h.calls.questions).toBe(1); expect(h.speech.synthesis).toHaveLength(0);
  expect(host.querySelector<HTMLTextAreaElement>(".patient-conversation form > label textarea")?.value).toBe("Question to keep");
  expect(host.textContent).toContain("Reconnect to ask a new question");
});
it("Interpreter outage after STT retains manual action catalogue and typed input", async () => {
  const h = await open("interpreter-fail"); await click("Medications"); await click("Start recording");
  await act(async () => h.speech.listener().final("Synthetic request")); await click("Stop recording"); await act(async () => h.speech.listener().ended());
  await click("Use reviewed text"); await click("Interpret command");
  expect(h.calls.executions).toBe(0); expect(host.textContent).toContain("Manual Clinical Actions remain available");
  expect(host.querySelector<HTMLTextAreaElement>(".clinical-interpreter > label textarea")?.disabled).toBe(false);
});
