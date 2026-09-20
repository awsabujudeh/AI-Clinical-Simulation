import { createApiTestHarness, apiHeaders, startBody } from "../tests/fixtures/api/secure-api.ts";
import { prepareStemiConversationArtifact } from "../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";

/** Local deterministic review only; no provider, credentials or clinical overrides. */
export async function createV2_022Review() {
  const artifact = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
  const h = await createApiTestHarness({ review_artifact: artifact });
  const r = await h.app.request("/v1/review-sessions", {method:"POST",headers:apiHeaders({token:"faculty",idempotency:"idempotency.media-review"}),
    body:JSON.stringify(startBody(artifact.source_case.manifest.case_id,{mode:"PRACTICE_DEMO",patient_language:"ar-JO"}))});
  if(r.status!==201)throw Error("REVIEW_START_FAILED");
  const sessionId=(await r.json()).data.session.session_id as string;
  async function advance(seconds:number) {
    const time=new Date(Date.parse("2026-09-06T10:00:00Z")+seconds*1000).toISOString();
    h.setTrustedTime(time);
    return h.dependencies.session_coordinator.syncRunningSession({coordinator_schema_version:"1.0",session_id:sessionId,
      trusted_real_time_utc:time,request_id:`request.media.${seconds}`,correlation_id:`correlation.media.${seconds}`,idempotency_key:`idempotency.media.${seconds}`});
  }
  return {h,sessionId,advance};
}
