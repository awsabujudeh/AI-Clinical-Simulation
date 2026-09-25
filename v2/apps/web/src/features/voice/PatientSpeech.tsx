import { useEffect, useRef, useState } from "react";
import { PatientVoiceProfileSchema, SafePatientConversationTurnSchema, VoiceTelemetrySchema,
  type SafePatientConversationTurn, type VoiceFailureCode } from "@ai-clinical-simulation/contracts";
import type { PatientAudioHandle, StudentVoiceServices } from "./voice-services";
import { useLocalization } from "../../app/localization";

export function PatientSpeech({ voice, turn, onSpeaking }: { voice?: StudentVoiceServices; turn: SafePatientConversationTurn; onSpeaking?(turnId: string, speaking: boolean): void }) {
  const { locale } = useLocalization();
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState("IDLE");
  const generation = useRef(0);
  const active = useRef<AbortController | undefined>(undefined);
  const audio = useRef<PatientAudioHandle | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const speakingCallback = useRef(onSpeaking); speakingCallback.current = onSpeaking;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textReadyAt = useRef(performance.now());
  function reportFailure(code: VoiceFailureCode) {
    const event = VoiceTelemetrySchema.safeParse({ voice_schema_version: "1.0", utterance_id: `tts.${turn.turn_id}`,
      locale: turn.locale, capability: "TTS", permission_outcome: "NOT_REQUESTED",
      completion: "FAILED", edit_occurred: false, failure_code: code });
    if (event.success) { try { voice?.telemetry?.(event.data); } catch { /* optional telemetry */ } }
  }
  function stop() { generation.current += 1; active.current?.abort(); audio.current?.close(); unsubscribe.current?.(); unsubscribe.current = undefined; audio.current = undefined; clearTimeout(timer.current); speakingCallback.current?.(turn.turn_id, false); }
  useEffect(() => {
    stop(); setPhase("IDLE"); textReadyAt.current = performance.now();
    const offline = () => { stop(); setPhase("TTS_FAILED"); };
    window.addEventListener("offline", offline);
    return () => { stop(); window.removeEventListener("offline", offline); };
  }, [turn.turn_id, voice]);
  async function play() {
    if (!voice || muted || phase === "LOADING") return;
    const parsed = SafePatientConversationTurnSchema.safeParse(turn);
    const profile = PatientVoiceProfileSchema.safeParse(voice.profile);
    if (!parsed.success || !profile.success) { setPhase("TTS_FAILED"); return; }
    const own = ++generation.current;
    active.current = new AbortController(); setPhase("LOADING");
    timer.current = setTimeout(() => { if (own === generation.current) { stop(); setPhase("TTS_TIMEOUT"); reportFailure("TTS_TIMEOUT"); } }, 12_000);
    try {
      const ready = audio.current ?? await voice.adapter.synthesize({
        session_id: parsed.data.session_id, locale: parsed.data.locale, voice_profile_id: profile.data.profile_id,
        text: parsed.data.patient_utterance, voice_id: parsed.data.locale === "ar-JO" ? profile.data.voices["ar-JO"] : profile.data.voices["en-US"], signal: active.current.signal,
        firstAudio(ms) {
          const event = VoiceTelemetrySchema.safeParse({ voice_schema_version: "1.0", utterance_id: `tts.${turn.turn_id}`,
            locale: turn.locale, capability: "TTS", permission_outcome: "NOT_REQUESTED",
            tts_first_audio_latency_ms: Math.max(ms, performance.now() - textReadyAt.current), completion: "COMPLETED", edit_occurred: false });
          if (event.success) { try { voice.telemetry?.(event.data); } catch { /* optional telemetry */ } }
        }
      });
      if (own !== generation.current) { ready.close(); return; }
      audio.current = ready;
      unsubscribe.current?.();
      unsubscribe.current = ready.onPlayback?.(event => {
        if (own !== generation.current) return;
        speakingCallback.current?.(turn.turn_id, event === "START");
        setPhase(event === "START" ? "PLAYING" : event === "ERROR" ? "TTS_FAILED" : "IDLE");
      });
      try { await ready.play(); if (own === generation.current) setPhase("PLAYING"); }
      catch { if (own === generation.current) { speakingCallback.current?.(turn.turn_id, false); setPhase("PLAYBACK_BLOCKED"); reportFailure("PLAYBACK_BLOCKED"); } }
    } catch (error) { if (own === generation.current) {
      const code = error instanceof Error && error.message === "TTS_TIMEOUT" ? "TTS_TIMEOUT" : "TTS_FAILED";
      setPhase(code); reportFailure(code);
    } }
    finally { if (own === generation.current) clearTimeout(timer.current); }
  }
  const text = (en: string, arabic: string) => locale === "ar-JO" ? arabic : en;
  const status = !voice ? text("Patient audio is unavailable. You can still read the reply.", "صوت المريض غير متاح. يمكنك قراءة الرد.")
    : muted ? text("Patient audio muted", "صوت المريض مكتوم")
    : phase === "LOADING" ? text("Preparing patient audio…", "جارٍ تجهيز صوت المريض…")
    : phase === "PLAYING" ? text("Playing patient audio", "جارٍ تشغيل صوت المريض")
    : phase === "PLAYBACK_BLOCKED" ? text("Your browser blocked audio. Select Play to try again.", "حظر المتصفح تشغيل الصوت. اختر التشغيل للمحاولة مجدداً.")
    : phase === "TTS_TIMEOUT" ? text("Audio took too long. Try again or read the reply.", "استغرق تجهيز الصوت وقتاً طويلاً. حاول مجدداً أو اقرأ الرد.")
    : phase === "TTS_FAILED" ? text("Patient audio is unavailable. You can still read the reply.", "صوت المريض غير متاح. يمكنك قراءة الرد.")
    : text("Audio ready", "الصوت جاهز");
  return <div className="patient-speech" role="group" aria-label={text("Patient audio", "صوت المريض")} data-voice-phase={phase}>
      <button type="button" disabled={!voice || muted || phase === "LOADING"} onClick={() => void play()}>{phase === "IDLE" || phase === "PLAYBACK_BLOCKED" ? text("Play patient audio", "تشغيل صوت المريض") : text("Replay patient audio", "إعادة تشغيل صوت المريض")}</button>
      <button type="button" aria-pressed={muted} onClick={() => { stop(); setMuted(!muted); setPhase("IDLE"); }}>{muted ? text("Unmute patient audio", "إلغاء كتم صوت المريض") : text("Mute patient audio", "كتم صوت المريض")}</button>
    <span role="status" aria-live="polite" aria-atomic="true">{status}</span>
  </div>;
}
