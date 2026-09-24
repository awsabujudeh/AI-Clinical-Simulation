import { createApiTestHarness, apiHeaders, startBody } from "../tests/fixtures/api/secure-api.ts";
import { prepareDanaReview } from "../content/cases/anaphylaxis/dana-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";

/** Local review adapter only. Uses the existing API, coordinator and clinical rules. */
export async function createDanaReviewSession(options?: {
  namespace?: string;
  patient_provider?: NonNullable<Parameters<typeof createApiTestHarness>[0]>['patient_provider'];
  speech_token_broker?: NonNullable<Parameters<typeof createApiTestHarness>[0]>['speech_token_broker'];
}) {
  const prepared = await prepareDanaReview(PORTABLE_SHA256_ADAPTER);
  if (!prepared.success) throw Error(JSON.stringify(prepared.report));
  const artifact = prepared.artifact;
  const h = await createApiTestHarness({ review_artifact: artifact,
    ...(options?.patient_provider ? {enable_patient_conversation:true,patient_provider:options.patient_provider,speech_token_broker:options.speech_token_broker} : {}) });
  const start = await h.app.request("/v1/review-sessions", { method: "POST",
    headers: apiHeaders({ token: "faculty", idempotency: `idempotency.dana.${options?.namespace??'start'}` }),
    body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, { mode: "PRACTICE_DEMO", patient_language: "ar-JO" })) });
  if (start.status !== 201) throw Error("DANA_REVIEW_START_FAILED");
  const sessionId = (await start.json()).data.session.session_id as string;
  let index = 0;
  async function state() {
    return (await (await h.app.request(`/v1/sessions/${sessionId}/state`, { headers: apiHeaders({ token: "faculty" }) })).json()).data;
  }
  async function action(actionId: string) {
    const current = await state(); const n = ++index;
    return h.app.request(`/v1/sessions/${sessionId}/actions/propose`, { method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: `idempotency.dana.action-${n}` }),
      body: JSON.stringify({ command_id: `command.dana.${n}`, action_request_id: `action-request.dana.${n}`, action_id: actionId, expected_state_version: current.state_version, parameters: {}, source: "UI" }) });
  }
  async function advance(seconds: number) {
    const time = new Date(Date.parse("2026-09-06T10:00:00Z") + seconds * 1000).toISOString(); h.setTrustedTime(time);
    return h.dependencies.session_coordinator.syncRunningSession({ coordinator_schema_version: "1.0", session_id: sessionId, trusted_real_time_utc: time,
      request_id: `request.dana.sync-${seconds}`, correlation_id: `correlation.dana.sync-${seconds}`, idempotency_key: `idempotency.dana.sync-${seconds}` });
  }
  return { h, artifact, sessionId, state, action, advance };
}
