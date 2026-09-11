import { PatientLanguageSchema, VoiceTelemetrySchema, type PatientLanguage,
  type VoiceCapturePhase, type VoiceFailureCode, type VoiceTelemetry } from "@ai-clinical-simulation/contracts";
import type { RecognitionHandle, SpeechAdapter } from "./voice-services";

export type CaptureSnapshot = Readonly<{
  phase: VoiceCapturePhase; partial: string; final: string; failure?: VoiceFailureCode;
}>;
export interface VoiceClock {
  now(): number;
  later(callback: () => void, ms: number): () => void;
}
export const browserVoiceClock: VoiceClock = {
  now: () => performance.now(),
  later(callback, ms) { const id = setTimeout(callback, ms); return () => clearTimeout(id); }
};
/** Presentation-only time. Never supplied to Session/Clinical Engine. */
export function createCaptureController(input: {
  adapter: SpeechAdapter; session_id: string; locale: PatientLanguage;
  utterance_id: string; clock: VoiceClock; changed(snapshot: CaptureSnapshot): void;
  telemetry?(event: VoiceTelemetry): void;
}) {
  let snapshot: CaptureSnapshot = { phase: "IDLE", partial: "", final: "" };
  let generation = 0;
  let handle: RecognitionHandle | undefined;
  let abort: AbortController | undefined;
  let cancelLimit = () => {};
  let cancelFinal = () => {};
  let started = 0;
  let released: number | undefined;
  let firstPartial: number | undefined;
  let tokenLatency: number | undefined;
  let maxDuration = false;
  let permission: VoiceTelemetry["permission_outcome"] = "NOT_REQUESTED";
  const notify = (next: CaptureSnapshot) => { snapshot = Object.freeze(next); input.changed(snapshot); };
  function cleanup() {
    cancelLimit(); cancelFinal(); abort?.abort(); handle?.close(); handle = undefined;
  }
  function telemetry(completion: VoiceTelemetry["completion"], edited = false, failure?: VoiceFailureCode) {
    const parsed = VoiceTelemetrySchema.safeParse({
      voice_schema_version: "1.0", utterance_id: input.utterance_id, locale: input.locale, capability: "STT",
      permission_outcome: permission, completion, edit_occurred: edited,
      ...(permission === "GRANTED" ? { recording_duration_ms: Math.max(0, (released ?? input.clock.now()) - started) } : {}),
      ...(firstPartial === undefined ? {} : { first_partial_latency_ms: firstPartial }),
      ...(tokenLatency === undefined ? {} : { token_latency_ms: tokenLatency }),
      ...(released === undefined ? {} : { final_transcript_latency_ms: Math.max(0, input.clock.now() - released) }),
      ...(failure === undefined ? {} : { failure_code: failure })
    });
    if (parsed.success) { try { input.telemetry?.(parsed.data); } catch { /* telemetry cannot block text */ } }
  }
  function fail(code: VoiceFailureCode) {
    generation += 1; cleanup();
    if (code === "PERMISSION_DENIED") permission = "DENIED";
    if (code === "DEVICE_UNAVAILABLE") permission = "UNAVAILABLE";
    notify({ ...snapshot, phase: "ERROR", failure: code });
    telemetry("FAILED", false, code);
  }
  function finish() {
    generation += 1; cleanup();
    if (snapshot.final.trim()) {
      notify({ ...snapshot, phase: "READY_TO_REVIEW" });
      telemetry(maxDuration ? "MAX_DURATION" : "COMPLETED");
    } else fail(snapshot.partial ? "PARTIAL_ONLY" : "NO_SPEECH");
  }
  function stop() {
    if (snapshot.phase !== "LISTENING") return;
    released = input.clock.now(); cancelLimit();
    notify({ ...snapshot, phase: "PROCESSING_FINAL" });
    cancelFinal = input.clock.later(() => {
      if (snapshot.final.trim()) finish(); else fail("FINAL_TIMEOUT");
    }, 5_000);
    try { handle?.stop(); } catch { fail("RECOGNITION_FAILED"); }
  }
  return Object.freeze({
    snapshot: () => snapshot,
    async start() {
      if (["REQUESTING_PERMISSION", "LISTENING", "PROCESSING_FINAL"].includes(snapshot.phase)) return;
      cleanup(); const own = ++generation; abort = new AbortController();
      firstPartial = undefined; released = undefined; tokenLatency = undefined; maxDuration = false;
      permission = "NOT_REQUESTED";
      if (!PatientLanguageSchema.safeParse(input.locale).success) { fail("INVALID_INPUT"); return; }
      notify({ phase: "REQUESTING_PERMISSION", partial: "", final: "" });
      const alive = () => generation === own;
      cancelLimit = input.clock.later(() => { if (alive()) fail("TOKEN_UNAVAILABLE"); }, 15_000);
      try {
        const active = await input.adapter.recognize({
          session_id: input.session_id, locale: input.locale, signal: abort.signal,
          tokenLatency(ms) { if (alive()) tokenLatency = ms; },
          listening() {
            if (!alive()) return;
            cancelLimit();
            permission = "GRANTED"; started = input.clock.now();
            notify({ ...snapshot, phase: "LISTENING" });
            cancelLimit = input.clock.later(() => { maxDuration = true; stop(); }, 15_000);
          },
          partial(text) {
            if (!alive() || !["LISTENING", "PROCESSING_FINAL"].includes(snapshot.phase)) return;
            firstPartial ??= Math.max(0, input.clock.now() - started);
            notify({ ...snapshot, partial: text.slice(0, 4_000) });
          },
          final(text) {
            if (!alive()) return;
            notify({ ...snapshot, final: [snapshot.final, text].filter(Boolean).join(" ").slice(0, 4_000), partial: "" });
          },
          ended() { if (alive()) finish(); },
          failed(code) { if (alive()) fail(code); }
        });
        if (alive()) { handle = active; if (snapshot.phase === "PROCESSING_FINAL") active.stop(); }
        else active.close();
      } catch { if (alive()) fail("RECOGNITION_FAILED"); }
    },
    stop,
    cancel(code: VoiceFailureCode = "CANCELLED") {
      generation += 1; cleanup(); telemetry("CANCELLED", false, code);
      notify({ phase: "IDLE", partial: "", final: "" });
    },
    review(text: string): string | undefined {
      if (snapshot.phase !== "READY_TO_REVIEW" || !text.trim() || text.length > 4_000) return undefined;
      telemetry("COMPLETED", text !== snapshot.final);
      return text;
    },
    dispose() { generation += 1; cleanup(); }
  });
}
