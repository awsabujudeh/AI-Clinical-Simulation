import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { SpeechTokenResponseSchema } from "@ai-clinical-simulation/contracts";
import type { SpeechAdapter, SpeechTokenSource } from "./voice-services";

export const AR_JO_PHRASE_HINTS = Object.freeze(["ECG", "troponin", "aspirin"]);
/** Browser infrastructure. No subscription keys, storage, language detection, or execution API. */
export function createAzureSpeechAdapter(tokens: SpeechTokenSource): SpeechAdapter {
  SpeechSDK.SpeechRecognizer.enableTelemetry(false);
  async function config(sessionId: string, locale: "ar-JO" | "en-US", capability: "STT" | "TTS", signal: AbortSignal) {
    const token = SpeechTokenResponseSchema.parse(await tokens({ session_id: sessionId as never, locale: locale as never, capability }, signal));
    if (signal.aborted) throw new Error("CANCELLED");
    if (token.session_id !== sessionId || token.locale !== locale || token.capability !== capability) throw new Error("TOKEN_UNAVAILABLE");
    if (token.expires_at_ms - Date.now() < 30_000) throw new Error("TOKEN_EXPIRED");
    return SpeechSDK.SpeechConfig.fromAuthorizationToken(token.authorization_token, token.region);
  }
  return {
    async recognize(input) {
      const started = performance.now();
      let recognizer: SpeechSDK.SpeechRecognizer | undefined;
      let audio: SpeechSDK.AudioConfig | undefined;
      let stream: MediaStream | undefined;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true; input.signal.removeEventListener("abort", close);
        stream?.getTracks().forEach((track) => track.stop());
        recognizer?.close(); audio?.close();
      };
      const handle = {
        close,
        stop() {
          if (!closed) recognizer?.stopContinuousRecognitionAsync(
            () => { stream?.getTracks().forEach((track) => track.stop()); input.ended(); },
            () => { close(); input.failed("RECOGNITION_FAILED"); }
          );
        }
      };
      input.signal.addEventListener("abort", close, { once: true });
      let speechConfig: SpeechSDK.SpeechConfig;
      try {
        speechConfig = await config(input.session_id, input.locale, "STT", input.signal);
        input.tokenLatency(performance.now() - started);
      } catch (error) {
        close(); if (!input.signal.aborted) input.failed(error instanceof Error && error.message === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "TOKEN_UNAVAILABLE");
        return handle;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (closed || input.signal.aborted) { stream.getTracks().forEach((track) => track.stop()); return handle; }
        speechConfig.speechRecognitionLanguage = input.locale;
        // Disable SDK audio/content telemetry; only our whitelisted timing events may leave this adapter.
        SpeechSDK.SpeechRecognizer.enableTelemetry(false);
        audio = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audio);
        if (input.locale === "ar-JO") SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer).addPhrases([...AR_JO_PHRASE_HINTS]);
        recognizer.recognizing = (_sender, event) => { if (!closed) input.partial(event.result.text); };
        recognizer.recognized = (_sender, event) => {
          if (!closed && event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && event.result.text) input.final(event.result.text);
        };
        recognizer.canceled = () => { if (!closed) { close(); input.failed("RECOGNITION_FAILED"); } };
        recognizer.sessionStopped = () => { if (!closed) input.ended(); };
        recognizer.startContinuousRecognitionAsync(() => { if (!closed) input.listening(); }, () => { close(); input.failed("RECOGNITION_FAILED"); });
      } catch (error) {
        close(); if (!input.signal.aborted) input.failed(error instanceof DOMException && error.name === "NotAllowedError"
          ? "PERMISSION_DENIED" : "DEVICE_UNAVAILABLE");
      }
      return handle;
    },
    async synthesize(input) {
      const started = performance.now();
      const speechConfig = await config(input.session_id, input.locale, "TTS", input.signal);
      speechConfig.speechSynthesisVoiceName = input.voice_id;
      speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
      // Null output prevents SDK auto-speaker playback. The UI owns mute/play and autoplay failure.
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null as unknown as SpeechSDK.AudioConfig);
      return new Promise((resolve, reject) => {
        let settled = false;
        let first = false;
        const timer = setTimeout(() => fail("TTS_TIMEOUT"), 10_000);
        const abort = () => fail("CANCELLED");
        function release() { clearTimeout(timer); input.signal.removeEventListener("abort", abort); synthesizer.close(); }
        function fail(code: string) { if (settled) return; settled = true; release(); reject(new Error(code)); }
        input.signal.addEventListener("abort", abort, { once: true });
        if (input.signal.aborted) { fail("CANCELLED"); return; }
        synthesizer.synthesizing = () => {
          if (!first && !settled) { first = true; input.firstAudio(performance.now() - started); }
        };
        synthesizer.speakTextAsync(input.text, (result) => {
          if (settled) return;
          if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted || result.audioData.byteLength === 0
            || result.audioData.byteLength > 4_000_000) { fail("TTS_FAILED"); return; }
          settled = true; release();
          const url = URL.createObjectURL(new Blob([result.audioData], { type: "audio/mpeg" }));
          const player = new Audio(url);
          let disposed = false;
          resolve({
            async play() { if (disposed) throw new Error("TTS_FAILED"); player.currentTime = 0; await player.play(); },
            close() { if (disposed) return; disposed = true; player.pause(); player.removeAttribute("src"); URL.revokeObjectURL(url); }
          });
        }, () => fail("TTS_FAILED"));
      });
    }
  };
}
