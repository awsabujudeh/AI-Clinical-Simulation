import { useEffect, useRef, useState } from "react";
import { PatientVoiceProfileSchema, SafePatientConversationTurnSchema, VoiceTelemetrySchema,
  type SafePatientConversationTurn, type VoiceFailureCode } from "@ai-clinical-simulation/contracts";
import type { StudentVoiceServices } from "./voice-services";

export function PatientSpeech({ voice, turn }: { voice?: StudentVoiceServices; turn: SafePatientConversationTurn }) {
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState("IDLE");
  const generation = useRef(0);
  const active = useRef<AbortController | undefined>(undefined);
  const audio = useRef<{ play(): Promise<void>; close(): void } | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textReadyAt = useRef(performance.now());
  function reportFailure(code: VoiceFailureCode) {
    const event = VoiceTelemetrySchema.safeParse({ voice_schema_version: "1.0", utterance_id: `tts.${turn.turn_id}`,
      locale: turn.locale, capability: "TTS", permission_outcome: "NOT_REQUESTED",
      completion: "FAILED", edit_occurred: false, failure_code: code });
    if (event.success) { try { voice?.telemetry?.(event.data); } catch { /* optional telemetry */ } }
  }
  function stop() { generation.current += 1; active.current?.abort(); audio.current?.close(); audio.current = undefined; clearTimeout(timer.current); }
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
      try { await ready.play(); if (own === generation.current) setPhase("PLAYING"); }
      catch { if (own === generation.current) { setPhase("PLAYBACK_BLOCKED"); reportFailure("PLAYBACK_BLOCKED"); } }
    } catch (error) { if (own === generation.current) {
      const code = error instanceof Error && error.message === "TTS_TIMEOUT" ? "TTS_TIMEOUT" : "TTS_FAILED";
      setPhase(code); reportFailure(code);
    } }
    finally { if (own === generation.current) clearTimeout(timer.current); }
  }
  return <div className="patient-speech">
    <button type="button" disabled={!voice || muted || phase === "LOADING"} onClick={() => void play()}>{phase === "IDLE" || phase === "PLAYBACK_BLOCKED" ? "Play patient audio" : "Replay patient audio"}</button>
    <button type="button" aria-pressed={muted} onClick={() => { stop(); setMuted(!muted); setPhase("IDLE"); }}>{muted ? "Unmute patient audio" : "Mute patient audio"}</button>
    <span role="status">{phase}</span>
  </div>;
}
