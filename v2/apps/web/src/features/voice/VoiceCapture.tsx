import { useEffect, useMemo, useRef, useState } from "react";
import type { PatientLanguage } from "@ai-clinical-simulation/contracts";
import { createCaptureController, browserVoiceClock, type CaptureSnapshot } from "./capture-controller";
import type { StudentVoiceServices } from "./voice-services";

export function VoiceCapture({ voice, sessionId, locale, enabled, onReviewed }: {
  voice?: StudentVoiceServices; sessionId: string; locale: PatientLanguage; enabled: boolean;
  onReviewed(text: string): void;
}) {
  const [state, setState] = useState<CaptureSnapshot>({ phase: "IDLE", partial: "", final: "" });
  const [edited, setEdited] = useState("");
  const latest = useRef(onReviewed); latest.current = onReviewed;
  const controller = useMemo(() => voice === undefined ? undefined : createCaptureController({
    adapter: voice.adapter, session_id: sessionId, locale, utterance_id: `voice.${crypto.randomUUID()}`,
    clock: browserVoiceClock, changed(next) { setState(next); if (next.phase === "READY_TO_REVIEW") setEdited(next.final); },
    telemetry: voice.telemetry
  }), [voice, sessionId, locale]);
  useEffect(() => {
    setState({ phase: "IDLE", partial: "", final: "" }); setEdited("");
    const lost = () => controller?.cancel("NETWORK_LOST");
    window.addEventListener("offline", lost);
    return () => { window.removeEventListener("offline", lost); controller?.dispose(); };
  }, [controller]);
  useEffect(() => { if (!enabled) controller?.cancel(); }, [enabled, controller]);
  const ar = locale === "ar-JO";
  const active = ["REQUESTING_PERMISSION", "LISTENING", "PROCESSING_FINAL"].includes(state.phase);
  return <div className="voice-controls" aria-label={ar ? "الإدخال الصوتي" : "Voice input"}>
    <p>{ar ? "الصوت اختياري. الحد ١٥ ثانية. راجع النص قبل إرساله؛ الكتابة متاحة دائمًا." : "Voice is optional. Maximum 15 seconds. Review text before sending; typing remains available."}</p>
    <button type="button" disabled={!enabled || !controller || active} onClick={() => void controller?.start()}>{ar ? "ابدأ التسجيل" : "Start recording"}</button>
    <button type="button" disabled={state.phase !== "LISTENING"} onClick={() => controller?.stop()}>{ar ? "أوقف التسجيل" : "Stop recording"}</button>
    <button type="button" disabled={!controller} onClick={() => { controller?.cancel(); setEdited(""); }}>{ar ? "إلغاء الصوت" : "Cancel voice"}</button>
    <p role="status">{state.phase}{state.failure ? ` — ${state.failure}` : ""}</p>
    {state.partial ? <p aria-label="Partial transcript">{state.partial}</p> : null}
    {state.phase === "READY_TO_REVIEW" ? <>
      <label>{ar ? "راجع النص النهائي" : "Review final transcript"}<textarea aria-label="Review final transcript" maxLength={4_000} value={edited} onChange={(event) => setEdited(event.currentTarget.value)} /></label>
      <button type="button" disabled={!enabled || !edited.trim()} onClick={() => {
        const reviewed = controller?.review(edited);
        if (reviewed !== undefined) { latest.current(reviewed); controller?.cancel(); }
      }}>{ar ? "استخدم النص المراجع" : "Use reviewed text"}</button>
    </> : null}
  </div>;
}
