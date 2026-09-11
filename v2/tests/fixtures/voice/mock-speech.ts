import type { SpeechAdapter } from "../../../apps/web/src/features/voice/voice-services.ts";
import type { VoiceClock } from "../../../apps/web/src/features/voice/capture-controller.ts";
import { PatientVoiceProfileSchema } from "../../../packages/contracts/src/voice.ts";
export const SYNTHETIC_VOICE_PROFILE = PatientVoiceProfileSchema.parse({
  profile_id: "voice-profile.synthetic", profile_version: "2.0", provider: "ELEVENLABS", model_id: "eleven_v3_conversational",
  voices: { "ar-JO": "syntheticArabicVoice", "en-US": "syntheticEnglishVoice" }
});
export function mockSpeech() {
  let listener: Parameters<SpeechAdapter["recognize"]>[0] | undefined;
  const counters = { closed: 0, stops: 0, plays: 0, audio_closed: 0 };
  const synthesis: Parameters<SpeechAdapter["synthesize"]>[0][] = [];
  const adapter: SpeechAdapter = {
    async recognize(input) {
      listener = input; input.tokenLatency(10); input.listening();
      return { close() { counters.closed++; }, stop() { counters.stops++; } };
    },
    async synthesize(input) {
      synthesis.push(input); input.firstAudio(20);
      return { async play() { counters.plays++; }, close() { counters.audio_closed++; } };
    }
  };
  return { adapter, counters, synthesis, listener: () => listener! };
}
export function fakeVoiceClock() {
  let time = 0;
  const tasks = new Set<{ at: number; callback(): void }>();
  const clock: VoiceClock = {
    now: () => time,
    later(callback, ms) { const task = { at: time + ms, callback }; tasks.add(task); return () => { tasks.delete(task); }; }
  };
  return { clock, advance(ms: number) {
    const end = time + ms;
    while (true) {
      const task = [...tasks].sort((a, b) => a.at - b.at)[0];
      if (!task || task.at > end) break;
      tasks.delete(task); time = task.at; task.callback();
    }
    time = end;
  } };
}
