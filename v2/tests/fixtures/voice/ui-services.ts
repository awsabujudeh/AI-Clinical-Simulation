import { ClinicalInterpretationSchema, SafePatientConversationTurnSchema } from "../../../packages/contracts/src/index.ts";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { SYNTHETIC_SAFE_SESSION } from "../student-ui/safe-session.ts";
import { mockSpeech, SYNTHETIC_VOICE_PROFILE } from "./mock-speech.ts";
export function voiceUiHarness(scenario = "success") {
  const speech = mockSpeech(); const calls = { questions: 0, interpretations: 0, executions: 0, text: "", source: "" };
  const baseRecognize = speech.adapter.recognize;
  speech.adapter.recognize = async input => {
    const handle = await baseRecognize(input);
    if (scenario === "permission") input.failed("PERMISSION_DENIED");
    if (scenario === "token") input.failed("TOKEN_UNAVAILABLE");
    return handle;
  };
  const synthesize = speech.adapter.synthesize;
  speech.adapter.synthesize = async input => {
    if (scenario === "tts-fail") throw Error("TTS_FAILED");
    if (scenario === "tts-timeout") return new Promise(() => {});
    const player = await synthesize(input);
    if (scenario === "blocked") return { ...player, async play() { throw Error("NotAllowedError"); } };
    return player;
  };
  const services: StudentUiServices = {
    auth: { async resolve() { return { status: "AUTHENTICATED", principal_user_id: "20000000-0000-4000-8000-000000000015" }; } },
    sessions: { async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_SAFE_SESSION }; }, async start() { return { success: false, kind: "INVALID" }; } },
    actions: { async submit() { calls.executions++; return { kind: "UNAVAILABLE", requires_authoritative_sync: false }; } },
    timeline: { async load() { return { kind: "UNAVAILABLE" }; } }, assessment: { async load() { return { kind: "PENDING" }; } },
    finalization: { async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: false }; } },
    ...(scenario === "disabled" ? {} : { voice: { adapter: speech.adapter, profile: SYNTHETIC_VOICE_PROFILE } }),
    patient_conversation: {
      async load(sessionId) { return { kind: "AVAILABLE", transcript: { conversation_schema_version: "1.0", session_id: sessionId as never, turns: [] } }; },
      async submit(intent) {
        calls.questions++; calls.text = intent.text; calls.source = intent.source;
        if (scenario === "patient-fail") return { kind: "UNAVAILABLE" };
        return { kind: "COMMITTED", replayed: false, turn: SafePatientConversationTurnSchema.parse({
          conversation_schema_version: "1.0", turn_id: `conversation-turn.voice.${calls.questions}`, session_id: intent.session_id,
          turn_sequence: calls.questions, clinical_time: 125, grounded_state_version: 3, locale: intent.locale, source: intent.source,
          utterance_id: "utterance.voice.ui", learner_utterance: intent.text, patient_utterance: "Approved synthetic patient reply.",
          answer_mode: "GROUNDED", fallback_used: false, grounding_fact_ids: [], grounding_state_refs: [],
          question_event_id: "00000000-0000-4000-8000-000000000191", response_event_id: "00000000-0000-4000-8000-000000000192"
        }) };
      }
    },
    clinical_interpreter: { async interpret(intent) {
      calls.interpretations++; calls.text = intent.text;
      if (scenario === "interpreter-fail") throw Error("unavailable");
      return { kind: "COMPLETED", grounded_state_version: SYNTHETIC_SAFE_SESSION.state_version,
        interpretation: ClinicalInterpretationSchema.parse({ interpretation_schema_version: "1.0", authority: "NON_AUTHORITATIVE", status: "MATCH",
          candidate: { action_id: "medication.synthetic-study-agent", parameters: { dose: 10, unit: "unit.synthetic-small", route: "route.synthetic-a" }, unresolved_required_parameters: [], confirmation_policy: "EXPLICIT_ADMINISTRATION" } }) };
    } }
  };
  return { services, speech, calls };
}
