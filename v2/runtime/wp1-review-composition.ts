import {
  apiHeaders,
  createApiTestHarness,
  startBody,
} from "../tests/fixtures/api/secure-api.ts";
import { prepareObservationCase } from "../content/cases/observations/wp1-cases.ts";
import { prepareExpoCatalogueCase } from "../content/cases/shared-catalogue/expo-cases.ts";
import { prepareCompleteExpoCase } from "../content/cases/shared-catalogue/complete-cases.ts";
import { prepareCurrentCompleteExpoCase } from "../content/cases/shared-catalogue/dana-history-exam.ts";
import { prepareApprovedExpoCase } from "../content/cases/shared-catalogue/approved-expo-cases.ts";
import { PORTABLE_SHA256_ADAPTER } from "../tests/fixtures/portable-sha256.ts";

/** Existing local synthetic authentication/store boundary. No provider composition. */
export async function createObservationReview(
  patient: "khalid" | "dana",
  namespace: string,
  trustedNow: () => string,
  catalogue: "wp1" | "wp2" | "wp2-complete" | "wp2-author-complete" | "wp2-approved" = "wp1",
) {
  const artifact = await (catalogue === "wp2-approved" ? prepareApprovedExpoCase : catalogue === "wp2-author-complete" ? prepareCurrentCompleteExpoCase : catalogue === "wp2-complete" ? prepareCompleteExpoCase : catalogue === "wp2" ? prepareExpoCatalogueCase : prepareObservationCase)(
    patient,
    PORTABLE_SHA256_ADAPTER,
  );
  const h = await createApiTestHarness({
    review_artifact: artifact,
    ...(artifact.execution_authority === "APPROVED_EXPO" ? {hash_adapter:PORTABLE_SHA256_ADAPTER} : {}),
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
