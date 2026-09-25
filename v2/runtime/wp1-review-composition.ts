import {
  apiHeaders,
  createApiTestHarness,
  startBody,
} from "../tests/fixtures/api/secure-api.ts";
import { prepareObservationCase } from "../content/cases/observations/wp1-cases.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";

/** Existing local synthetic authentication/store boundary. No provider composition. */
export async function createObservationReview(
  patient: "khalid" | "dana",
  namespace: string,
  trustedNow: () => string,
) {
  const artifact = await prepareObservationCase(
    patient,
    PORTABLE_SHA256_ADAPTER,
  );
  const h = await createApiTestHarness({
    review_artifact: artifact,
    trusted_time_utc: trustedNow,
  });
  const r = await h.app.request("/v1/review-sessions", {
    method: "POST",
    headers: apiHeaders({
      token: "faculty",
      idempotency: `idempotency.wp1.${namespace}`,
    }),
    body: JSON.stringify(
      startBody(artifact.source_case.manifest.case_id, {
        mode: "PRACTICE_DEMO",
        patient_language: "ar-JO",
      }),
    ),
  });
  if (r.status !== 201) throw Error("WP1_REVIEW_START_FAILED");
  const initial = (await r.json()).data.session;
  return { h, artifact, sessionId: initial.session_id as string, initial };
}
