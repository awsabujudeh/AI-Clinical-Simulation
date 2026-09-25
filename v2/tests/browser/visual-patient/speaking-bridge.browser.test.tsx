import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { PatientSpeech } from "../../../apps/web/src/features/voice/PatientSpeech.tsx";
import { LocalizationProvider } from "../../../apps/web/src/app/localization.tsx";
import { observePatientAudio } from "../../../apps/web/src/features/voice/patient-audio-playback.ts";
import { voiceUiHarness } from "../../fixtures/voice/ui-services.ts";
import { bindVisualExamRequest, currentVisualExamSelection } from "../../../apps/web/src/features/visual-patient/exam-intent.ts";
import { SYNTHETIC_SAFE_SESSION } from "../../fixtures/student-ui/safe-session.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("PatientSpeech propagates actual playback events, replay, mute and unmount; text alone never speaks", async () => {
  const h = voiceUiHarness();
  const result = await h.services.patient_conversation!.submit({ session_id: SYNTHETIC_SAFE_SESSION.session_id, locale: "en-US" as never, text: "Synthetic question", source: "TEXT" });
  if (result.kind !== "COMMITTED") throw Error();
  const player = document.createElement("audio");
  vi.spyOn(player, "play").mockImplementation(async () => { player.dispatchEvent(new Event("playing")); });
  const handle = observePatientAudio(player, () => {});
  h.services.voice!.adapter.synthesize = async () => handle;
  const listener = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<LocalizationProvider><PatientSpeech voice={h.services.voice} turn={result.turn} onSpeaking={listener} /></LocalizationProvider>));
    expect(listener.mock.calls.some(c => c[1] === true)).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, true);
    await act(async () => player.dispatchEvent(new Event("ended")));
    expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, false);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, true);
    await act(async () => player.dispatchEvent(new Event("error")));
    expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, false);
    await act(async () => host.querySelectorAll<HTMLButtonElement>("button")[1]!.click());
    expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, false);
  } finally { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); }
  expect(listener).toHaveBeenLastCalledWith(result.turn.turn_id, false);
});
it("exam intent binds safe Session/case/version context and rejects stale or cross-case selection", () => {
  const request = { type: "visual_exam_request" as const, tool: "inspection" as const, exam_mode: "INSPECTION", region_id: "CHEST", anchor_id: "Region_CHEST", patient_position: "supine" as const };
  const before = JSON.stringify(SYNTHETIC_SAFE_SESSION);
  const intent = bindVisualExamRequest(request, SYNTHETIC_SAFE_SESSION);
  expect(intent.request.anchor_id).toBe("Region_CHEST"); expect(currentVisualExamSelection(intent, SYNTHETIC_SAFE_SESSION)).toBe(true);
  expect(currentVisualExamSelection({ ...intent, state_version: intent.state_version + 1 as never }, SYNTHETIC_SAFE_SESSION)).toBe(false);
  expect(currentVisualExamSelection({ ...intent, session_id: "session.another" as never }, SYNTHETIC_SAFE_SESSION)).toBe(false);
  expect(JSON.stringify(SYNTHETIC_SAFE_SESSION)).toBe(before); expect(intent).not.toHaveProperty("parameters");
});
