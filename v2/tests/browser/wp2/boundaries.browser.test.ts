import { describe, expect, it } from "vitest";
import { EXPO_SHARED_CATALOGUE } from "../../../content/cases/shared-catalogue/expo-catalogue.ts";
import { prepareExpoCatalogueCase } from "../../../content/cases/shared-catalogue/expo-cases.ts";
import {
  apiHeaders,
  createApiTestHarness,
  startBody,
} from "../../fixtures/api/secure-api.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../../fixtures/portable-sha256.ts";
import { wp2Fixture } from "../../fixtures/wp2.ts";

for (const patient of ["khalid", "dana"] as const) {
  describe(`WP2 ${patient} final boundaries`, () => {
    it("pins the precise successor execution hash used by visual projection", async () => {
      const a = await prepareExpoCatalogueCase(patient, hash);
      expect(a.review_execution_hash).toBe(
        patient === "khalid"
          ? "bff79627aa2d99d6951cf3e4e325bab118772ad0b266b2e761ef61bd5cbe77ce"
          : "5fa47d6c2f00c2be192bcae9030dd861a502879f308ef1d74d1f5e224c79cc82",
      );
    });
    it("executes every fixed medication order through its own Case binding", async () => {
      for (
        const concept of EXPO_SHARED_CATALOGUE.actions.filter((a) =>
          a.category === "MEDICATIONS"
        )
      ) {
        const f = await wp2Fixture(patient);
        for (const prerequisite of concept.prerequisite_concept_ids ?? []) {
          await f.action(prerequisite);
        }
        const r = await f.action(concept.action_id);
        expect(r.response.status, concept.action_id).toBe(200);
        const binding = f.artifact.source_case.action_catalogue.shared!.bindings
          .find((b) => b.concept_id === concept.action_id)!;
        const receipt = f.raw().committed_events.find((e) =>
          e.action_id === binding.case_action_id
        );
        expect(receipt?.payload).toMatchObject({
          execution_status: "EXECUTED",
          action_duration_seconds: 30,
        });
      }
    });
    it("does not expose the other Case's diagnostic result", async () => {
      const f = await wp2Fixture(patient);
      const result = patient === "khalid"
        ? "diagnostic-result.dana.ecg"
        : "diagnostic-result.stemi.ecg-standard";
      expect((await f.response(`/investigations/${result}`)).status).not.toBe(
        200,
      );
      expect(f.raw().committed_events).toHaveLength(0);
    });
    it("single-action Interpreter reconciles shared IDs without executing or seeing outcomes", async () => {
      const artifact = await prepareExpoCatalogueCase(patient, hash);
      const h = await createApiTestHarness({
        review_artifact: artifact,
        enable_clinical_interpreter: true,
      });
      const started = await h.app.request("/v1/review-sessions", {
        method: "POST",
        headers: apiHeaders({
          token: "faculty",
          idempotency: "idempotency.wp2.interpreter-start",
        }),
        body: JSON.stringify(startBody(artifact.source_case.manifest.case_id)),
      });
      expect(started.status).toBe(201);
      const session = (await started.json()).data.session;
      const before = JSON.stringify(h.store.sessions.get(session.session_id));
      h.setInterpreterOutput({
        output_schema_version: "2.0",
        status: "MATCH",
        ambiguity_reason: null,
        no_match_reason: null,
        candidates: [{ action_id: "concept.expo.aspirin", parameters: [] }],
      });
      const r = await h.app.request(
        `/v1/sessions/${session.session_id}/actions/interpret`,
        {
          method: "POST",
          headers: apiHeaders({ token: "faculty" }),
          body: JSON.stringify({
            text: "Give aspirin",
            locale: "en-US",
            utterance_id: "utterance.wp2.single",
          }),
        },
      );
      expect(r.status).toBe(200);
      expect((await r.json()).data.interpretation).toMatchObject({
        authority: "NON_AUTHORITATIVE",
        status: "MATCH",
        candidate: { action_id: "concept.expo.aspirin" },
      });
      expect(JSON.stringify(h.store.sessions.get(session.session_id))).toBe(
        before,
      );
      // This harness is a deterministic local provider double, never an external call.
      expect(h.getInterpreterProviderCalls()).toBe(1);
    });
  });
}
it("Dana repeat after the authored five-minute window retains its eligible outcome", async () => {
  const f = await wp2Fixture();
  await f.action("concept.expo.epinephrine");
  f.elapsed(300);
  expect((await f.action("concept.expo.repeat-epinephrine")).response.status)
    .toBe(200);
  expect(f.raw().patient_state.outcome_flags).toContain(
    "outcome.dana.repeat-given",
  );
  expect(f.raw().patient_state.outcome_flags).not.toContain(
    "outcome.dana.repeat-outside-window",
  );
});
