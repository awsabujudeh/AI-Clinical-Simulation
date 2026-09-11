import { SpeechTokenResponseSchema } from "@ai-clinical-simulation/contracts";
import type { SpeechAdapter, SpeechTokenSource } from "./voice-services";
import { openPcmMicrophone, type PcmMicrophone } from "./pcm-microphone";

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
    const player = new Audio(url); let closed = false;
    return { async play() { if (closed) throw Error("TTS_FAILED"); player.currentTime = 0; await player.play(); },
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
      if (!input.text.trim() || input.text.length > 4000) throw Error("TTS_FAILED");
      const began = runtime.now();
      let token;
      try { token = await acquire({ session_id: input.session_id as never, locale: input.locale, capability: "TTS", voice_profile_id: input.voice_profile_id }, input.signal); }
      catch { throw Error("TTS_FAILED"); }
      if (token.capability !== "TTS" || token.voice_id !== input.voice_id || token.voice_profile_id !== input.voice_profile_id) throw Error("TTS_FAILED");
      return new Promise((resolve, reject) => {
        let socket: WebSocket; let settled = false; let bytes = 0; let first = true; const chunks: Uint8Array[] = [];
        const timer = setTimeout(() => fail("TTS_TIMEOUT"), 10000);
        const release = () => { clearTimeout(timer); input.signal.removeEventListener("abort", abort); socket?.close(); };
        const fail = (code = "TTS_FAILED") => { if (settled) return; settled = true; release(); chunks.length = 0; reject(Error(code)); };
        const abort = () => fail();
        input.signal.addEventListener("abort", abort, { once: true });
        try {
          if (input.signal.aborted) { fail(); return; }
          const url = new URL("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input");
          url.searchParams.set("model_id", token.model_id); url.searchParams.set("output_format", "mp3_44100_128");
          socket = runtime.socket(url.toString());
          socket.onopen = () => {
            if (settled) return;
            try {
              socket.send(JSON.stringify({ voices: [token.voice_id], single_use_token: token.single_use_token }));
              socket.send(JSON.stringify({ inputs: [{ text: input.text, voice_id: token.voice_id }], close_socket: true }));
            } catch { fail(); }
          };
          socket.onerror = () => fail(); socket.onclose = () => { if (!settled) fail(); };
          socket.onmessage = event => {
            if (settled) return;
            try {
              if (typeof event.data !== "string" || event.data.length > 6000000) throw Error();
              const message = JSON.parse(event.data);
              if (message.error) throw Error();
              if (typeof message.audio === "string" && message.audio.length) {
                const binary = atob(message.audio); bytes += binary.length;
                if (bytes > 4000000) throw Error();
                chunks.push(Uint8Array.from(binary, c => c.charCodeAt(0)));
                if (first) { first = false; input.firstAudio(runtime.now() - began); }
              }
              if (message.is_final === true) {
                if (!bytes) throw Error();
                const result = new Uint8Array(bytes); let offset = 0;
                for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
                const audio = runtime.audio(result); settled = true; release(); chunks.length = 0; resolve(audio);
              }
            } catch { fail(); }
          };
        } catch { fail(); }
      });
    }
  };
}
