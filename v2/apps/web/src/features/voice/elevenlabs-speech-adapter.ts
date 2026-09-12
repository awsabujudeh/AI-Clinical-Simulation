import { SpeechTokenResponseSchema } from "@ai-clinical-simulation/contracts";
import type { SpeechAdapter, SpeechTokenSource } from "./voice-services";
import { openPcmMicrophone, type PcmMicrophone } from "./pcm-microphone";
import { TtsDiagnostic, providerTtsDiagnostic } from "./tts-diagnostics";

export interface SpeechBrowserRuntime {
  socket(url: string): WebSocket;
  microphone(signal: AbortSignal, chunk: (pcm: Uint8Array) => void): Promise<PcmMicrophone>;
  audio(bytes: Uint8Array): { play(): Promise<void>; close(): void };
  now(): number;
}
const browserRuntime: SpeechBrowserRuntime = {
  socket: url => new WebSocket(url), microphone: openPcmMicrophone, now: () => Date.now(),
  audio(bytes) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }));
    let player: HTMLAudioElement;
    try { player = new Audio(url); } catch { URL.revokeObjectURL(url); throw new TtsDiagnostic("TTS_PLAYBACK_FAILED"); }
    let closed = false;
    return { async play() {
      try { if (closed) throw Error(); player.currentTime = 0; await player.play(); }
      catch { throw new TtsDiagnostic(player.error?.code === 3 || player.error?.code === 4 ? "TTS_AUDIO_DECODE_FAILED" : "TTS_PLAYBACK_FAILED"); }
    },
      close() { if (closed) return; closed = true; player.pause(); player.removeAttribute("src"); URL.revokeObjectURL(url); } };
  }
};
/** Speech-only official wire protocols. No agent, LLM, tools, fallback or persistent audio. */
export function createElevenLabsSpeechAdapter(tokens: SpeechTokenSource, runtime = browserRuntime): SpeechAdapter {
  // Defensive provider response replay rejection without retaining credential strings.
  const used = new Set<string>();
  async function acquire(request: Parameters<SpeechTokenSource>[0], signal: AbortSignal) {
    const token = SpeechTokenResponseSchema.parse(await tokens(request, signal));
    if (signal.aborted) throw Error("CANCELLED");
    if (token.session_id !== request.session_id || token.locale !== request.locale || token.capability !== request.capability) throw Error("TOKEN_UNAVAILABLE");
    if (token.expires_at_ms - runtime.now() < 30_000) throw Error("TOKEN_EXPIRED");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token.single_use_token));
    const id = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
    if (used.has(id) || used.size >= 512 || signal.aborted) throw Error("TOKEN_UNAVAILABLE");
    used.add(id); return token;
  }
  return {
    async recognize(input) {
      let socket: WebSocket | undefined; let mic: PcmMicrophone | undefined;
      let closed = false; let stopping = false; let started = false;
      const close = () => { if (closed) return; closed = true; input.signal.removeEventListener("abort", close); mic?.close(); socket?.close(); };
      const fail = (code: "TOKEN_UNAVAILABLE" | "TOKEN_EXPIRED" | "RECOGNITION_FAILED" | "PERMISSION_DENIED" | "DEVICE_UNAVAILABLE") => {
        if (closed) return; close(); if (!input.signal.aborted) input.failed(code);
      };
      const handle = { close, stop() {
        if (closed || stopping) return; stopping = true;
        void (async () => {
          try { await mic?.stop(); if (!closed) socket!.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", sample_rate: 16000, commit: true })); }
          catch { fail("RECOGNITION_FAILED"); }
        })();
      } };
      input.signal.addEventListener("abort", close, { once: true });
      const began = runtime.now();
      try {
        const token = await acquire({ session_id: input.session_id as never, locale: input.locale, capability: "STT" }, input.signal);
        if (token.capability !== "STT" || closed) { close(); return handle; }
        input.tokenLatency(runtime.now() - began);
        const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
        url.searchParams.set("token", token.single_use_token); url.searchParams.set("model_id", token.model_id);
        url.searchParams.set("language_code", token.language_code);
        for (const code of token.secondary_languages) url.searchParams.append("secondary_languages", code);
        url.searchParams.set("audio_format", "pcm_16000"); url.searchParams.set("commit_strategy", "manual");
        socket = runtime.socket(url.toString());
        socket.onerror = () => fail("RECOGNITION_FAILED");
        socket.onclose = () => { if (!closed) fail("RECOGNITION_FAILED"); };
        socket.onmessage = event => {
          if (closed) return;
          try {
            if (typeof event.data !== "string" || event.data.length > 65536) throw Error();
            const message = JSON.parse(event.data);
            if (message.message_type === "session_started" && !started) {
              started = true;
              void runtime.microphone(input.signal, pcm => {
                if (closed) return;
                try {
                  if (socket!.bufferedAmount > 256000) throw Error();
                  let binary = ""; for (const byte of pcm) binary += String.fromCharCode(byte);
                  socket!.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: btoa(binary), sample_rate: 16000 }));
                } catch { fail("RECOGNITION_FAILED"); }
              }).then(value => { mic = value; if (closed || input.signal.aborted) value.close(); else { input.listening(); if (stopping) void value.stop(); } })
                .catch(error => fail(error instanceof DOMException && error.name === "NotAllowedError" ? "PERMISSION_DENIED" : "DEVICE_UNAVAILABLE"));
            } else if (message.message_type === "partial_transcript" || message.message_type === "final_transcript") {
              if (typeof message.text !== "string" || message.text.length > 4000) throw Error();
              if (started) input.partial(message.text); // final_transcript is still NOT committed.
            } else if (message.message_type === "committed_transcript") {
              if (!stopping || !started || typeof message.text !== "string" || message.text.length > 4000) throw Error();
              input.final(message.text); close(); input.ended();
            } else if (message.message_type !== "warning") throw Error();
          } catch { fail("RECOGNITION_FAILED"); }
        };
      } catch (error) { fail(error instanceof Error && error.message === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "TOKEN_UNAVAILABLE"); }
      return handle;
    },
    async synthesize(input) {
      if (!input.text.trim() || input.text.length > 4000) throw new TtsDiagnostic("TTS_PROTOCOL_ERROR");
      const began = runtime.now();
      let token;
      try { token = await acquire({ session_id: input.session_id as never, locale: input.locale, capability: "TTS", voice_profile_id: input.voice_profile_id }, input.signal); }
      catch { throw new TtsDiagnostic("TTS_TOKEN_UNAVAILABLE"); }
      if (token.capability !== "TTS" || token.voice_id !== input.voice_id || token.voice_profile_id !== input.voice_profile_id) throw new TtsDiagnostic("TTS_TOKEN_UNAVAILABLE");
      return new Promise((resolve, reject) => {
        let socket: WebSocket; let settled = false; let opened = false; let bytes = 0; let first = true;
        let pendingError: TtsDiagnostic | undefined; let closeTimer: ReturnType<typeof setTimeout> | undefined;
        const chunks: Uint8Array[] = [];
        const timer = setTimeout(() => fail(pendingError ?? new TtsDiagnostic("TTS_TIMEOUT")), 10000);
        const release = () => { clearTimeout(timer); clearTimeout(closeTimer); input.signal.removeEventListener("abort", abort); socket?.close(); };
        const fail = (error: TtsDiagnostic) => { if (settled) return; settled = true; release(); chunks.length = 0; reject(error); };
        // A provider error precedes its close frame. Briefly retain ONLY sanitized metadata,
        // never audio/raw error text, so the peer's numeric close code is not lost.
        const awaitClose = (error: TtsDiagnostic) => {
          if (settled || pendingError) return; pendingError = error; chunks.length = 0;
          closeTimer = setTimeout(() => fail(error), 250);
        };
        const abort = () => fail(new TtsDiagnostic("TTS_PROTOCOL_ERROR"));
        input.signal.addEventListener("abort", abort, { once: true });
        try {
          if (input.signal.aborted) { abort(); return; }
          const url = new URL("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input");
          url.searchParams.set("model_id", token.model_id); url.searchParams.set("output_format", "mp3_44100_128");
          socket = runtime.socket(url.toString());
          socket.onopen = () => {
            if (settled || pendingError || opened) return; opened = true;
            try {
              socket.send(JSON.stringify({ voices: [token.voice_id], single_use_token: token.single_use_token }));
              socket.send(JSON.stringify({ inputs: [{ text: input.text, voice_id: token.voice_id }] }));
              socket.send(JSON.stringify({ close_socket: true }));
            } catch { fail(new TtsDiagnostic("TTS_PROTOCOL_ERROR")); }
          };
          // Browser handshake errors are opaque: do not guess authentication from code 1006.
          socket.onerror = () => awaitClose(new TtsDiagnostic("TTS_WEBSOCKET_CONNECT_FAILED"));
          socket.onclose = event => {
            if (settled) return;
            const code = pendingError?.code ?? (event.code === 1011 ? "TTS_PROVIDER_ERROR"
              : !opened || event.code === 1006 ? "TTS_WEBSOCKET_CONNECT_FAILED" : "TTS_PROTOCOL_ERROR");
            fail(new TtsDiagnostic(code, { closeCode: event.code, providerCode: pendingError?.providerCode }));
          };
          socket.onmessage = event => {
            if (settled || pendingError) return;
            try {
              if (typeof event.data !== "string" || event.data.length > 6000000) throw Error();
              const message = JSON.parse(event.data);
              if (!message || typeof message !== "object" || Array.isArray(message)) throw Error();
              if (message.error) {
                awaitClose(providerTtsDiagnostic(message.code ?? message.error?.code ?? message.error?.type ?? message.error)); return;
              }
              if (!opened || (message.audio !== undefined && typeof message.audio !== "string")
                || (message.is_final !== undefined && typeof message.is_final !== "boolean")
                || (message.is_final_audio_for_turn !== undefined && typeof message.is_final_audio_for_turn !== "boolean")) throw Error();
              if (message.audio === undefined && message.is_final !== true && message.is_final_audio_for_turn !== true) throw Error();
              if (typeof message.audio === "string" && message.audio.length) {
                let binary: string;
                try { binary = atob(message.audio); } catch { fail(new TtsDiagnostic("TTS_AUDIO_DECODE_FAILED")); return; }
                bytes += binary.length;
                if (bytes > 4000000) throw Error();
                chunks.push(Uint8Array.from(binary, c => c.charCodeAt(0)));
                if (first) { first = false; input.firstAudio(runtime.now() - began); }
              }
              if (message.is_final === true) {
                if (!bytes) throw Error();
                const result = new Uint8Array(bytes); let offset = 0;
                for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
                let audio;
                try { audio = runtime.audio(result); } catch { fail(new TtsDiagnostic("TTS_PLAYBACK_FAILED")); return; }
                settled = true; release(); chunks.length = 0; resolve(audio);
              }
            } catch { fail(new TtsDiagnostic("TTS_PROTOCOL_ERROR")); }
          };
        } catch { fail(new TtsDiagnostic("TTS_WEBSOCKET_CONNECT_FAILED")); }
      });
    }
  };
}
