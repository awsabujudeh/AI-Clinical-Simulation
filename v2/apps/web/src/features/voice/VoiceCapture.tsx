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
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const phaseLabel = {
    IDLE: text("Ready to record", "جاهز للتسجيل"),
    REQUESTING_PERMISSION: text("Connecting to your microphone…", "جارٍ الاتصال بالميكروفون…"),
    LISTENING: text("Recording — speak now", "جارٍ التسجيل — تحدث الآن"),
    PROCESSING_FINAL: text("Preparing your transcript…", "جارٍ تجهيز النص…"),
    READY_TO_REVIEW: text("Review your transcript before using it", "راجع النص قبل استخدامه"),
    ERROR: text("Recording unavailable. You can type instead.", "التسجيل غير متاح. يمكنك الكتابة بدلاً منه.")
  }[state.phase];
  const failureLabel = state.failure === "PERMISSION_DENIED" ? text("Microphone access is blocked. Allow access in your browser or type instead.", "الوصول إلى الميكروفون محظور. اسمح به في المتصفح أو استخدم الكتابة.")
    : state.failure === "DEVICE_UNAVAILABLE" ? text("No microphone is available. Connect a microphone or type instead.", "لا يتوفر ميكروفون. صِل ميكروفوناً أو استخدم الكتابة.")
    : state.failure === "NO_SPEECH" ? text("No speech was heard. Try again or type instead.", "لم يُسمع كلام. حاول مجدداً أو استخدم الكتابة.")
    : state.failure === "PARTIAL_ONLY" || state.failure === "FINAL_TIMEOUT" ? text("The transcript could not be completed. Record again or type instead.", "تعذّر إكمال النص. أعد التسجيل أو استخدم الكتابة.")
    : state.failure === "NETWORK_LOST" ? text("Connection lost. Reconnect to record again.", "انقطع الاتصال. أعد الاتصال للتسجيل مجدداً.")
    : state.failure ? text("Recording unavailable. Try again or type instead.", "التسجيل غير متاح. حاول مجدداً أو استخدم الكتابة.") : undefined;
  return <div className="voice-controls" role="group" aria-label={text("Voice input", "الإدخال الصوتي")} data-voice-phase={state.phase} data-voice-failure={state.failure}>
    <p>{text("Record up to 15 seconds, then review the text before sending. Typing is always available.", "سجّل حتى ١٥ ثانية، ثم راجع النص قبل إرساله. الكتابة متاحة دائماً.")}</p>
      <button type="button" disabled={!enabled || !controller || active} onClick={() => void controller?.start()}>{ar ? "ابدأ التسجيل" : "Start recording"}</button>
      <button type="button" disabled={state.phase !== "LISTENING"} onClick={() => controller?.stop()}>{ar ? "أوقف التسجيل" : "Stop recording"}</button>
      <button type="button" disabled={!controller} onClick={() => { controller?.cancel(); setEdited(""); }}>{ar ? "إلغاء الصوت" : "Cancel voice"}</button>
    <p role="status" aria-live="polite" aria-atomic="true">{failureLabel ?? (!controller ? text("Voice input is unavailable. You can type instead.", "الإدخال الصوتي غير متاح. يمكنك الكتابة بدلاً منه.") : phaseLabel)}</p>
    {state.partial ? <p aria-label={text("Partial transcript", "النص الأولي")} dir="auto">{state.partial}</p> : null}
    {state.phase === "READY_TO_REVIEW" ? <>
      <label>{ar ? "راجع النص النهائي" : "Review final transcript"}<textarea aria-label={text("Review final transcript", "راجع النص النهائي")} dir="auto" maxLength={4_000} value={edited} onChange={(event) => setEdited(event.currentTarget.value)} /></label>
      <button type="button" disabled={!enabled || !edited.trim()} onClick={() => {
        const reviewed = controller?.review(edited);
        if (reviewed !== undefined) { latest.current(reviewed); controller?.cancel(); }
      }}>{ar ? "استخدم النص المراجع" : "Use reviewed text"}</button>
    </> : null}
  </div>;
}
