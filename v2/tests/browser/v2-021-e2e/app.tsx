import { createRoot } from "react-dom/client";
import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { SafeSessionProjectionSchema, SafeLearnerTimelineProjectionSchema,
  SafeAssessmentApiProjectionSchema, PatientConversationTranscriptSchema, SafePatientConversationTurnSchema } from "../../../packages/contracts/src/index.ts";
import "../../../apps/web/src/styles.css";
import { createElevenLabsStudentVoiceServices } from "../../../apps/web/src/features/voice/create-voice-services";
import { createFetchSpeechTokenSource } from "../../../apps/web/src/features/voice/fetch-speech-token";
import { PatientVoiceProfileSchema } from "../../../packages/contracts/src/index.ts";
import { createV2_021QuestionBody } from "../../../runtime/v2-021-review-bootstrap.ts";

// Review-only transport composition. Domain code stays server-side. No clinical fixtures in the browser.
let sequence = 0;
async function read(path: string, body?: unknown) {
  const id = `idempotency.visual.${++sequence}`;
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return await response.json();
}
const services: StudentUiServices = {
  auth: { async resolve() { return { status: "AUTHENTICATED", principal_user_id: "10000000-0000-4000-8000-000000000003", display_name: "Local reviewer" }; } },
  sessions: { async load(id) { const r = await read(`/v1/sessions/${id}/state`); return r.data !== undefined ? { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SafeSessionProjectionSchema.parse(r.data) } : { kind: "API_UNAVAILABLE" }; }, async start() { return { success: false, kind: "UNAUTHORIZED" }; } },
  actions: { async submit(intent) { const id = ++sequence; const r = await read(`/v1/sessions/${intent.session_id}/actions/propose`, {
    command_id: `command.visual.${id}`, action_request_id: `action-request.visual.${id}`, action_id: intent.action.action_id,
    expected_state_version: intent.expected_state_version, parameters: intent.parameters, source: "UI" });
    return r.data !== undefined ? { kind: "COMMITTED", replayed: r.data.replayed, idempotency_key: `idempotency.visual.${sequence}`, committed_event_ids: r.data.committed_event_ids, projection: SafeSessionProjectionSchema.parse(r.data.session) } : { kind: "REJECTED", requires_authoritative_sync: true }; } },
  timeline: { async load(id) { const r = await read(`/v1/sessions/${id}/timeline`); return r.data !== undefined ? { kind: "AVAILABLE", projection: SafeLearnerTimelineProjectionSchema.parse(r.data) } : { kind: "UNAVAILABLE" }; } },
  assessment: { async load(id) { const r = await read(`/v1/sessions/${id}/assessment`); return r.data !== undefined ? { kind: "AVAILABLE", projection: SafeAssessmentApiProjectionSchema.parse(r.data) } : { kind: "PENDING" }; } },
  finalization: { async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: false }; } },
  patient_conversation: {
    async load(id) { const r = await read(`/v1/sessions/${id}/questions`); return r.data !== undefined ? { kind: "AVAILABLE", transcript: PatientConversationTranscriptSchema.parse(r.data) } : { kind: "UNAVAILABLE" }; },
    async submit(intent) { const r = await read(`/v1/sessions/${intent.session_id}/questions`, createV2_021QuestionBody(intent, `utterance.visual.${++sequence}`)); return r.data !== undefined ? { kind: "COMMITTED", replayed: r.data.replayed, turn: SafePatientConversationTurnSchema.parse(r.data.turn) } : { kind: "UNAVAILABLE" }; }
  }
};
const current = await (await fetch("/__review/session")).json();
const voice = current.voice_profile === undefined ? undefined : createElevenLabsStudentVoiceServices({
  patient_voice_profile: PatientVoiceProfileSchema.parse(current.voice_profile),
  token_source: createFetchSpeechTokenSource({ fetch: globalThis.fetch.bind(globalThis), headers: async () => ({}) })
});
if (location.pathname === "/") history.replaceState(null, "", `/sessions/${current.session_id}`);
createRoot(document.getElementById("root")!).render(<App services={{ ...services, ...(voice === undefined ? {} : { voice }) }} />);
