import { useEffect, useMemo, useRef, useState } from "react";
import { PatientLanguageSchema, PatientVoiceProfileSchema, SpeechTokenResponseSchema, type PatientVoiceProfile, type VoiceTelemetry } from "@ai-clinical-simulation/contracts";
import { createElevenLabsSpeechAdapter } from "./elevenlabs-speech-adapter";
import { browserVoiceClock, createCaptureController, type CaptureSnapshot, type VoiceClock } from "./capture-controller";
import type { SpeechAdapter, SpeechTokenSource } from "./voice-services";

export const SMOKE_REFERENCE = "الألم بلش معي من حوالي ساعة وبحس إنه ضاغط على صدري";
const HOST = "http://127.0.0.1:4183/__diagnostic/voice-smoke";
export function createSmokeTokenSource(outcome: (value: string) => void, transport: typeof fetch = fetch): SpeechTokenSource {
  return async (request, signal) => {
    outcome("REQUESTING");
    try {
      const response = await transport(`${HOST}/token`, {
        method: "POST", mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", signal,
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(request)
      });
      if (!response.ok) throw Error();
      const parsed = SpeechTokenResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw Error();
      outcome("TOKEN_RECEIVED; single use, binding/freshness checked by adapter"); return parsed.data;
    } catch { outcome("TOKEN_UNAVAILABLE"); throw Error("TOKEN_UNAVAILABLE"); }
  };
}

