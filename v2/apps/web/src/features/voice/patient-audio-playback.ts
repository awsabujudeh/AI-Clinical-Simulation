import type { PatientAudioHandle, PatientPlaybackEvent } from "./voice-services";

/** Actual media events, not text readiness, buffering, or estimated speech duration. */
export function observePatientAudio(player: HTMLAudioElement, release: () => void): PatientAudioHandle {
  const listeners = new Set<(event: PatientPlaybackEvent) => void>(); let closed = false;
  const emit = (value: PatientPlaybackEvent) => { for (const listener of listeners) listener(value); };
  const playing = () => emit("START"); const ended = () => emit("END");
  const paused = () => emit("CANCEL"); const error = () => emit("ERROR");
  player.addEventListener("playing", playing); player.addEventListener("ended", ended);
  player.addEventListener("pause", paused); player.addEventListener("error", error);
  return {
    async play() { if (closed) throw Error("PLAYBACK_CLOSED"); player.currentTime = 0; await player.play(); },
    onPlayback(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    close() { if (closed) return; closed = true; player.pause(); emit("CANCEL");
      player.removeEventListener("playing", playing); player.removeEventListener("ended", ended);
      player.removeEventListener("pause", paused); player.removeEventListener("error", error);
      listeners.clear(); player.removeAttribute("src"); release(); }
  };
}
