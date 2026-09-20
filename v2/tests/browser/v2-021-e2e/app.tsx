import { createRoot } from "react-dom/client";
import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { SafeSessionProjectionSchema, SafeLearnerTimelineProjectionSchema,
  SafeAssessmentApiProjectionSchema, PatientConversationTranscriptSchema, SafePatientConversationTurnSchema, SafeInvestigationProjectionSchema } from "../../../packages/contracts/src/index.ts";
import "../../../apps/web/src/styles.css";
import { createElevenLabsStudentVoiceServices } from "../../../apps/web/src/features/voice/create-voice-services";
import { createFetchSpeechTokenSource } from "../../../apps/web/src/features/voice/fetch-speech-token";
import { PatientVoiceProfileSchema } from "../../../packages/contracts/src/index.ts";
import { createV2_021QuestionBody, createV2_021RequestIdentity } from "../../../runtime/v2-021-review-bootstrap.ts";
import { createStudentTutorService } from "../../../apps/web/src/features/assessment/tutor-service.ts";

// Review-only transport composition. Domain code stays server-side. No clinical fixtures in the browser.
const current = await (await fetch("/__review/session")).json();
const requestId = createV2_021RequestIdentity(current.review_namespace, crypto.randomUUID());
let sequence = 0;
async function read(path: string, body?: unknown) {
  const id = requestId("idempotency", ++sequence);
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return await response.json();
}
const services: StudentUiServices = {
  ...(current.tutor_enabled ? { tutor: createStudentTutorService(read) } : {}),
  investigations: { async load(sessionId, resultId) {
    const r = await read(`/v1/sessions/${encodeURIComponent(sessionId)}/investigations/${encodeURIComponent(resultId)}`);
    const parsed = SafeInvestigationProjectionSchema.safeParse(r.data);
    return parsed.success ? { kind: "AVAILABLE", projection: parsed.data }
      : { kind: r.error?.code === "RESULT_PENDING" ? "PENDING" : "UNAVAILABLE" };
  } },
  auth: { async resolve() { return { status: "AUTHENTICATED", principal_user_id: "10000000-0000-4000-8000-000000000003", display_name: "Local reviewer" }; } },
  sessions: { async load(id) { const r = await read(`/v1/sessions/${id}/state`); return r.data !== undefined ? { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SafeSessionProjectionSchema.parse(r.data) } : { kind: "API_UNAVAILABLE" }; }, async start() { return { success: false, kind: "UNAUTHORIZED" }; } },
  actions: { async submit(intent) { const id = ++sequence; const r = await read(`/v1/sessions/${intent.session_id}/actions/propose`, {
    command_id: requestId("command", id), action_request_id: requestId("action-request", id), action_id: intent.action.action_id,
    expected_state_version: intent.expected_state_version, parameters: intent.parameters, source: "UI" });
    return r.data !== undefined ? { kind: "COMMITTED", replayed: r.data.replayed, idempotency_key: requestId("idempotency", sequence), committed_event_ids: r.data.committed_event_ids, projection: SafeSessionProjectionSchema.parse(r.data.session) } : { kind: "REJECTED", requires_authoritative_sync: true }; } },
  timeline: { async load(id) { const r = await read(`/v1/sessions/${id}/timeline`); return r.data !== undefined ? { kind: "AVAILABLE", projection: SafeLearnerTimelineProjectionSchema.parse(r.data) } : { kind: "UNAVAILABLE" }; } },
  assessment: { async load(id) { const r = await read(`/v1/sessions/${id}/assessment`); return r.data !== undefined ? { kind: "AVAILABLE", projection: SafeAssessmentApiProjectionSchema.parse(r.data) } : { kind: "PENDING" }; } },
  finalization: { async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: false }; } },
  patient_conversation: {
    async load(id) { const r = await read(`/v1/sessions/${id}/questions`); return r.data !== undefined ? { kind: "AVAILABLE", transcript: PatientConversationTranscriptSchema.parse(r.data) } : { kind: "UNAVAILABLE" }; },
    async submit(intent) { const r = await read(`/v1/sessions/${intent.session_id}/questions`, createV2_021QuestionBody(intent, requestId("utterance", ++sequence))); return r.data !== undefined ? { kind: "COMMITTED", replayed: r.data.replayed, turn: SafePatientConversationTurnSchema.parse(r.data.turn) } : { kind: "UNAVAILABLE" }; }
  }
};
const voice = current.voice_profile === undefined ? undefined : createElevenLabsStudentVoiceServices({
  patient_voice_profile: PatientVoiceProfileSchema.parse(current.voice_profile),
  token_source: createFetchSpeechTokenSource({ fetch: globalThis.fetch.bind(globalThis), headers: async () => ({}) })
});
// A bookmarked previous boot's URL must not select its expired in-memory Session.
if (location.pathname !== `/sessions/${current.session_id}`) history.replaceState(null, "", `/sessions/${current.session_id}`);
createRoot(document.getElementById("root")!).render(<App services={{ ...services, ...(voice === undefined ? {} : { voice }) }} />);