/** DEV entry only; test injection uses synthetic profiles/adapter/clock. No clinical submission. */
export function VoiceSmoke({ adapter, clock = browserVoiceClock, profiles: supplied }: {
  adapter?: SpeechAdapter; clock?: VoiceClock; profiles?: PatientVoiceProfile[];
}) {
  const [snapshot, setSnapshot] = useState<CaptureSnapshot>({ phase: "IDLE", partial: "", final: "" });
  const [token, setToken] = useState("NOT_REQUESTED");
  const [metrics, setMetrics] = useState<VoiceTelemetry>();
  const [edited, setEdited] = useState(""); const [explicitStop, setExplicitStop] = useState(false);
  const [profiles, setProfiles] = useState<PatientVoiceProfile[]>(supplied ?? []);
  const [profileId, setProfileId] = useState(supplied?.[0]?.profile_id ?? "");
  const [tts, setTts] = useState("NOT_REQUESTED"); const [firstAudio, setFirstAudio] = useState<number>();
  const audio = useRef<Awaited<ReturnType<SpeechAdapter["synthesize"]>> | undefined>(undefined);
  const attempt = useRef<AbortController | undefined>(undefined);
  const speech = useMemo(() => adapter ?? createElevenLabsSpeechAdapter(createSmokeTokenSource(setToken)), [adapter]);
  const controller = useMemo(() => createCaptureController({ adapter: speech, clock,
    session_id: "session.voice-smoke", utterance_id: "utterance.voice-smoke", locale: PatientLanguageSchema.parse("ar-JO"),
    changed(next) { setSnapshot(next); if (next.phase === "READY_TO_REVIEW") setEdited(next.final); },
    telemetry: setMetrics
  }), [speech, clock]);
  useEffect(() => {
    if (supplied) return;
    const abort = new AbortController();
    void fetch(`${HOST}/profiles`, { mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw Error();
        const body = await response.json() as { profiles: unknown };
        if (!Array.isArray(body.profiles) || body.profiles.length > 8) throw Error();
        const safe = body.profiles.map(x => PatientVoiceProfileSchema.parse(x));
        if (!abort.signal.aborted) { setProfiles(safe); setProfileId(safe[0]?.profile_id ?? ""); }
      }).catch(() => { /* Safe text-only mode; no provider request. */ });
    return () => abort.abort();
  }, [supplied]);
  useEffect(() => () => { controller.dispose(); attempt.current?.abort(); audio.current?.close(); }, [controller]);
  const active = ["REQUESTING_PERMISSION", "LISTENING", "PROCESSING_FINAL"].includes(snapshot.phase);
  const permission = metrics?.permission_outcome ?? (["LISTENING", "PROCESSING_FINAL"].includes(snapshot.phase) ? "GRANTED" : "NOT_REQUESTED");
  const stopAudio = () => { attempt.current?.abort(); audio.current?.close(); audio.current = undefined; setTts("MUTED"); };
  const play = async () => {
    try { await audio.current?.play(); setTts("PLAYING"); } catch { setTts("PLAY_REQUIRED"); }
  };
  const generate = async () => {
    stopAudio(); const profile = profiles.find(x => x.profile_id === profileId); if (!profile) return;
    const abort = new AbortController(); attempt.current = abort; setFirstAudio(undefined); setTts("GENERATING");
    try {
      const result = await speech.synthesize({ session_id: "session.voice-smoke", locale: PatientLanguageSchema.parse("ar-JO"),
        voice_id: profile.voices["ar-JO"], voice_profile_id: profile.profile_id, text: SMOKE_REFERENCE,
        signal: abort.signal, firstAudio: setFirstAudio });
      if (abort.signal.aborted) { result.close(); return; }
      audio.current = result; await play();
    } catch { if (!abort.signal.aborted) setTts("TTS_UNAVAILABLE"); }
  };
  return <main style={{ maxWidth: 760, margin: "2rem auto", padding: "1rem" }}>
    <h1>Local ElevenLabs Voice smoke</h1>
    <p>Synthetic educational content only. No PHI. Provider retention may apply; Zero Retention is not claimed.</p>
    <p>ar-JO · 15-second maximum · text stays on this page. No automatic recording.</p>
    <p>Speak naturally after permission. Reference for manual comparison and exact-text TTS:</p>
    <blockquote lang="ar-JO" dir="rtl">{SMOKE_REFERENCE}</blockquote>
    <p>Review meaning: pain, approximately one hour, pressure/tightness, chest. Spelling alone is not the criterion.</p>
    <button disabled={active || tts === "GENERATING"} onClick={() => { stopAudio(); setToken("NOT_REQUESTED"); setMetrics(undefined); setEdited(""); setExplicitStop(false); void controller.start(); }}>Start recording</button>{" "}
    <button disabled={snapshot.phase !== "LISTENING"} onClick={() => { setExplicitStop(true); controller.stop(); }}>Stop recording</button>{" "}
    <button onClick={() => { controller.cancel(); setEdited(""); }}>Cancel / clear</button>
    <dl>
      <dt>Current recognition outcome</dt><dd>{snapshot.phase}</dd>
      <dt>Permission status (capture started)</dt><dd>{permission}</dd>
      <dt>Token outcome</dt><dd>{token}</dd>
      <dt>Capture started → first partial (ms; available at settlement)</dt><dd>{metrics?.first_partial_latency_ms ?? "not measured"}</dd>
      <dt>Explicit Stop → final settlement (ms)</dt><dd>{explicitStop ? metrics?.final_transcript_latency_ms ?? "not measured" : "not measured (no explicit Stop)"}</dd>
      <dt>Safe error code</dt><dd>{snapshot.failure ?? "NONE"}</dd>
      <dt>Partial transcript — display only</dt><dd dir="auto">{snapshot.partial || "—"}</dd>
      <dt>Final transcript</dt><dd dir="auto">{snapshot.final || "—"}</dd>
    </dl>
    <label>Editable final transcript (local only)<textarea aria-label="Editable final transcript" dir="auto" rows={4} maxLength={4000}
      disabled={snapshot.phase !== "READY_TO_REVIEW"} value={edited} onChange={event => setEdited(event.target.value)} /></label>
    <h2>Exact-text Patient TTS diagnostic</h2>
    <p>Only the fixed synthetic reference above is sent. The editable transcript is never submitted or synthesized.</p>
    <label>Trusted voice profile <select aria-label="Trusted voice profile" value={profileId} disabled={tts === "GENERATING"} onChange={event => { stopAudio(); setProfileId(event.target.value); }}>
      {profiles.map(profile => <option key={profile.profile_id} value={profile.profile_id}>{profile.profile_id}</option>)}
    </select></label>{" "}
    <button disabled={active || !profileId || tts === "GENERATING"} onClick={() => void generate()}>Generate TTS</button>{" "}
    <button disabled={!audio.current} onClick={() => void play()}>Play / replay</button>{" "}
    <button onClick={stopAudio}>Mute / discard audio</button>
    {!profiles.length && <p>TTS is unavailable until trusted voice IDs are configured locally.</p>}
    <p>TTS outcome: {tts}. First audio: {firstAudio ?? "not measured"} ms. Model: eleven_v3_conversational.</p>
    <p>No Patient/Interpreter submission exists. Closing this page discards text/audio and closes capture.</p>
  </main>;
}
